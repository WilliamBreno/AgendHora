package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL    string
	Port           string
	ResendAPIKey   string
	ResendFrom     string
	AllowedOrigins []string
	JWTSecret      string
	FrontendURL    string
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
		resendFrom = "AgendHora <onboarding@resend.dev>"
	}

	var origensExtras []string
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origensExtras = append(origensExtras, o)
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET não definida")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	return Config{
		DatabaseURL:    dbURL,
		Port:           port,
		ResendAPIKey:   os.Getenv("RESEND_API_KEY"),
		ResendFrom:     resendFrom,
		AllowedOrigins: origensExtras,
		JWTSecret:      jwtSecret,
		FrontendURL:    frontendURL,
	}
}
