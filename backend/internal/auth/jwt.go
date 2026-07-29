package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UsuarioID         uint `json:"usuario_id"`
	EstabelecimentoID uint `json:"estabelecimento_id"`
	jwt.RegisteredClaims
}

type Gerenciador struct {
	segredo []byte
}

func NovoGerenciador(segredo string) *Gerenciador {
	return &Gerenciador{segredo: []byte(segredo)}
}

// GerarToken cria uma sessão de 30 dias para o usuário no seu estabelecimento.
func (g *Gerenciador) GerarToken(usuarioID, estabelecimentoID uint) (string, error) {
	claims := Claims{
		UsuarioID:         usuarioID,
		EstabelecimentoID: estabelecimentoID,
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
