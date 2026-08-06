package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

type UsuarioHandler struct {
	DB *gorm.DB
}

func NewUsuarioHandler(db *gorm.DB) *UsuarioHandler {
	return &UsuarioHandler{DB: db}
}

// AtualizarHorario substitui o horário de trabalho + intervalo de descanso
// do PRÓPRIO usuário logado — cada profissional (dono ou auxiliar) tem sua
// própria agenda. É a peça que falta pro auxiliar, que não tem acesso a
// Configurações (onde fica o horário geral do estabelecimento).
func (h *UsuarioHandler) AtualizarHorario(c *gin.Context) {
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

	err = h.DB.Model(&models.Usuario{}).
		Where("id = ?", auth.UsuarioID(c)).
		Update("horario_trabalho", datatypes.JSON(dados)).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao atualizar horário"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"horario_trabalho": input.Horarios})
}
