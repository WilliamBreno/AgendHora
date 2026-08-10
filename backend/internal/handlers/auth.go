package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
	"agendamento/backend/internal/slug"
)

type AuthHandler struct {
	DB          *gorm.DB
	Gerenciador *auth.Gerenciador
}

func NewAuthHandler(db *gorm.DB, gerenciador *auth.Gerenciador) *AuthHandler {
	return &AuthHandler{DB: db, Gerenciador: gerenciador}
}

type sessaoResponse struct {
	Token           string                 `json:"token"`
	Estabelecimento models.Estabelecimento `json:"estabelecimento"`
	Usuario         models.Usuario         `json:"usuario"`
}

type registroInput struct {
	NomeEstabelecimento string `json:"nome_estabelecimento" binding:"required"`
	Nome                string `json:"nome" binding:"required"`
	Email               string `json:"email" binding:"required,email"`
	Senha               string `json:"senha" binding:"required,min=6"`
	Telefone            string `json:"telefone" binding:"required"`
}

// Registro cria uma empresa nova (com slug e configurações padrão) e o
// primeiro usuário dela. Cada empresa na plataforma nasce por aqui — não
// existe mais um estabelecimento único criado automaticamente no boot.
//
// Todo cadastro nasce com Ativo=false (cobrança manual via Pix — ver
// CLAUDE.md "Cadastro e ativação de novos estabelecimentos"): o frontend
// manda o dono pra tela de instrução de pagamento em vez do onboarding
// normal, e ExigirEstabelecimentoAtivo bloqueia qualquer rota admin até a
// ativação manual no banco. Exceção: e-mail cadastrado em EmailIsento (ver
// "Isenção de pagamento") nasce direto com Ativo=true e Isento=true,
// pulando a tela de pagamento inteira.
func (h *AuthHandler) Registro(c *gin.Context) {
	var input registroInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var existentes int64
	h.DB.Model(&models.Usuario{}).Where("email = ?", email).Count(&existentes)
	if existentes > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "já existe uma conta com esse e-mail"})
		return
	}

	slugGerado, err := slug.GerarUnico(h.DB, input.NomeEstabelecimento)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar identificador da empresa"})
		return
	}

	senhaHash, err := auth.HashSenha(input.Senha)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar senha"})
		return
	}

	icones, _ := json.Marshal(models.IconesPadraoDefault)
	horario, _ := json.Marshal(models.HorarioFuncionamentoDefault())

	var emailIsento models.EmailIsento
	isento := h.DB.Where("email = ?", email).First(&emailIsento).Error == nil

	estabelecimento := models.Estabelecimento{
		Nome:                 strings.TrimSpace(input.NomeEstabelecimento),
		Slug:                 slugGerado,
		Email:                email,
		IconesPadrao:         datatypes.JSON(icones),
		HorarioFuncionamento: datatypes.JSON(horario),
		// Isento=true e Ativo=true aqui são valores não-zero, então GORM
		// sempre inclui os dois no INSERT — sem a pegadinha do zero-value
		// omitido que existe pro caso contrário (ver comentário abaixo).
		Isento: isento,
		Ativo:  isento,
	}

	usuario := models.Usuario{
		Nome:              strings.TrimSpace(input.Nome),
		Email:             email,
		Telefone:          strings.TrimSpace(input.Telefone),
		SenhaHash:         senhaHash,
		Papel:             models.PapelDono,
		EstabelecimentoID: estabelecimento.ID,
	}
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&estabelecimento).Error; err != nil {
			return err
		}
		if !isento {
			// GORM omite campos bool no INSERT quando valem o zero-value
			// (false) e têm `default` no tag — Estabelecimento.Ativo tem
			// default:true, então a linha nasceria ativa mesmo com
			// Ativo:false no struct acima. Update explícito garante o
			// valor certo independente disso.
			if err := tx.Model(&estabelecimento).Update("ativo", false).Error; err != nil {
				return err
			}
		} else if err := tx.Model(&emailIsento).Update("estabelecimento_id", estabelecimento.ID).Error; err != nil {
			return err
		}
		usuario.EstabelecimentoID = estabelecimento.ID
		return tx.Create(&usuario).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar conta"})
		return
	}

	token, err := h.Gerenciador.GerarToken(usuario.ID, estabelecimento.ID, usuario.Papel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar sessão"})
		return
	}

	c.JSON(http.StatusCreated, sessaoResponse{Token: token, Estabelecimento: estabelecimento, Usuario: usuario})
}

type loginInput struct {
	Email string `json:"email" binding:"required"`
	Senha string `json:"senha" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input loginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var usuario models.Usuario
	err := h.DB.Where("email = ?", email).First(&usuario).Error
	if err != nil || !auth.VerificarSenha(usuario.SenhaHash, input.Senha) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "e-mail ou senha inválidos"})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, usuario.EstabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	if !estabelecimento.Ativo {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": auth.MensagemContaInativa})
		return
	}

	token, err := h.Gerenciador.GerarToken(usuario.ID, estabelecimento.ID, usuario.Papel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao gerar sessão"})
		return
	}

	c.JSON(http.StatusOK, sessaoResponse{Token: token, Estabelecimento: estabelecimento, Usuario: usuario})
}

// Sessao retorna estabelecimento + usuário logado — usado no boot do
// frontend (refresh de página) pra recuperar quem está logado e seu papel
// sem precisar guardar isso solto no localStorage.
func (h *AuthHandler) Sessao(c *gin.Context) {
	var usuario models.Usuario
	if err := h.DB.First(&usuario, auth.UsuarioID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar usuário"})
		return
	}
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"estabelecimento": estabelecimento, "usuario": usuario})
}
