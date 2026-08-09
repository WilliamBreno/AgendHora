package models

import "time"

// Cliente nunca tem cadastro manual — é criado/atualizado automaticamente a
// cada novo agendamento (ver handlers.encontrarOuCriarCliente), casando com
// um cliente já existente pelo telefone dentro do mesmo estabelecimento.
type Cliente struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Nome     string `gorm:"not null" json:"nome"`
	Telefone string `gorm:"not null;index" json:"telefone"`
	// Email é opcional — sem ele não há como mandar confirmação por e-mail,
	// mas o agendamento continua válido normalmente.
	Email             string `json:"email"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
