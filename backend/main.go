package main

import (
	"log"

	"agendamento/backend/internal/api"
	"agendamento/backend/internal/config"
	"agendamento/backend/internal/database"
	"agendamento/backend/internal/notifications"
)

func main() {
	cfg := config.Load()

	db := database.Connect(cfg.DatabaseURL)
	database.Migrate(db)
	estabelecimentoID := database.EnsureEstabelecimentoPadrao(db)

	notificador := notifications.New(cfg.ResendAPIKey, cfg.ResendFrom)

	router := api.NewRouter(db, estabelecimentoID, notificador, cfg.AllowedOrigins)

	log.Printf("servidor rodando na porta %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("erro ao iniciar servidor: %v", err)
	}
}
