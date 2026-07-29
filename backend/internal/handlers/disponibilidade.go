package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type DisponibilidadeHandler struct {
	DB *gorm.DB
}

func NewDisponibilidadeHandler(db *gorm.DB) *DisponibilidadeHandler {
	return &DisponibilidadeHandler{DB: db}
}

// passoMinutos é a granularidade dos horários candidatos gerados — não
// precisa ser igual à duração do serviço, só o bastante fino pra aproveitar
// buracos entre agendamentos existentes.
const passoMinutos = 15

func formatarMinutos(min int) string {
	return time.Date(0, 1, 1, min/60, min%60, 0, 0, time.UTC).Format("15:04")
}

// Listar calcula os horários livres de um serviço num dia, a partir do
// horário de funcionamento do estabelecimento naquele dia da semana e dos
// agendamentos confirmados já existentes.
func (h *DisponibilidadeHandler) Listar(c *gin.Context) {
	servicoID, err := strconv.ParseUint(c.Query("servico_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'servico_id' inválido"})
		return
	}
	data, err := time.Parse("2006-01-02", c.Query("data"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro 'data' inválido"})
		return
	}

	estabelecimentoID := auth.EstabelecimentoID(c)

	var servico models.Servico
	err = h.DB.Where("id = ? AND estabelecimento_id = ?", servicoID, estabelecimentoID).First(&servico).Error
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "serviço não encontrado"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar serviço"})
		return
	}

	var estabelecimento models.Estabelecimento
	if err := h.DB.First(&estabelecimento, estabelecimentoID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar estabelecimento"})
		return
	}

	var horarios models.HorarioFuncionamento
	if err := json.Unmarshal(estabelecimento.HorarioFuncionamento, &horarios); err != nil {
		horarios = models.HorarioFuncionamento{}
	}

	diaSemana := models.DiasSemana[int(data.Weekday())]
	horarioDia, configurado := horarios[diaSemana]
	if !configurado || horarioDia.Fechado {
		c.JSON(http.StatusOK, gin.H{"horarios": []string{}})
		return
	}

	abre, errAbre := minutosDoDia(horarioDia.Abre)
	fecha, errFecha := minutosDoDia(horarioDia.Fecha)
	if errAbre != nil || errFecha != nil || abre >= fecha {
		c.JSON(http.StatusOK, gin.H{"horarios": []string{}})
		return
	}

	ocupados, err := intervalosOcupados(h.DB, estabelecimentoID, data, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao verificar disponibilidade"})
		return
	}

	// hoje: não oferecer horário que já passou
	limiteHoje := -1
	agora := time.Now()
	if data.Year() == agora.Year() && data.YearDay() == agora.YearDay() {
		limiteHoje = agora.Hour()*60 + agora.Minute()
	}

	disponiveis := make([]string, 0)
	for inicio := abre; inicio+servico.DuracaoMin <= fecha; inicio += passoMinutos {
		if limiteHoje >= 0 && inicio <= limiteHoje {
			continue
		}
		fim := inicio + servico.DuracaoMin
		livre := true
		for _, o := range ocupados {
			if sobrepoe(inicio, fim, o.inicio, o.fim) {
				livre = false
				break
			}
		}
		if livre {
			disponiveis = append(disponiveis, formatarMinutos(inicio))
		}
	}

	c.JSON(http.StatusOK, gin.H{"horarios": disponiveis})
}
