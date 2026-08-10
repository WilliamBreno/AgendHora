package models

import "time"

// EmailIsento é uma lista global (não pertence a nenhum estabelecimento)
// gerenciada só pelo dono do projeto — e-mails cadastrados aqui nascem com
// Estabelecimento.Ativo=true e Isento=true ao se cadastrarem em /cadastro,
// pulando a tela de instrução de pagamento (ver handlers.Registro).
type EmailIsento struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// Email normalizado (minúsculo, sem espaço) — ver handlers.normalizarEmail.
	Email string `gorm:"uniqueIndex;not null" json:"email"`
	// EstabelecimentoID fica nulo até o e-mail ser de fato usado num
	// cadastro — depois disso, aponta pra quem usou (útil só pra
	// referência/histórico; a isenção em si já foi aplicada no Estabelecimento).
	EstabelecimentoID *uint           `json:"estabelecimento_id"`
	Estabelecimento   Estabelecimento `json:"estabelecimento,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}
