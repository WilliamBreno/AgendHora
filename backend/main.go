package main

import (
	"log"

	"agendamento/backend/internal/api"
	"agendamento/backend/internal/config"
	"agendamento/backend/internal/database"
	"agendamento/backend/internal/lembretes"
	"agendamento/backend/internal/notifications"
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

	router := api.NewRouter(db, cfg.JWTSecret, notificador, cfg.AllowedOrigins, cfg.FrontendURL, cfg.PlataformaSenha)

	log.Printf("servidor rodando na porta %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("erro ao iniciar servidor: %v", err)
	}
}
