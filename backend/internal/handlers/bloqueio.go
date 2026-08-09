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

type BloqueioHandler struct {
	DB *gorm.DB
}

func NewBloqueioHandler(db *gorm.DB) *BloqueioHandler {
	return &BloqueioHandler{DB: db}
}

type bloqueioResponse struct {
	ID               uint      `json:"id"`
	Data             string    `json:"data"`
	HoraInicio       string    `json:"hora_inicio"`
	HoraFim          string    `json:"hora_fim"`
	Motivo           string    `json:"motivo"`
	ProfissionalID   *uint     `json:"profissional_id"`
	ProfissionalNome string    `json:"profissional_nome"`
	CreatedAt        time.Time `json:"created_at"`
}

func toBloqueioResponse(b models.Bloqueio) bloqueioResponse {
	nome := ""
	if b.ProfissionalID != nil {
		nome = b.Profissional.Nome
	}
	return bloqueioResponse{
		ID:               b.ID,
		Data:             b.Data.Format("2006-01-02"),
		HoraInicio:       b.HoraInicio,
		HoraFim:          b.HoraFim,
		Motivo:           b.Motivo,
		ProfissionalID:   b.ProfissionalID,
		ProfissionalNome: nome,
		CreatedAt:        b.CreatedAt,
	}
}

// List retorna os bloqueios do estabelecimento — só o dono acessa (ver
// auth.ExigirDono no router).
func (h *BloqueioHandler) List(c *gin.Context) {
	query := h.DB.Preload("Profissional").Where("estabelecimento_id = ?", auth.EstabelecimentoID(c))

	if inicioStr := c.Query("inicio"); inicioStr != "" {
		inicio, err := time.Parse("2006-01-02", inicioStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'inicio' inválido"})
			return
		}
		query = query.Where("data >= ?", inicio)
	}
	if fimStr := c.Query("fim"); fimStr != "" {
		fim, err := time.Parse("2006-01-02", fimStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'fim' inválido"})
			return
		}
		query = query.Where("data <= ?", fim)
	}

	var bloqueios []models.Bloqueio
	if err := query.Order("data asc, hora_inicio asc").Find(&bloqueios).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar bloqueios"})
		return
	}

	respostas := make([]bloqueioResponse, 0, len(bloqueios))
	for _, b := range bloqueios {
		respostas = append(respostas, toBloqueioResponse(b))
	}
	c.JSON(http.StatusOK, respostas)
}

type bloqueioInput struct {
	Data           string `json:"data" binding:"required"`
	HoraInicio     string `json:"hora_inicio"`
	HoraFim        string `json:"hora_fim"`
	Motivo         string `json:"motivo"`
	ProfissionalID *uint  `json:"profissional_id"`
}

// Create cria um bloqueio — dia inteiro quando hora_inicio/hora_fim vêm
// vazios, senão só aquele intervalo. Sem profissional_id bloqueia o
// estabelecimento inteiro.
func (h *BloqueioHandler) Create(c *gin.Context) {
	var input bloqueioInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := time.Parse("2006-01-02", input.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data inválida"})
		return
	}

	horaInicio := strings.TrimSpace(input.HoraInicio)
	horaFim := strings.TrimSpace(input.HoraFim)
	if (horaInicio == "") != (horaFim == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "informe início e fim do intervalo, ou deixe os dois em branco pro dia inteiro"})
		return
	}
	if horaInicio != "" {
		inicioMin, err1 := minutosDoDia(horaInicio)
		fimMin, err2 := minutosDoDia(horaFim)
		if err1 != nil || err2 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "horário inválido"})
			return
		}
		if inicioMin >= fimMin {
			c.JSON(http.StatusBadRequest, gin.H{"error": "horário de início precisa ser antes do fim"})
			return
		}
	}

	estabelecimentoID := auth.EstabelecimentoID(c)

	if input.ProfissionalID != nil {
		var total int64
		h.DB.Model(&models.Usuario{}).
			Where("id = ? AND estabelecimento_id = ?", *input.ProfissionalID, estabelecimentoID).
			Count(&total)
		if total == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "profissional não encontrado"})
			return
		}
	}

	bloqueio := models.Bloqueio{
		Data:              data,
		HoraInicio:        horaInicio,
		HoraFim:           horaFim,
		Motivo:            strings.TrimSpace(input.Motivo),
		ProfissionalID:    input.ProfissionalID,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&bloqueio).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar bloqueio"})
		return
	}
	if bloqueio.ProfissionalID != nil {
		h.DB.First(&bloqueio.Profissional, *bloqueio.ProfissionalID)
	}
	c.JSON(http.StatusCreated, toBloqueioResponse(bloqueio))
}

// Delete remove um bloqueio — não tem edição nesta tela simples, só criar e
// apagar (pra mudar, apaga e cria de novo).
func (h *BloqueioHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	resultado := h.DB.Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).
		Delete(&models.Bloqueio{})
	if resultado.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao remover bloqueio"})
		return
	}
	if resultado.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "bloqueio não encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
