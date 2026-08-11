package handlers

import (
	"crypto/subtle"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

// PlataformaHandler concentra o login de plataforma e o gerenciamento da
// lista de EmailIsento — uso pessoal do dono do projeto, sem relação com
// login de Usuario/Estabelecimento nenhum (ver CLAUDE.md "Isenção de
// pagamento").
type PlataformaHandler struct {
	DB          *gorm.DB
	Gerenciador *auth.Gerenciador
	Senha       string
}

func NewPlataformaHandler(db *gorm.DB, gerenciador *auth.Gerenciador, senha string) *PlataformaHandler {
	return &PlataformaHandler{DB: db, Gerenciador: gerenciador, Senha: senha}
}

type plataformaLoginInput struct {
	Senha string `json:"senha" binding:"required"`
}

// Login compara a senha recebida com PLATFORM_ADMIN_SENHA em tempo
// constante — não é um hash bcrypt porque não existe cadastro nem troca de
// senha, é só uma variável de ambiente comparada direto.
func (h *PlataformaHandler) Login(c *gin.Context) {
	if h.Senha == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login de plataforma não configurado"})
		return
	}

	var input plataformaLoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if subtle.ConstantTimeCompare([]byte(input.Senha), []byte(h.Senha)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "senha inválida"})
		return
	}

	token, err := h.Gerenciador.GerarTokenPlataforma()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar sessão"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

type emailIsentoResponse struct {
	ID                  uint       `json:"id"`
	Email               string     `json:"email"`
	DuracaoDias         *int       `json:"duracao_dias"`
	EstabelecimentoID   *uint      `json:"estabelecimento_id"`
	EstabelecimentoNome string     `json:"estabelecimento_nome"`
	IsentoAte           *time.Time `json:"isento_ate"`
	CreatedAt           time.Time  `json:"created_at"`
}

func toEmailIsentoResponse(e models.EmailIsento) emailIsentoResponse {
	nome := ""
	var isentoAte *time.Time
	if e.EstabelecimentoID != nil {
		nome = e.Estabelecimento.Nome
		isentoAte = e.Estabelecimento.IsentoAte
	}
	return emailIsentoResponse{
		ID:                  e.ID,
		Email:               e.Email,
		DuracaoDias:         e.DuracaoDias,
		EstabelecimentoID:   e.EstabelecimentoID,
		EstabelecimentoNome: nome,
		IsentoAte:           isentoAte,
		CreatedAt:           e.CreatedAt,
	}
}

// ListarEmailsIsentos lista todos os e-mails da lista, mais recentes primeiro.
func (h *PlataformaHandler) ListarEmailsIsentos(c *gin.Context) {
	var emails []models.EmailIsento
	if err := h.DB.Preload("Estabelecimento").Order("created_at desc").Find(&emails).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar e-mails isentos"})
		return
	}
	respostas := make([]emailIsentoResponse, 0, len(emails))
	for _, e := range emails {
		respostas = append(respostas, toEmailIsentoResponse(e))
	}
	c.JSON(http.StatusOK, respostas)
}

type emailIsentoInput struct {
	Email string `json:"email" binding:"required,email"`
	// DuracaoDias nil = isenção "sempre". Com valor, só aceita as opções da
	// tela (7/15/30) — ver models.DuracoesIsencaoValidas.
	DuracaoDias *int `json:"duracao_dias"`
}

func duracaoValida(dias int) bool {
	for _, d := range models.DuracoesIsencaoValidas {
		if d == dias {
			return true
		}
	}
	return false
}

// AdicionarEmailIsento cadastra um e-mail novo na lista — normalizado
// (minúsculo, sem espaço) pra bater certo com o e-mail informado depois em
// /cadastro (ver handlers.Registro).
func (h *PlataformaHandler) AdicionarEmailIsento(c *gin.Context) {
	var input emailIsentoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.DuracaoDias != nil && !duracaoValida(*input.DuracaoDias) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duração inválida — use 7, 15, 30 ou deixe em branco pra sempre"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var existentes int64
	h.DB.Model(&models.EmailIsento{}).Where("email = ?", email).Count(&existentes)
	if existentes > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "esse e-mail já está na lista"})
		return
	}

	emailIsento := models.EmailIsento{Email: email, DuracaoDias: input.DuracaoDias}
	if err := h.DB.Create(&emailIsento).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao adicionar e-mail isento"})
		return
	}
	c.JSON(http.StatusCreated, toEmailIsentoResponse(emailIsento))
}

// RemoverEmailIsento tira um e-mail da lista — não desfaz a isenção de quem
// já se cadastrou usando ele (Estabelecimento.Isento fica como está).
func (h *PlataformaHandler) RemoverEmailIsento(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	resultado := h.DB.Delete(&models.EmailIsento{}, id)
	if resultado.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao remover e-mail isento"})
		return
	}
	if resultado.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "e-mail não encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
