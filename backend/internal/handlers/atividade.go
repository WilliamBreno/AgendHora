package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

// registrarAtividade grava uma linha no histórico que o dono vê na tela
// Equipe (ver CLAUDE.md "Histórico de atividades") — chamada síncrona (é só
// um insert local, não justifica goroutine) logo após a ação principal já
// ter sido confirmada com sucesso. Um erro aqui nunca deve derrubar a
// resposta da ação principal — só loga e segue.
func registrarAtividade(db *gorm.DB, estabelecimentoID, usuarioID uint, acao models.AcaoAtividade, descricao string) {
	registro := models.RegistroAtividade{
		EstabelecimentoID: estabelecimentoID,
		UsuarioID:         usuarioID,
		Acao:              acao,
		Descricao:         descricao,
	}
	if err := db.Create(&registro).Error; err != nil {
		log.Printf("erro ao registrar atividade (%s, estabelecimento %d): %v", acao, estabelecimentoID, err)
	}
}

type AtividadeHandler struct {
	DB *gorm.DB
}

func NewAtividadeHandler(db *gorm.DB) *AtividadeHandler {
	return &AtividadeHandler{DB: db}
}

// limiteAtividades é quantos registros mais recentes a tela Equipe mostra —
// histórico simples, não uma tela de auditoria paginada.
const limiteAtividades = 100

// List devolve as atividades mais recentes do estabelecimento — só o dono
// acessa (ver auth.ExigirDono no router), mesma regra de Equipe, já que é
// uma extensão daquela tela.
func (h *AtividadeHandler) List(c *gin.Context) {
	var registros []models.RegistroAtividade
	err := h.DB.Preload("Usuario").
		Where("estabelecimento_id = ?", auth.EstabelecimentoID(c)).
		Order("created_at desc").
		Limit(limiteAtividades).
		Find(&registros).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro ao listar atividades"})
		return
	}
	c.JSON(http.StatusOK, registros)
}
