package main

import (
	"log"

	"agendamento/backend/internal/api"
	"agendamento/backend/internal/config"
	"agendamento/backend/internal/database"
	"agendamento/backend/internal/handlers"
	"agendamento/backend/internal/infinitepay"
	"agendamento/backend/internal/lembretes"
	"agendamento/backend/internal/notifications"
	"agendamento/backend/internal/reagendamento"
	"agendamento/backend/internal/renovacao"
	"agendamento/backend/internal/resumosemanal"
)

func main() {
	cfg := config.Load()

	db := database.Connect(cfg.DatabaseURL)
	database.Migrate(db)
	database.MigrarSlugsLegados(db)
	database.MigrarProfissionais(db)
	database.MigrarClientes(db)

	notificador := notifications.New(cfg.BrevoAPIKey, cfg.EmailRemetenteNome, cfg.EmailRemetente)
	lembretes.Iniciar(db, notificador)

	infinitePayCliente := infinitepay.New(cfg.InfinitePayHandle)
	pagamentoHandler := handlers.NewPagamentoHandler(db, infinitePayCliente, cfg.FrontendURL, cfg.BackendURL)
	renovacao.Iniciar(db, notificador, pagamentoHandler)
	resumosemanal.Iniciar(db, notificador)
	reagendamento.Iniciar(db, notificador, cfg.FrontendURL)

	router := api.NewRouter(db, cfg.JWTSecret, notificador, cfg.AllowedOrigins, cfg.FrontendURL, cfg.PlataformaSenha, pagamentoHandler)

	log.Printf("servidor rodando na porta %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("erro ao iniciar servidor: %v", err)
	}
}
