package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type ClienteHandler struct {
	DB *gorm.DB
}

func NewClienteHandler(db *gorm.DB) *ClienteHandler {
	return &ClienteHandler{DB: db}
}

type clienteResponse struct {
	ID                uint    `json:"id"`
	Nome              string  `json:"nome"`
	Telefone          string  `json:"telefone"`
	Email             string  `json:"email"`
	DataNascimento    *string `json:"data_nascimento"`
	AgendamentosCount int64   `json:"agendamentos_count"`
	CreatedAt         string  `json:"created_at"`
}

func toClienteResponse(c models.Cliente, agendamentosCount int64) clienteResponse {
	var dataNascimento *string
	if c.DataNascimento != nil {
		f := c.DataNascimento.Format("2006-01-02")
		dataNascimento = &f
	}
	return clienteResponse{
		ID:                c.ID,
		Nome:              c.Nome,
		Telefone:          c.Telefone,
		Email:             c.Email,
		DataNascimento:    dataNascimento,
		AgendamentosCount: agendamentosCount,
		CreatedAt:         c.CreatedAt.Format(time.RFC3339),
	}
}

// List retorna os clientes do estabelecimento, com quantos agendamentos
// cada um já fez. aniversariantes=mes|semana filtra só quem faz aniversário
// no período — compara só dia/mês de data_nascimento, ignorando o ano.
func (h *ClienteHandler) List(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	query := h.DB.Where("estabelecimento_id = ?", estabelecimentoID)

	switch c.Query("aniversariantes") {
	case "mes":
		query = query.Where(
			"data_nascimento IS NOT NULL AND EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)",
		)
	case "semana":
		// intervalo de 7 dias a partir de hoje, comparando só dia-do-ano
		// pra não precisar lidar com virada de ano/mês na mão — to_char
		// com "MMDD" dá uma string comparável direto.
		hoje := time.Now()
		fim := hoje.AddDate(0, 0, 6)
		if hoje.Year() == fim.Year() {
			query = query.Where(
				"data_nascimento IS NOT NULL AND to_char(data_nascimento, 'MMDD') BETWEEN ? AND ?",
				hoje.Format("0102"), fim.Format("0102"),
			)
		} else {
			// período atravessa a virada do ano (ex: 28/dez a 03/jan) — o
			// BETWEEN direto não funciona, então é "depois do início OU
			// antes do fim".
			query = query.Where(
				"data_nascimento IS NOT NULL AND (to_char(data_nascimento, 'MMDD') >= ? OR to_char(data_nascimento, 'MMDD') <= ?)",
				hoje.Format("0102"), fim.Format("0102"),
			)
		}
	}

	var clientes []models.Cliente
	if err := query.Order("nome asc").Find(&clientes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar clientes"})
		return
	}

	// conta agendamentos de todo mundo numa query só, em vez de uma por cliente
	contagem := map[uint]int64{}
	if len(clientes) > 0 {
		ids := make([]uint, len(clientes))
		for i, cl := range clientes {
			ids[i] = cl.ID
		}
		var linhas []struct {
			ClienteID uint
			Total     int64
		}
		h.DB.Model(&models.Agendamento{}).
			Select("cliente_id, count(*) as total").
			Where("cliente_id IN ?", ids).
			Group("cliente_id").
			Scan(&linhas)
		for _, l := range linhas {
			contagem[l.ClienteID] = l.Total
		}
	}

	respostas := make([]clienteResponse, 0, len(clientes))
	for _, cl := range clientes {
		respostas = append(respostas, toClienteResponse(cl, contagem[cl.ID]))
	}
	c.JSON(http.StatusOK, respostas)
}

type clienteInput struct {
	Nome           string  `json:"nome" binding:"required"`
	Telefone       string  `json:"telefone" binding:"required"`
	DataNascimento *string `json:"data_nascimento"` // "YYYY-MM-DD" ou nil
}

func parseDataNascimento(input *string) (*time.Time, error) {
	if input == nil || strings.TrimSpace(*input) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *input)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Create cadastra um cliente manualmente — nasce diferente do fluxo normal
// (que só cria Cliente a partir de um agendamento), então aqui checa
// duplicidade de telefone explicitamente e devolve erro claro em vez de
// simplesmente casar com um cliente já existente sem avisar.
func (h *ClienteHandler) Create(c *gin.Context) {
	var input clienteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dataNascimento, err := parseDataNascimento(input.DataNascimento)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data de nascimento inválida"})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)
	telefoneNormalizado := apenasDigitos(input.Telefone)

	var existentes int64
	h.DB.Model(&models.Cliente{}).
		Where("estabelecimento_id = ? AND regexp_replace(telefone, '[^0-9]', '', 'g') = ?", estabelecimentoID, telefoneNormalizado).
		Count(&existentes)
	if existentes > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "já existe um cliente com esse telefone"})
		return
	}

	cliente := models.Cliente{
		Nome:              strings.TrimSpace(input.Nome),
		Telefone:          strings.TrimSpace(input.Telefone),
		DataNascimento:    dataNascimento,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&cliente).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao cadastrar cliente"})
		return
	}
	c.JSON(http.StatusCreated, toClienteResponse(cliente, 0))
}

// Update edita nome/telefone/data de nascimento — não mexe no telefone de
// outros clientes, então checa duplicidade excluindo o próprio registro.
func (h *ClienteHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)
	var cliente models.Cliente
	if err := h.DB.Where("id = ? AND estabelecimento_id = ?", id, estabelecimentoID).First(&cliente).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cliente não encontrado"})
		return
	}

	var input clienteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dataNascimento, err := parseDataNascimento(input.DataNascimento)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data de nascimento inválida"})
		return
	}

	telefoneNormalizado := apenasDigitos(input.Telefone)
	var existentes int64
	h.DB.Model(&models.Cliente{}).
		Where("estabelecimento_id = ? AND id <> ? AND regexp_replace(telefone, '[^0-9]', '', 'g') = ?",
			estabelecimentoID, cliente.ID, telefoneNormalizado).
		Count(&existentes)
	if existentes > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "já existe outro cliente com esse telefone"})
		return
	}

	cliente.Nome = strings.TrimSpace(input.Nome)
	cliente.Telefone = strings.TrimSpace(input.Telefone)
	cliente.DataNascimento = dataNascimento
	if err := h.DB.Save(&cliente).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar cliente"})
		return
	}

	var totalAgendamentos int64
	h.DB.Model(&models.Agendamento{}).Where("cliente_id = ?", cliente.ID).Count(&totalAgendamentos)
	c.JSON(http.StatusOK, toClienteResponse(cliente, totalAgendamentos))
}
