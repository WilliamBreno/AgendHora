package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	authpkg "agendamento/backend/internal/auth"
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

// NewRouter monta as rotas da API. A plataforma é multi-empresa: rotas /admin
// exigem JWT (o dono logado) e resolvem a empresa a partir do token; rotas
// /publico/:slug não exigem login e resolvem a empresa pela URL — é o link
// que cada dono compartilha com os próprios clientes.
func NewRouter(db *gorm.DB, jwtSecret string, notificador *notifications.Notificador, origensExtras []string) *gin.Engine {
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

	gerenciador := authpkg.NovoGerenciador(jwtSecret)

	authHandler := handlers.NewAuthHandler(db, gerenciador)
	servicoHandler := handlers.NewServicoHandler(db)
	estabelecimentoHandler := handlers.NewEstabelecimentoHandler(db)
	agendamentoHandler := handlers.NewAgendamentoHandler(db, notificador)
	disponibilidadeHandler := handlers.NewDisponibilidadeHandler(db)
	dashboardHandler := handlers.NewDashboardHandler(db)

	apiGroup := router.Group("/api")
	{
		authGroup := apiGroup.Group("/auth")
		{
			authGroup.POST("/registro", authHandler.Registro)
			authGroup.POST("/login", authHandler.Login)
		}

		admin := apiGroup.Group("/admin")
		admin.Use(authpkg.Middleware(gerenciador))
		{
			admin.GET("/servicos", servicoHandler.List)
			admin.POST("/servicos", servicoHandler.Create)
			admin.GET("/servicos/:id", servicoHandler.Get)
			admin.PUT("/servicos/:id", servicoHandler.Update)
			admin.DELETE("/servicos/:id", servicoHandler.Delete)

			admin.GET("/estabelecimento", estabelecimentoHandler.Get)
			admin.PUT("/estabelecimento", estabelecimentoHandler.AtualizarDados)
			admin.PUT("/estabelecimento/icones", estabelecimentoHandler.AtualizarIcones)
			admin.PUT("/estabelecimento/horario", estabelecimentoHandler.AtualizarHorario)
			admin.PUT("/estabelecimento/logo", estabelecimentoHandler.AtualizarLogo)

			admin.GET("/agendamentos", agendamentoHandler.List)
			admin.POST("/agendamentos", agendamentoHandler.Create)
			admin.GET("/agendamentos/:id", agendamentoHandler.Get)
			admin.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.Cancelar)

			admin.GET("/disponibilidade", disponibilidadeHandler.Listar)

			admin.GET("/dashboard", dashboardHandler.Get)
		}

		publico := apiGroup.Group("/publico/:slug")
		publico.Use(handlers.SlugMiddleware(db))
		{
			publico.GET("/estabelecimento", estabelecimentoHandler.GetPublico)
			publico.GET("/servicos", servicoHandler.List)
			publico.GET("/disponibilidade", disponibilidadeHandler.Listar)

			publico.POST("/agendamentos", agendamentoHandler.CreatePublico)
			publico.GET("/meus-agendamentos", agendamentoHandler.MeusAgendamentos)
			publico.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.CancelarPublico)
		}
	}

	return router
}
