package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"agendamento/backend/internal/models"
)

type EstabelecimentoHandler struct {
	DB                *gorm.DB
	EstabelecimentoID uint
}

func NewEstabelecimentoHandler(db *gorm.DB, estabelecimentoID uint) *EstabelecimentoHandler {
	return &EstabelecimentoHandler{DB: db, EstabelecimentoID: estabelecimentoID}
}

func (h *EstabelecimentoHandler) Get(c *gin.Context) {
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, h.EstabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	c.JSON(http.StatusOK, estabelecimento)
}

type estabelecimentoInput struct {
	Nome     string `json:"nome" binding:"required"`
	Telefone string `json:"telefone"`
	Endereco string `json:"endereco"`
	Email    string `json:"email"`
}

// AtualizarDados edita os dados básicos do estabelecimento (nome, contato).
func (h *EstabelecimentoHandler) AtualizarDados(c *gin.Context) {
	var input estabelecimentoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, h.EstabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}

	estabelecimento.Nome = strings.TrimSpace(input.Nome)
	estabelecimento.Telefone = strings.TrimSpace(input.Telefone)
	estabelecimento.Endereco = strings.TrimSpace(input.Endereco)
	estabelecimento.Email = strings.TrimSpace(input.Email)

	if err := h.DB.Save(&estabelecimento).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar estabelecimento"})
		return
	}
	c.JSON(http.StatusOK, estabelecimento)
}

type horarioInput struct {
	Horarios map[string]models.HorarioDia `json:"horarios"`
}

// AtualizarHorario substitui o horário de funcionamento por dia da semana,
// usado pelo motor de disponibilidade da página pública.
func (h *EstabelecimentoHandler) AtualizarHorario(c *gin.Context) {
	var input horarioInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for dia, horario := range input.Horarios {
		if !slices.Contains(models.DiasSemana, dia) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "dia da semana inválido: " + dia})
			return
		}
		if horario.Fechado {
			continue
		}
		if _, err := minutosDoDia(horario.Abre); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "horário de abertura inválido em " + dia})
			return
		}
		if _, err := minutosDoDia(horario.Fecha); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "horário de fechamento inválido em " + dia})
			return
		}
	}

	dados, err := json.Marshal(input.Horarios)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar horário"})
		return
	}

	err = h.DB.Model(&models.Estabelecimento{}).
		Where("id = ?", h.EstabelecimentoID).
		Update("horario_funcionamento", datatypes.JSON(dados)).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar horário"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"horario_funcionamento": input.Horarios})
}

// nomeIconeValido aceita nomes de ícones lucide-react em PascalCase (ex: "Scissors", "Flower2").
var nomeIconeValido = regexp.MustCompile(`^[A-Za-z0-9]{1,64}$`)

type iconesInput struct {
	Icones []string `json:"icones"`
}

// AtualizarIcones substitui a lista de ícones disponíveis no seletor de
// serviço (Estabelecimento.IconesPadrao). É o dono quem define esse conjunto
// em Configurações — nunca um array fixo no código do frontend.
func (h *EstabelecimentoHandler) AtualizarIcones(c *gin.Context) {
	var input iconesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vistos := make(map[string]bool, len(input.Icones))
	icones := make([]string, 0, len(input.Icones))
	for _, nome := range input.Icones {
		if !nomeIconeValido.MatchString(nome) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "nome de ícone inválido: " + nome})
			return
		}
		if vistos[nome] {
			continue
		}
		vistos[nome] = true
		icones = append(icones, nome)
	}

	dados, err := json.Marshal(icones)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar ícones"})
		return
	}

	err = h.DB.Model(&models.Estabelecimento{}).
		Where("id = ?", h.EstabelecimentoID).
		Update("icones_padrao", datatypes.JSON(dados)).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar ícones"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"icones_padrao": icones})
}
