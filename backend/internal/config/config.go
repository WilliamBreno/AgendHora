package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	Port         string
	ResendAPIKey string
	ResendFrom   string
}

// Load lê o .env (se existir) e as variáveis de ambiente do processo.
func Load() Config {
	if err := godotenv.Load(); err != nil {
		log.Println("aviso: .env não encontrado, usando variáveis de ambiente do sistema")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL não definida")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	resendFrom := os.Getenv("RESEND_FROM")
	if resendFrom == "" {
		resendFrom = "Agendamento <onboarding@resend.dev>"
	}

	return Config{
		DatabaseURL:  dbURL,
		Port:         port,
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		ResendFrom:   resendFrom,
	}
}
