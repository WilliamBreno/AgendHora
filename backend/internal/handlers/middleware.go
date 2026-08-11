package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/auth"
	"agendamento/backend/internal/models"
)

// SlugMiddleware resolve o estabelecimento a partir do :slug da URL — é
// assim que as rotas públicas (sem login, usadas pela página de agendamento
// do cliente) sabem de qual empresa é o pedido. Grava na mesma chave de
// contexto que auth.Middleware usa nas rotas admin, então os handlers leem
// o ID sempre da mesma forma (auth.EstabelecimentoID(c)), não importa a origem.
func SlugMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var estabelecimento models.Estabelecimento
		err := db.Where("slug = ?", c.Param("slug")).First(&estabelecimento).Error
		if err == gorm.ErrRecordNotFound {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "empresa não encontrada"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "erro ao buscar empresa"})
			return
		}
		if estabelecimento.Bloqueado() {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{"error": "Este estabelecimento está temporariamente indisponível para agendamentos."})
			return
		}
		c.Set(auth.CtxEstabelecimentoID, estabelecimento.ID)
		c.Set("estabelecimento", estabelecimento)
		c.Next()
	}
}
