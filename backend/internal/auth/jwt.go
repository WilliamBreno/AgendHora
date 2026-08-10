package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"agendamento/backend/internal/models"
)

type Claims struct {
	UsuarioID         uint                `json:"usuario_id"`
	EstabelecimentoID uint                `json:"estabelecimento_id"`
	Papel             models.PapelUsuario `json:"papel"`
	// Escopo fica vazio em todo token admin de verdade (GerarToken nunca
	// preenche) — existe só pra Middleware conseguir rejeitar um token de
	// plataforma que, sem essa checagem, passaria pelo parse aqui também
	// (mesmo segredo, campos em comum) com usuario_id/estabelecimento_id
	// zerados. Ver ClaimsPlataforma/MiddlewarePlataforma.
	Escopo string `json:"escopo,omitempty"`
	jwt.RegisteredClaims
}

// ClaimsPlataforma é o token do login de plataforma (uso pessoal do dono do
// projeto — ver "Isenção de pagamento" no CLAUDE.md): uma credencial única
// via variável de ambiente, sem usuario_id/estabelecimento_id/papel — não
// tem relação nenhuma com uma conta de Usuario/Estabelecimento. O campo
// Escopo é checado nos dois sentidos (ver Middleware e MiddlewarePlataforma)
// pra garantir que um token não é aceito no lugar do outro, mesmo os dois
// sendo assinados com o mesmo segredo.
type ClaimsPlataforma struct {
	Escopo string `json:"escopo"`
	jwt.RegisteredClaims
}

const escopoPlataforma = "plataforma"

type Gerenciador struct {
	segredo []byte
}

func NovoGerenciador(segredo string) *Gerenciador {
	return &Gerenciador{segredo: []byte(segredo)}
}

// GerarToken cria uma sessão de 30 dias para o usuário no seu estabelecimento.
// O papel vai embutido no token pra middleware e handlers saberem, sem ida
// extra ao banco, se quem está logado é o dono ou um profissional auxiliar
// (que tem acesso restrito — ver auth.ExigirDono).
func (g *Gerenciador) GerarToken(usuarioID, estabelecimentoID uint, papel models.PapelUsuario) (string, error) {
	claims := Claims{
		UsuarioID:         usuarioID,
		EstabelecimentoID: estabelecimentoID,
		Papel:             papel,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(g.segredo)
}

func (g *Gerenciador) ValidarToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de assinatura inesperado")
		}
		return g.segredo, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}

// GerarTokenPlataforma cria a sessão do login de plataforma — dura só 12h
// (bem menos que os 30 dias do admin de estabelecimento) porque é uma
// credencial sensível de uso pessoal, sem MFA nem recuperação de senha.
func (g *Gerenciador) GerarTokenPlataforma() (string, error) {
	claims := ClaimsPlataforma{
		Escopo: escopoPlataforma,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(g.segredo)
}

func (g *Gerenciador) ValidarTokenPlataforma(tokenString string) (*ClaimsPlataforma, error) {
	claims := &ClaimsPlataforma{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de assinatura inesperado")
		}
		return g.segredo, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid || claims.Escopo != escopoPlataforma {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
