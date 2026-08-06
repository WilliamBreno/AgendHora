package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/notifications"
)

type ProfissionalHandler struct {
	DB          *gorm.DB
	Gerenciador *auth.Gerenciador
	Notificador *notifications.Notificador
}

func NewProfissionalHandler(db *gorm.DB, gerenciador *auth.Gerenciador, notificador *notifications.Notificador) *ProfissionalHandler {
	return &ProfissionalHandler{DB: db, Gerenciador: gerenciador, Notificador: notificador}
}

type profissionalResponse struct {
	ID       uint                `json:"id"`
	Nome     string              `json:"nome"`
	Email    string              `json:"email"`
	Telefone string              `json:"telefone"`
	Papel    models.PapelUsuario `json:"papel"`
}

func toProfissionalResponse(u models.Usuario) profissionalResponse {
	return profissionalResponse{ID: u.ID, Nome: u.Nome, Email: u.Email, Telefone: u.Telefone, Papel: u.Papel}
}

type conviteResponse struct {
	ID        uint      `json:"id"`
	Email     string    `json:"email"`
	Telefone  string    `json:"telefone"`
	CreatedAt time.Time `json:"created_at"`
}

// Listar retorna a equipe do estabelecimento (dono + auxiliares já
// cadastrados) e os convites ainda pendentes — só o dono acessa (ver
// auth.ExigirDono no router).
func (h *ProfissionalHandler) Listar(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	var usuarios []models.Usuario
	if err := h.DB.Where("estabelecimento_id = ?", estabelecimentoID).Order("id asc").Find(&usuarios).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar equipe"})
		return
	}

	var convites []models.ConviteProfissional
	h.DB.Where("estabelecimento_id = ? AND usado = ?", estabelecimentoID, false).
		Order("id asc").Find(&convites)

	profissionais := make([]profissionalResponse, 0, len(usuarios))
	for _, u := range usuarios {
		profissionais = append(profissionais, toProfissionalResponse(u))
	}
	pendentes := make([]conviteResponse, 0, len(convites))
	for _, cv := range convites {
		pendentes = append(pendentes, conviteResponse{ID: cv.ID, Email: cv.Email, Telefone: cv.Telefone, CreatedAt: cv.CreatedAt})
	}

	c.JSON(http.StatusOK, gin.H{"profissionais": profissionais, "convites_pendentes": pendentes})
}

// ListarPublico é a lista de profissionais que o cliente final escolhe na
// página pública de agendamento — só o essencial pra montar o seletor, nada
// sensível (sem e-mail/telefone).
func (h *ProfissionalHandler) ListarPublico(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)
	var usuarios []models.Usuario
	if err := h.DB.Where("estabelecimento_id = ?", estabelecimentoID).Order("id asc").Find(&usuarios).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar profissionais"})
		return
	}
	lista := make([]gin.H, 0, len(usuarios))
	for _, u := range usuarios {
		lista = append(lista, gin.H{"id": u.ID, "nome": u.Nome})
	}
	c.JSON(http.StatusOK, lista)
}

type convidarInput struct {
	Email    string `json:"email" binding:"required,email"`
	Telefone string `json:"telefone" binding:"required"`
}

func gerarTokenConvite() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// Convidar cria um convite pro profissional auxiliar se cadastrar sozinho
// depois, pelo link enviado por e-mail. Não cria o Usuario aqui — sem senha
// definida pelo próprio profissional a conta ainda não existe de verdade.
func (h *ProfissionalHandler) Convidar(c *gin.Context) {
	var input convidarInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))

	var jaExiste int64
	h.DB.Model(&models.Usuario{}).Where("email = ?", email).Count(&jaExiste)
	if jaExiste > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "já existe uma conta com esse e-mail"})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)
	var conviteJaExiste int64
	h.DB.Model(&models.ConviteProfissional{}).
		Where("email = ? AND estabelecimento_id = ? AND usado = ?", email, estabelecimentoID, false).
		Count(&conviteJaExiste)
	if conviteJaExiste > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "já existe um convite pendente pra esse e-mail"})
		return
	}

	token, err := gerarTokenConvite()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar convite"})
		return
	}

	convite := models.ConviteProfissional{
		Email:             email,
		Telefone:          strings.TrimSpace(input.Telefone),
		Token:             token,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&convite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar convite"})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, estabelecimentoID).Error; err == nil && h.Notificador != nil {
		go h.Notificador.NotificarConviteProfissional(estabelecimento, convite)
	}

	c.JSON(http.StatusCreated, conviteResponse{ID: convite.ID, Email: convite.Email, Telefone: convite.Telefone, CreatedAt: convite.CreatedAt})
}

func (h *ProfissionalHandler) buscarConviteValido(c *gin.Context) (*models.ConviteProfissional, bool) {
	var convite models.ConviteProfissional
	err := h.DB.Where("token = ? AND usado = ?", c.Param("token"), false).First(&convite).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "convite inválido ou já utilizado"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar convite"})
		return nil, false
	}
	return &convite, true
}

// VerConvite é usado pela tela pública de aceite do convite pra mostrar de
// qual empresa é o convite e pré-preencher e-mail/telefone — sem exigir
// login, já que o profissional ainda não tem conta.
func (h *ProfissionalHandler) VerConvite(c *gin.Context) {
	convite, ok := h.buscarConviteValido(c)
	if !ok {
		return
	}
	var estabelecimento models.Estabelecimento
	h.DB.First(&estabelecimento, convite.EstabelecimentoID)
	c.JSON(http.StatusOK, gin.H{
		"nome_estabelecimento": estabelecimento.Nome,
		"email":                convite.Email,
		"telefone":             convite.Telefone,
	})
}

var errEmailJaCadastrado = errors.New("email já cadastrado")

type aceitarConviteInput struct {
	Nome  string `json:"nome" binding:"required"`
	Senha string `json:"senha" binding:"required,min=6"`
}

// AceitarConvite cria a conta do profissional auxiliar de fato — só nesse
// momento, quando ele mesmo define nome e senha pelo link recebido por
// e-mail. Devolve sessão já autenticada, igual Registro/Login.
func (h *ProfissionalHandler) AceitarConvite(c *gin.Context) {
	convite, ok := h.buscarConviteValido(c)
	if !ok {
		return
	}

	var input aceitarConviteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senhaHash, err := auth.HashSenha(input.Senha)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar senha"})
		return
	}

	usuario := models.Usuario{
		Nome:              strings.TrimSpace(input.Nome),
		Email:             convite.Email,
		Telefone:          convite.Telefone,
		SenhaHash:         senhaHash,
		Papel:             models.PapelAuxiliar,
		EstabelecimentoID: convite.EstabelecimentoID,
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		var jaExiste int64
		tx.Model(&models.Usuario{}).Where("email = ?", usuario.Email).Count(&jaExiste)
		if jaExiste > 0 {
			return errEmailJaCadastrado
		}
		if err := tx.Create(&usuario).Error; err != nil {
			return err
		}
		return tx.Model(&models.ConviteProfissional{}).Where("id = ?", convite.ID).Update("usado", true).Error
	})
	if err != nil {
		if errors.Is(err, errEmailJaCadastrado) {
			c.JSON(http.StatusConflict, gin.H{"error": "já existe uma conta com esse e-mail"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar conta"})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, usuario.EstabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}

	token, err := h.Gerenciador.GerarToken(usuario.ID, estabelecimento.ID, usuario.Papel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar sessão"})
		return
	}

	c.JSON(http.StatusCreated, sessaoResponse{Token: token, Estabelecimento: estabelecimento, Usuario: usuario})
}
