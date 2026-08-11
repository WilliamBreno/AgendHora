package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"agendamento/backend/internal/models"
)

// MensagemContaInativa é o texto amigável mostrado quando o estabelecimento
// está com o acesso bloqueado por inadimplência — nunca um erro técnico.
// Compartilhado entre o bloqueio de login e o de sessão já aberta (ver
// ExigirEstabelecimentoAtivo) pra manter a mesma redação nos dois casos.
const MensagemContaInativa = "Sua conta está temporariamente indisponível. Entre em contato pra regularizar o pagamento e voltar a usar o sistema."

const (
	ctxUsuarioID = "usuario_id"
	ctxPapel     = "papel"
	// CtxEstabelecimentoID é a chave de contexto compartilhada: tanto o
	// Middleware (rotas admin, via JWT) quanto o SlugMiddleware das rotas
	// públicas (ver internal/handlers) gravam o ID da empresa aqui, então
	// os handlers leem sempre do mesmo jeito com EstabelecimentoID(c).
	CtxEstabelecimentoID = "estabelecimento_id"
)

// Middleware exige um JWT válido (área admin) e expõe usuario_id/estabelecimento_id
// no contexto da request — é assim que os handlers sabem de qual empresa é o dado,
// em vez de um ID fixo como na v1 mono-estabelecimento.
func Middleware(gerenciador *Gerenciador) gin.HandlerFunc {
	return func(c *gin.Context) {
		cabecalho := c.GetHeader("Authorization")
		if cabecalho == "" || !strings.HasPrefix(cabecalho, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
			return
		}

		claims, err := gerenciador.ValidarToken(strings.TrimPrefix(cabecalho, "Bearer "))
		if err != nil || claims.Escopo == escopoPlataforma {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sessão inválida ou expirada"})
			return
		}

		c.Set(ctxUsuarioID, claims.UsuarioID)
		c.Set(CtxEstabelecimentoID, claims.EstabelecimentoID)
		c.Set(ctxPapel, claims.Papel)
		c.Next()
	}
}

// MiddlewarePlataforma exige um token de plataforma válido — completamente
// isolado do Middleware normal (token diferente, sem usuario_id nem
// estabelecimento_id no contexto). Usado só nas rotas de gerenciar a lista
// de EmailIsento (ver "Isenção de pagamento" no CLAUDE.md).
func MiddlewarePlataforma(gerenciador *Gerenciador) gin.HandlerFunc {
	return func(c *gin.Context) {
		cabecalho := c.GetHeader("Authorization")
		if cabecalho == "" || !strings.HasPrefix(cabecalho, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
			return
		}
		if _, err := gerenciador.ValidarTokenPlataforma(strings.TrimPrefix(cabecalho, "Bearer ")); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sessão inválida ou expirada"})
			return
		}
		c.Next()
	}
}

// ExigirEstabelecimentoAtivo expulsa sessões de estabelecimentos com
// `ativo = false` — não basta bloquear o login: um JWT emitido antes da
// inadimplência continua válido normalmente (é stateless), então essa
// checagem roda a cada request admin, depois de Middleware, pra garantir
// que uma sessão já aberta perde o acesso assim que o campo muda no banco.
// Devolve 402 (não 401/403) de propósito — é um status só dela, que o
// frontend usa pra distinguir "sem permissão" de "conta inativa" e mostrar
// a mensagem certa em vez de simplesmente deslogar em silêncio.
func ExigirEstabelecimentoAtivo(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var estabelecimento models.Estabelecimento
		err := db.Select("id", "ativo", "isento", "isento_ate").First(&estabelecimento, EstabelecimentoID(c)).Error
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "erro ao verificar estabelecimento"})
			return
		}
		if estabelecimento.Bloqueado() {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{"error": MensagemContaInativa})
			return
		}
		c.Next()
	}
}

// ExigirDono bloqueia rotas que só o dono do estabelecimento pode usar (ex:
// convidar profissional auxiliar, editar Configurações) — um auxiliar
// autenticado recebe 403. Deve vir depois de Middleware no grupo de rotas.
func ExigirDono() gin.HandlerFunc {
	return func(c *gin.Context) {
		if Papel(c) != models.PapelDono {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "só o dono do estabelecimento pode fazer isso"})
			return
		}
		c.Next()
	}
}

// EstabelecimentoID lê o ID já validado pelo Middleware.
func EstabelecimentoID(c *gin.Context) uint {
	return c.MustGet(CtxEstabelecimentoID).(uint)
}

// UsuarioID lê o ID do usuário logado, já validado pelo Middleware.
func UsuarioID(c *gin.Context) uint {
	return c.MustGet(ctxUsuarioID).(uint)
}

// Papel lê o papel (dono/auxiliar) do usuário logado, já validado pelo Middleware.
func Papel(c *gin.Context) models.PapelUsuario {
	return c.MustGet(ctxPapel).(models.PapelUsuario)
}
