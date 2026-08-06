package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"agendamento/backend/internal/models"
)

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
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sessão inválida ou expirada"})
			return
		}

		c.Set(ctxUsuarioID, claims.UsuarioID)
		c.Set(CtxEstabelecimentoID, claims.EstabelecimentoID)
		c.Set(ctxPapel, claims.Papel)
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
