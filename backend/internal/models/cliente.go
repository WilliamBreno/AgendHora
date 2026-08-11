package models

import "time"

// Cliente nasce sozinho a cada novo agendamento (ver handlers.encontrarOuCriarCliente,
// que casa com um cliente já existente pelo telefone dentro do mesmo
// estabelecimento) — mas também pode ser cadastrado ou editado manualmente
// pelo dono na tela de Clientes (ver handlers.ClienteHandler), ou importado
// em lote via CSV/.vcf.
type Cliente struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Nome     string `gorm:"not null" json:"nome"`
	Telefone string `gorm:"not null;index" json:"telefone"`
	// Email é opcional — sem ele não há como mandar confirmação por e-mail,
	// mas o agendamento continua válido normalmente.
	Email string `json:"email"`
	// DataNascimento é opcional — guarda só dia/mês/ano (sem horário), usada
	// pro filtro de aniversariantes na tela de Clientes. Nula quando o
	// cliente nasceu de um agendamento (o formulário público não pede isso)
	// e ninguém preencheu manualmente depois.
	DataNascimento    *time.Time `gorm:"type:date" json:"data_nascimento"`
	EstabelecimentoID uint       `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
