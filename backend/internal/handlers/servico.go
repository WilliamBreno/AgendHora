package handlers

import (
	"encoding/json"
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
	Nome         string  `json:"nome" binding:"required"`
	Preco        float64 `json:"preco" binding:"required,gt=0"`
	PrecoAPartir bool    `json:"preco_a_partir"`
	DuracaoMin   int     `json:"duracao_min" binding:"required,gt=0"`
	Descricao    string  `json:"descricao"`
	Cor          string  `json:"cor" binding:"required"`
	Icone        string  `json:"icone"`
	Foto         string  `json:"foto"`
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
	err := h.DB.Where("estabelecimento_id = ?", auth.EstabelecimentoID(c)).
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

	servico := models.Servico{
		Nome:              strings.TrimSpace(input.Nome),
		Preco:             input.Preco,
		PrecoAPartir:      input.PrecoAPartir,
		DuracaoMin:        input.DuracaoMin,
		Descricao:         strings.TrimSpace(input.Descricao),
		Cor:               input.Cor,
		Icone:             input.Icone,
		Foto:              input.Foto,
		EstabelecimentoID: estabelecimentoID,
	}
	if err := h.DB.Create(&servico).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao criar serviço"})
		return
	}
	c.JSON(http.StatusCreated, servico)
}

func (h *ServicoHandler) buscarServico(c *gin.Context) (*models.Servico, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return nil, false
	}

	var servico models.Servico
	err = h.DB.Where("id = ? AND estabelecimento_id = ?", id, auth.EstabelecimentoID(c)).First(&servico).Error
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

	servico.Nome = strings.TrimSpace(input.Nome)
	servico.Preco = input.Preco
	servico.PrecoAPartir = input.PrecoAPartir
	servico.DuracaoMin = input.DuracaoMin
	servico.Descricao = strings.TrimSpace(input.Descricao)
	servico.Cor = input.Cor
	servico.Icone = input.Icone
	servico.Foto = input.Foto

	if err := h.DB.Save(servico).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar serviço"})
		return
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
