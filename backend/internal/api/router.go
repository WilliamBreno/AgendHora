package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/handlers"
	"agendamento/backend/internal/notifications"
)

// permitirOrigem libera as origens fixas de dev, qualquer origensExtras vinda
// de ALLOWED_ORIGINS (produção) e qualquer subdomínio *.vercel.app — o Vercel
// gera uma URL nova por preview/branch, então não dá pra fixar uma lista.
func permitirOrigem(origensExtras []string) func(origin string) bool {
	fixas := map[string]bool{
		"http://localhost:5173": true,
		"http://localhost:5174": true,
	}
	for _, o := range origensExtras {
		fixas[o] = true
	}
	return func(origin string) bool {
		if fixas[origin] {
			return true
		}
		return strings.HasPrefix(origin, "https://") && strings.HasSuffix(origin, ".vercel.app")
	}
}

// NewRouter monta as rotas da API. estabelecimentoID é fixo porque a v1 é
// mono-estabelecimento (ver CLAUDE.md) — não há ainda autenticação/JWT
// resolvendo isso por request.
func NewRouter(db *gorm.DB, estabelecimentoID uint, notificador *notifications.Notificador, origensExtras []string) *gin.Engine {
	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOriginFunc:  permitirOrigem(origensExtras),
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
	agendamentoHandler := handlers.NewAgendamentoHandler(db, estabelecimentoID, notificador)
	disponibilidadeHandler := handlers.NewDisponibilidadeHandler(db, estabelecimentoID)

	apiGroup := router.Group("/api")
	{
		apiGroup.GET("/servicos", servicoHandler.List)
		apiGroup.POST("/servicos", servicoHandler.Create)
		apiGroup.GET("/servicos/:id", servicoHandler.Get)
		apiGroup.PUT("/servicos/:id", servicoHandler.Update)
		apiGroup.DELETE("/servicos/:id", servicoHandler.Delete)

		apiGroup.GET("/estabelecimento", estabelecimentoHandler.Get)
		apiGroup.PUT("/estabelecimento", estabelecimentoHandler.AtualizarDados)
		apiGroup.PUT("/estabelecimento/icones", estabelecimentoHandler.AtualizarIcones)
		apiGroup.PUT("/estabelecimento/horario", estabelecimentoHandler.AtualizarHorario)

		apiGroup.GET("/agendamentos", agendamentoHandler.List)
		apiGroup.POST("/agendamentos", agendamentoHandler.Create)
		apiGroup.GET("/agendamentos/:id", agendamentoHandler.Get)
		apiGroup.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.Cancelar)

		apiGroup.GET("/disponibilidade", disponibilidadeHandler.Listar)
	}

	return router
}
