package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/handlers"
)

// NewRouter monta as rotas da API. estabelecimentoID é fixo porque a v1 é
// mono-estabelecimento (ver CLAUDE.md) — não há ainda autenticação/JWT
// resolvendo isso por request.
func NewRouter(db *gorm.DB, estabelecimentoID uint) *gin.Engine {
	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	servicoHandler := handlers.NewServicoHandler(db, estabelecimentoID)
	estabelecimentoHandler := handlers.NewEstabelecimentoHandler(db, estabelecimentoID)
	agendamentoHandler := handlers.NewAgendamentoHandler(db, estabelecimentoID)

	apiGroup := router.Group("/api")
	{
		apiGroup.GET("/servicos", servicoHandler.List)
		apiGroup.POST("/servicos", servicoHandler.Create)
		apiGroup.GET("/servicos/:id", servicoHandler.Get)
		apiGroup.PUT("/servicos/:id", servicoHandler.Update)
		apiGroup.DELETE("/servicos/:id", servicoHandler.Delete)

		apiGroup.GET("/estabelecimento", estabelecimentoHandler.Get)
		apiGroup.PUT("/estabelecimento/icones", estabelecimentoHandler.AtualizarIcones)

		apiGroup.GET("/agendamentos", agendamentoHandler.List)
		apiGroup.POST("/agendamentos", agendamentoHandler.Create)
		apiGroup.GET("/agendamentos/:id", agendamentoHandler.Get)
		apiGroup.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.Cancelar)
	}

	return router
}
