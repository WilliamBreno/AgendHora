package models

import "time"

// DuracoesIsencaoValidas são as únicas durações aceitas ao cadastrar um
// e-mail isento — 7/15/30 dias de acesso liberado, ou nil pra "sempre"
// (isenção permanente, sem data de vencimento).
var DuracoesIsencaoValidas = []int{7, 15, 30}

// EmailIsento é uma lista global (não pertence a nenhum estabelecimento)
// gerenciada só pelo dono do projeto — e-mails cadastrados aqui nascem com
// Estabelecimento.Ativo=true e Isento=true ao se cadastrarem em /cadastro,
// pulando a tela de instrução de pagamento (ver handlers.Registro).
type EmailIsento struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// Email normalizado (minúsculo, sem espaço) — ver handlers.normalizarEmail.
	Email string `gorm:"uniqueIndex;not null" json:"email"`
	// DuracaoDias é por quantos dias o acesso fica liberado a partir do
	// cadastro — nil significa "sempre" (isenção permanente). Usado só na
	// hora do cadastro pra calcular Estabelecimento.IsentoAte; depois disso
	// não afeta mais nada (mudar aqui não muda quem já se cadastrou).
	DuracaoDias *int `json:"duracao_dias"`
	// EstabelecimentoID fica nulo até o e-mail ser de fato usado num
	// cadastro — depois disso, aponta pra quem usou (útil só pra
	// referência/histórico; a isenção em si já foi aplicada no Estabelecimento).
	EstabelecimentoID *uint           `json:"estabelecimento_id"`
	Estabelecimento   Estabelecimento `json:"estabelecimento,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}
