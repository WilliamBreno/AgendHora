package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type EstabelecimentoHandler struct {
	DB *gorm.DB
}

func NewEstabelecimentoHandler(db *gorm.DB) *EstabelecimentoHandler {
	return &EstabelecimentoHandler{DB: db}
}

// Get retorna os dados completos do estabelecimento — só pra rotas admin
// (inclui e-mail, que é informação privada do dono).
func (h *EstabelecimentoHandler) Get(c *gin.Context) {
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	c.JSON(http.StatusOK, estabelecimento)
}

type estabelecimentoPublicoResponse struct {
	Nome          string `json:"nome"`
	Slug          string `json:"slug"`
	Logo          string `json:"logo"`
	Telefone      string `json:"telefone"`
	Endereco      string `json:"endereco"`
	AvisoAtivo    bool   `json:"aviso_ativo"`
	AvisoTexto    string `json:"aviso_texto"`
	AvisoCorTexto string `json:"aviso_cor_texto"`
	AvisoCorFundo string `json:"aviso_cor_fundo"`
}

// GetPublico retorna só o que a página de agendamento do cliente precisa
// mostrar — nunca o e-mail nem outros dados internos do dono.
func (h *EstabelecimentoHandler) GetPublico(c *gin.Context) {
	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}
	c.JSON(http.StatusOK, estabelecimentoPublicoResponse{
		Nome:          estabelecimento.Nome,
		Slug:          estabelecimento.Slug,
		Logo:          estabelecimento.Logo,
		Telefone:      estabelecimento.Telefone,
		Endereco:      estabelecimento.Endereco,
		AvisoAtivo:    estabelecimento.AvisoAtivo,
		AvisoTexto:    estabelecimento.AvisoTexto,
		AvisoCorTexto: estabelecimento.AvisoCorTexto,
		AvisoCorFundo: estabelecimento.AvisoCorFundo,
	})
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
	if err := h.DB.First(&estabelecimento, auth.EstabelecimentoID(c)).Error; err != nil {
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

// validarHorarios confere cada dia informado — abre/fecha obrigatórios
// quando não está fechado, e o intervalo de descanso (opcional) precisa
// caber dentro do abre-fecha do dia. Compartilhada entre o horário geral do
// estabelecimento e o horário individual de cada profissional.
func validarHorarios(horarios map[string]models.HorarioDia) error {
	for dia, horario := range horarios {
		if !slices.Contains(models.DiasSemana, dia) {
			return errors.New("dia da semana inválido: " + dia)
		}
		if horario.Fechado {
			continue
		}
		abre, err := minutosDoDia(horario.Abre)
		if err != nil {
			return errors.New("horário de abertura inválido em " + dia)
		}
		fecha, err := minutosDoDia(horario.Fecha)
		if err != nil {
			return errors.New("horário de fechamento inválido em " + dia)
		}
		if horario.IntervaloInicio == "" && horario.IntervaloFim == "" {
			continue
		}
		intervaloInicio, err := minutosDoDia(horario.IntervaloInicio)
		if err != nil {
			return errors.New("início do intervalo inválido em " + dia)
		}
		intervaloFim, err := minutosDoDia(horario.IntervaloFim)
		if err != nil {
			return errors.New("fim do intervalo inválido em " + dia)
		}
		if intervaloInicio >= intervaloFim || intervaloInicio < abre || intervaloFim > fecha {
			return errors.New("intervalo de descanso precisa estar dentro do horário de funcionamento em " + dia)
		}
	}
	return nil
}

// AtualizarHorario substitui o horário de funcionamento por dia da semana,
// usado pelo motor de disponibilidade da página pública.
func (h *EstabelecimentoHandler) AtualizarHorario(c *gin.Context) {
	var input horarioInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := validarHorarios(input.Horarios); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dados, err := json.Marshal(input.Horarios)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao processar horário"})
		return
	}

	err = h.DB.Model(&models.Estabelecimento{}).
		Where("id = ?", auth.EstabelecimentoID(c)).
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
		Where("id = ?", auth.EstabelecimentoID(c)).
		Update("icones_padrao", datatypes.JSON(dados)).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar ícones"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"icones_padrao": icones})
}

type logoInput struct {
	Logo string `json:"logo"` // data URI (ex: "data:image/png;base64,..."); "" remove a logo
}

// AtualizarLogo troca a logo do estabelecimento, guardada como data URI
// direto no banco (v1 não precisa de um serviço de storage à parte pra isso).
func (h *EstabelecimentoHandler) AtualizarLogo(c *gin.Context) {
	var input logoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validarImagemBase64(c, input.Logo) {
		return
	}

	err := h.DB.Model(&models.Estabelecimento{}).
		Where("id = ?", auth.EstabelecimentoID(c)).
		Update("logo", input.Logo).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar logo"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logo": input.Logo})
}

type avisoInput struct {
	Ativo    bool   `json:"ativo"`
	Texto    string `json:"texto"`
	CorTexto string `json:"cor_texto"`
	CorFundo string `json:"cor_fundo"`
}

// corHexValida aceita "#RGB" ou "#RRGGBB"; string vazia também é válida —
// significa "sem cor customizada, usar o visual padrão".
var corHexValida = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

// AtualizarAviso liga/desliga, edita o texto e as cores (opcionais) do
// aviso/anúncio chamativo que aparece como uma faixa no topo da página
// pública — nunca bloqueia o agendamento, o cliente pode fechá-la.
func (h *EstabelecimentoHandler) AtualizarAviso(c *gin.Context) {
	var input avisoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	corTexto := strings.TrimSpace(input.CorTexto)
	corFundo := strings.TrimSpace(input.CorFundo)
	if corTexto != "" && !corHexValida.MatchString(corTexto) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cor de texto inválida"})
		return
	}
	if corFundo != "" && !corHexValida.MatchString(corFundo) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cor de fundo inválida"})
		return
	}

	texto := strings.TrimSpace(input.Texto)
	ativo := input.Ativo && texto != ""
	err := h.DB.Model(&models.Estabelecimento{}).
		Where("id = ?", auth.EstabelecimentoID(c)).
		Updates(map[string]any{
			"aviso_ativo":     ativo,
			"aviso_texto":     texto,
			"aviso_cor_texto": corTexto,
			"aviso_cor_fundo": corFundo,
		}).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar aviso"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"aviso_ativo": ativo, "aviso_texto": texto,
		"aviso_cor_texto": corTexto, "aviso_cor_fundo": corFundo,
	})
}
