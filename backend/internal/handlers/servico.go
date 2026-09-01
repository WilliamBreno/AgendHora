package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type ServicoHandler struct {
	DB *gorm.DB
}

func NewServicoHandler(db *gorm.DB) *ServicoHandler {
	return &ServicoHandler{DB: db}
}

type servicoInput struct {
	Nome  string   `json:"nome" binding:"required"`
	Preco *float64 `json:"preco"` // nil = sem preço cadastrado ("a combinar" na página pública)
	// PrecoAPartir só faz sentido com Preco preenchido — ignorado pelo
	// handler quando Preco é nil.
	PrecoAPartir  bool   `json:"preco_a_partir"`
	DuracaoMin    int    `json:"duracao_min" binding:"required,gt=0"`
	DuracaoMaxMin *int   `json:"duracao_max_min"`
	Descricao     string `json:"descricao"`
	Cor           string `json:"cor" binding:"required"`
	Icone         string `json:"icone"`
	Foto          string `json:"foto"`
	// ProfissionalID nil = catálogo geral (comportamento de sempre).
	// Preenchido = serviço individual — ver validarProfissionalServico pra
	// quem pode de fato usar isso.
	ProfissionalID *uint `json:"profissional_id"`
}

// validarPreco só existe pra rejeitar um preço explicitamente inválido
// (negativo ou zero) quando informado — nil (sem preço) é sempre válido.
func validarPreco(preco *float64) bool {
	return preco == nil || *preco > 0
}

// validarDuracaoMax só existe pra rejeitar uma faixa sem sentido — nil (sem
// faixa, duração fixa) é sempre válido; quando preenchido, precisa ser
// estritamente maior que a duração mínima, senão não é faixa nenhuma.
func validarDuracaoMax(duracaoMin int, duracaoMax *int) bool {
	return duracaoMax == nil || *duracaoMax > duracaoMin
}

// validarProfissionalServico decide se profissionalID pode ser aplicado,
// dado quem está fazendo a chamada — ver CLAUDE.md "Serviços individuais":
//   - dono: sempre pode — nil (catálogo geral) ou atribuir a qualquer
//     profissional do próprio estabelecimento, sem precisar de permissão
//     nenhuma (o dono já pode tudo).
//   - auxiliar: só nil (catálogo geral, comportamento de sempre — essa
//     permissão é aditiva, não tira o que já existia) ou o próprio ID, e só
//     com PodeCadastrarServicoIndividual concedida pelo dono. Nunca pode
//     atribuir um serviço a um colega.
func (h *ServicoHandler) validarProfissionalServico(c *gin.Context, estabelecimentoID uint, profissionalID *uint) bool {
	if profissionalID == nil {
		return true
	}
	if auth.Papel(c) != models.PapelAuxiliar {
		var total int64
		h.DB.Model(&models.Usuario{}).
			Where("id = ? AND estabelecimento_id = ?", *profissionalID, estabelecimentoID).
			Count(&total)
		return total > 0
	}
	if *profissionalID != auth.UsuarioID(c) {
		return false
	}
	var usuario models.Usuario
	if err := h.DB.First(&usuario, auth.UsuarioID(c)).Error; err != nil {
		return false
	}
	return usuario.PodeCadastrarServicoIndividual
}

func validarCor(cor string) bool {
	return slices.Contains(models.CoresServico, cor)
}

func (h *ServicoHandler) validarIcone(icone string, estabelecimentoID uint) bool {
	if icone == "" {
		return true
	}
	var estabelecimento models.Estabelecimento
	if err := h.DB.Select("icones_padrao").First(&estabelecimento, estabelecimentoID).Error; err != nil {
		return false
	}
	var icones []string
	if err := json.Unmarshal(estabelecimento.IconesPadrao, &icones); err != nil {
		return false
	}
	return slices.Contains(icones, icone)
}

func (h *ServicoHandler) List(c *gin.Context) {
	var servicos []models.Servico
	err := h.DB.Preload("Profissional").
		Where("estabelecimento_id = ?", auth.EstabelecimentoID(c)).
		Order("nome asc").
		Find(&servicos).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar serviços"})
		return
	}
	c.JSON(http.StatusOK, servicos)
}

func (h *ServicoHandler) Create(c *gin.Context) {
	estabelecimentoID := auth.EstabelecimentoID(c)

	var input servicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validarCor(input.Cor) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cor inválida"})
		return
	}
	if !h.validarIcone(input.Icone, estabelecimentoID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ícone inválido"})
		return
	}
	if !validarImagemBase64(c, input.Foto) {
		return
	}
	if !validarPreco(input.Preco) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "preço precisa ser maior que zero"})
		return
	}
	if !validarDuracaoMax(input.DuracaoMin, input.DuracaoMaxMin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duração máxima precisa ser maior que a duração mínima"})
		return
	}
	if !h.validarProfissionalServico(c, estabelecimentoID, input.ProfissionalID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você não tem permissão pra criar um serviço individual"})
		return
	}

	servico := models.Servico{
		Nome:              strings.TrimSpace(input.Nome),
		Preco:             input.Preco,
		PrecoAPartir:      input.PrecoAPartir,
		DuracaoMin:        input.DuracaoMin,
		DuracaoMaxMin:     input.DuracaoMaxMin,
		Descricao:         strings.TrimSpace(input.Descricao),
		Cor:               input.Cor,
		Icone:             input.Icone,
		Foto:              input.Foto,
		ProfissionalID:    input.ProfissionalID,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&servico).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar serviço"})
		return
	}
	if servico.ProfissionalID != nil {
		h.DB.Preload("Profissional").First(&servico, servico.ID)
	}
	registrarAtividade(
		h.DB, estabelecimentoID, auth.UsuarioID(c), models.AcaoServicoCriado,
		fmt.Sprintf("Cadastrou o serviço \"%s\"", servico.Nome),
	)
	c.JSON(http.StatusCreated, servico)
}

func (h *ServicoHandler) buscarServico(c *gin.Context) (*models.Servico, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return nil, false
	}

	var servico models.Servico
	err = h.DB.Preload("Profissional").
		Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).First(&servico).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "serviço não encontrado"})
		return nil, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar serviço"})
		return nil, false
	}
	return &servico, true
}

func (h *ServicoHandler) Get(c *gin.Context) {
	servico, ok := h.buscarServico(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, servico)
}

func (h *ServicoHandler) Update(c *gin.Context) {
	servico, ok := h.buscarServico(c)
	if !ok {
		return
	}

	var input servicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validarCor(input.Cor) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cor inválida"})
		return
	}
	if !h.validarIcone(input.Icone, servico.EstabelecimentoID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ícone inválido"})
		return
	}
	if !validarImagemBase64(c, input.Foto) {
		return
	}
	if !validarPreco(input.Preco) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "preço precisa ser maior que zero"})
		return
	}
	if !validarDuracaoMax(input.DuracaoMin, input.DuracaoMaxMin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duração máxima precisa ser maior que a duração mínima"})
		return
	}
	if !h.validarProfissionalServico(c, servico.EstabelecimentoID, input.ProfissionalID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "você não tem permissão pra tornar esse serviço individual"})
		return
	}

	servico.Nome = strings.TrimSpace(input.Nome)
	servico.Preco = input.Preco
	servico.PrecoAPartir = input.PrecoAPartir
	servico.DuracaoMin = input.DuracaoMin
	servico.DuracaoMaxMin = input.DuracaoMaxMin
	servico.Descricao = strings.TrimSpace(input.Descricao)
	servico.Cor = input.Cor
	servico.Icone = input.Icone
	servico.Foto = input.Foto
	servico.ProfissionalID = input.ProfissionalID

	if err := h.DB.Save(servico).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar serviço"})
		return
	}
	if servico.ProfissionalID != nil {
		h.DB.Preload("Profissional").First(servico, servico.ID)
	} else {
		servico.Profissional = models.Usuario{}
	}
	c.JSON(http.StatusOK, servico)
}

func (h *ServicoHandler) Delete(c *gin.Context) {
	servico, ok := h.buscarServico(c)
	if !ok {
		return
	}
	if err := h.DB.Delete(servico).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao excluir serviço"})
		return
	}
	c.Status(http.StatusNoContent)
}
