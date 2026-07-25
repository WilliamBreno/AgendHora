package main

import (
	"log"

	"agendamento/backend/internal/api"
	"agendamento/backend/internal/config"
	"agendamento/backend/internal/database"
)

func main() {
	cfg := config.Load()

	db := database.Connect(cfg.DatabaseURL)
	database.Migrate(db)
	estabelecimentoID := database.EnsureEstabelecimentoPadrao(db)

	router := api.NewRouter(db, estabelecimentoID)

	log.Printf("servidor rodando na porta %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("erro ao iniciar servidor: %v", err)
	}
}
