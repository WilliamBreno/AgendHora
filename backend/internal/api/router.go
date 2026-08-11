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
func NewRouter(db *gorm.DB, jwtSecret string, notificador *notifications.Notificador, origensExtras []string, frontendURL string, plataformaSenha string) *gin.Engine {
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
	profissionalHandler := handlers.NewProfissionalHandler(db, gerenciador, notificador, frontendURL)
	usuarioHandler := handlers.NewUsuarioHandler(db)
	bloqueioHandler := handlers.NewBloqueioHandler(db)
	clienteHandler := handlers.NewClienteHandler(db)
	plataformaHandler := handlers.NewPlataformaHandler(db, gerenciador, plataformaSenha)

	apiGroup := router.Group("/api")
	{
		authGroup := apiGroup.Group("/auth")
		{
			authGroup.POST("/registro", authHandler.Registro)
			authGroup.POST("/login", authHandler.Login)
		}

		// /convites não fica sob /admin (quem acessa ainda não tem conta) nem
		// sob /publico/:slug (o token já identifica a empresa sozinho).
		conviteGroup := apiGroup.Group("/convites")
		{
			conviteGroup.GET("/:token", profissionalHandler.VerConvite)
			conviteGroup.POST("/:token/aceitar", profissionalHandler.AceitarConvite)
		}

		admin := apiGroup.Group("/admin")
		admin.Use(authpkg.Middleware(gerenciador))
		admin.Use(authpkg.ExigirEstabelecimentoAtivo(db))
		{
			admin.GET("/sessao", authHandler.Sessao)

			admin.GET("/servicos", servicoHandler.List)
			admin.POST("/servicos", servicoHandler.Create)
			admin.GET("/servicos/:id", servicoHandler.Get)
			admin.PUT("/servicos/:id", servicoHandler.Update)
			admin.DELETE("/servicos/:id", servicoHandler.Delete)

			// GET fica liberado pro auxiliar (precisa dos ícones/dados básicos
			// pra usar Serviços); as edições são só do dono — é o que fica de
			// fora do que o auxiliar acessa (não existe "área de configurações"
			// pra ele).
			admin.GET("/estabelecimento", estabelecimentoHandler.Get)
			admin.PUT("/estabelecimento", authpkg.ExigirDono(), estabelecimentoHandler.AtualizarDados)
			admin.PUT("/estabelecimento/icones", authpkg.ExigirDono(), estabelecimentoHandler.AtualizarIcones)
			admin.PUT("/estabelecimento/horario", authpkg.ExigirDono(), estabelecimentoHandler.AtualizarHorario)
			admin.PUT("/estabelecimento/logo", authpkg.ExigirDono(), estabelecimentoHandler.AtualizarLogo)
			admin.PUT("/estabelecimento/aviso", authpkg.ExigirDono(), estabelecimentoHandler.AtualizarAviso)

			// só o dono convida/vê a equipe — um auxiliar não pode cadastrar
			// outro profissional.
			admin.GET("/profissionais", authpkg.ExigirDono(), profissionalHandler.Listar)
			admin.POST("/profissionais/convidar", authpkg.ExigirDono(), profissionalHandler.Convidar)

			// cada profissional (dono ou auxiliar) edita só o próprio horário
			// de trabalho + intervalo de descanso.
			admin.PUT("/usuario/horario", usuarioHandler.AtualizarHorario)

			admin.GET("/agendamentos", agendamentoHandler.List)
			admin.POST("/agendamentos", agendamentoHandler.Create)
			admin.GET("/agendamentos/:id", agendamentoHandler.Get)
			admin.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.Cancelar)
			admin.PATCH("/agendamentos/:id/pago", agendamentoHandler.AtualizarPago)
			admin.PATCH("/agendamentos/:id/reagendar", agendamentoHandler.Reagendar)

			admin.GET("/disponibilidade", disponibilidadeHandler.Listar)

			// tela simples pro dono marcar um período indisponível (folga,
			// almoço, feriado) — entra no cálculo de disponibilidade acima.
			admin.GET("/bloqueios", authpkg.ExigirDono(), bloqueioHandler.List)
			admin.POST("/bloqueios", authpkg.ExigirDono(), bloqueioHandler.Create)
			admin.DELETE("/bloqueios/:id", authpkg.ExigirDono(), bloqueioHandler.Delete)

			admin.GET("/dashboard", dashboardHandler.Get)
			admin.GET("/dashboard/csv", dashboardHandler.CSV)
			admin.GET("/dashboard/xlsx", dashboardHandler.XLSX)
			admin.GET("/dashboard/pdf", dashboardHandler.PDF)

			// clientes já atendidos (criados automaticamente a cada
			// agendamento) + cadastro manual e importação em lote.
			admin.GET("/clientes", clienteHandler.List)
			admin.POST("/clientes", clienteHandler.Create)
			admin.PUT("/clientes/:id", clienteHandler.Update)
			admin.POST("/clientes/importar", clienteHandler.Importar)
		}

		publico := apiGroup.Group("/publico/:slug")
		publico.Use(handlers.SlugMiddleware(db))
		{
			publico.GET("/estabelecimento", estabelecimentoHandler.GetPublico)
			publico.GET("/servicos", servicoHandler.List)
			publico.GET("/profissionais", profissionalHandler.ListarPublico)
			publico.GET("/disponibilidade", disponibilidadeHandler.Listar)

			publico.POST("/agendamentos", agendamentoHandler.CreatePublico)
			publico.GET("/meus-agendamentos", agendamentoHandler.MeusAgendamentos)
			publico.PATCH("/agendamentos/:id/cancelar", agendamentoHandler.CancelarPublico)
		}

		// /plataforma é de uso pessoal do dono do projeto (ver CLAUDE.md
		// "Isenção de pagamento") — login próprio, credencial única via
		// variável de ambiente, sem relação nenhuma com o login de
		// Usuario/Estabelecimento (nem token nem rota são compartilhados).
		plataforma := apiGroup.Group("/plataforma")
		{
			plataforma.POST("/login", plataformaHandler.Login)

			protegido := plataforma.Group("")
			protegido.Use(authpkg.MiddlewarePlataforma(gerenciador))
			{
				protegido.GET("/emails-isentos", plataformaHandler.ListarEmailsIsentos)
				protegido.POST("/emails-isentos", plataformaHandler.AdicionarEmailIsento)
				protegido.DELETE("/emails-isentos/:id", plataformaHandler.RemoverEmailIsento)
			}
		}
	}

	return router
}
