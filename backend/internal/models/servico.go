package models

import "time"

// CoresServico é a paleta fixa de 6 cores disponíveis para identificar um serviço.
// Não são livres: isso é o que mantém a agenda organizada e legível (ver CLAUDE.md).
var CoresServico = []string{
	"teal",         // #0C7C71
	"coral",        // #E1614A
	"violeta",      // #7C6FC4
	"ambar",        // #D69A34
	"verde-salvia", // #5A9367
	"rosa",         // #C4638A
}

// Servico é um serviço oferecido pelo estabelecimento (ex: corte, manicure, massagem).
type Servico struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Nome string `gorm:"not null" json:"nome"`
	// Preco é opcional — nil (sem preço cadastrado) faz a página pública
	// mostrar "a combinar" no lugar do valor. Útil pra estabelecimentos com
	// lógica de preço variável por atendimento (ex: segmento "tatuagem" —
	// ver CLAUDE.md "Segmentos de negócio"), mas não é exclusivo de nenhum
	// segmento.
	Preco *float64 `json:"preco"`
	// PrecoAPartir marca o preço como uma estimativa mínima ("a partir de
	// R$X"), pra serviços cujo valor final varia (ex: depende do cabelo,
	// do procedimento escolhido na hora etc) — só faz sentido quando Preco
	// não é nil.
	PrecoAPartir bool `gorm:"not null;default:false" json:"preco_a_partir"`
	DuracaoMin   int  `gorm:"not null" json:"duracao_min"`
	// DuracaoMaxMin é opcional — quando preenchido, o serviço tem duração
	// variável (ex: "de 30 a 60 min"), e DuracaoMin vira o piso da faixa em
	// vez de uma duração fixa. nil = duração fixa, comportamento de sempre.
	DuracaoMaxMin *int   `json:"duracao_max_min"`
	Descricao     string `json:"descricao"`
	Cor           string `gorm:"not null" json:"cor"`
	Icone         string `json:"icone"`
	// Foto é opcional — uma imagem de exemplo do serviço, como data URI
	// base64, mostrada pro cliente final na página pública.
	Foto              string `json:"foto"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`

	// ProfissionalID é opcional — nil (padrão) é o comportamento de sempre:
	// serviço do catálogo geral, oferecido por qualquer profissional do
	// estabelecimento. Preenchido, o serviço é "individual": só existe pra
	// esse profissional específico, a página pública nem pergunta com quem
	// (o profissional já está implícito). Ver CLAUDE.md "Serviços
	// individuais".
	ProfissionalID *uint   `json:"profissional_id"`
	Profissional   Usuario `json:"profissional,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DuracaoEfetivaMin é a duração usada pra bloquear a agenda. Quando o
// serviço tem faixa (DuracaoMaxMin preenchido e maior que DuracaoMin), usa
// sempre o teto da faixa — nunca o mínimo — pra nunca dar conflito de
// horário mesmo se o atendimento acabar levando o tempo máximo. Só o
// profissional decide, na hora, quanto realmente levou; quando concluir
// antes pelo botão "Concluir agora", o resto do horário libera na hora, do
// mesmo jeito que já acontece pra duração fixa (ver CLAUDE.md "Duração
// variável de serviço" e "Encaixe de horários").
func (s Servico) DuracaoEfetivaMin() int {
	if s.DuracaoMaxMin != nil && *s.DuracaoMaxMin > s.DuracaoMin {
		return *s.DuracaoMaxMin
	}
	return s.DuracaoMin
}
