// Package slug gera identificadores de URL para Estabelecimento
// (ex: "Salão da Maria" -> "salao-da-maria"), usado tanto no cadastro de
// empresas novas quanto na migração de dados antigos que não tinham slug.
package slug

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"

	"agendamento/backend/internal/models"
)

var (
	regexNaoAlfanumerico = regexp.MustCompile(`[^a-z0-9]+`)
	regexHifensRepetidos = regexp.MustCompile(`-+`)
)

// reservadas são caminhos fixos do frontend (rotas de login, admin etc) —
// uma empresa não pode ficar com um desses slugs, senão a URL colide com
// uma rota do próprio app.
var reservadas = map[string]bool{
	"admin": true, "login": true, "registro": true, "cadastro": true,
	"api": true, "app": true, "www": true, "estabelecimento": true,
}

func removerAcentos(s string) string {
	substituicoes := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c", "ñ", "n",
	)
	return substituicoes.Replace(s)
}

// GerarBase normaliza um nome de estabelecimento para um pedaço de URL:
// minúsculo, sem acento, espaços/pontuação viram hífen.
func GerarBase(nome string) string {
	semAcento := removerAcentos(strings.ToLower(nome))
	slug := regexNaoAlfanumerico.ReplaceAllString(semAcento, "-")
	slug = regexHifensRepetidos.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "estabelecimento"
	}
	return slug
}

// GerarUnico garante que o slug não colide com nenhum já cadastrado,
// acrescentando -2, -3... se precisar.
func GerarUnico(db *gorm.DB, nome string) (string, error) {
	base := GerarBase(nome)
	candidato := base
	for sufixo := 2; ; sufixo++ {
		if !reservadas[candidato] {
			var quantidade int64
			if err := db.Model(&models.Estabelecimento{}).Where("slug = ?", candidato).Count(&quantidade).Error; err != nil {
				return "", err
			}
			if quantidade == 0 {
				return candidato, nil
			}
		}
		candidato = fmt.Sprintf("%s-%d", base, sufixo)
	}
}
