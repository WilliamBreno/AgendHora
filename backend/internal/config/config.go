package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	Port               string
	BrevoAPIKey        string
	EmailRemetenteNome string
	EmailRemetente     string
	AllowedOrigins     []string
	JWTSecret          string
	FrontendURL        string
	// BackendURL é a URL pública deste próprio backend — usada só pra montar
	// o webhook_url mandado à InfinitePay na criação do link de pagamento
	// (ver internal/handlers.PagamentoHandler). Em dev, localhost não é
	// alcançável pela InfinitePay — o webhook simplesmente não chega, mas o
	// botão "já paguei, verificar" continua funcionando normalmente.
	BackendURL string
	// PlataformaSenha é a credencial única do login de plataforma (uso
	// pessoal do dono do projeto — ver "Isenção de pagamento" no
	// CLAUDE.md). Vazia desliga o recurso — não tem cadastro público nem
	// fluxo de recuperação, só essa variável de ambiente.
	PlataformaSenha string
	// InfinitePayHandle é a InfiniteTag (handle, sem o "$") do recebedor —
	// única credencial que a API pública de Checkout Integrado exige (ver
	// internal/infinitepay). Vazia desliga a geração automática de link de
	// pagamento; o cadastro continua funcionando, só nasce sem link.
	InfinitePayHandle string
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

	emailRemetenteNome := os.Getenv("EMAIL_REMETENTE_NOME")
	if emailRemetenteNome == "" {
		emailRemetenteNome = "AgendHora"
	}
	emailRemetente := os.Getenv("EMAIL_REMETENTE")
	if emailRemetente == "" {
		emailRemetente = "no-reply@agendhora.com.br"
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

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:" + port
	}

	plataformaSenha := os.Getenv("PLATFORM_ADMIN_SENHA")
	if plataformaSenha == "" {
		log.Println("aviso: PLATFORM_ADMIN_SENHA não definida — login de plataforma desligado")
	}

	infinitePayHandle := os.Getenv("INFINITEPAY_HANDLE")
	if infinitePayHandle == "" {
		log.Println("aviso: INFINITEPAY_HANDLE não definida — geração automática de link de pagamento desligada")
	}

	return Config{
		DatabaseURL:        dbURL,
		Port:               port,
		BrevoAPIKey:        os.Getenv("BREVO_API_KEY"),
		EmailRemetenteNome: emailRemetenteNome,
		EmailRemetente:     emailRemetente,
		AllowedOrigins:     origensExtras,
		JWTSecret:          jwtSecret,
		FrontendURL:        frontendURL,
		BackendURL:         backendURL,
		PlataformaSenha:    plataformaSenha,
		InfinitePayHandle:  infinitePayHandle,
	}
}
