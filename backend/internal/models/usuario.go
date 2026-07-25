package models

import "time"

// Usuario é o administrador (dono do estabelecimento) que acessa a área autenticada.
type Usuario struct {
	ID                uint            `gorm:"primaryKey" json:"id"`
	Email             string          `gorm:"uniqueIndex;not null" json:"email"`
	SenhaHash         string          `gorm:"not null" json:"-"`
	EstabelecimentoID uint            `gorm:"not null;index" json:"estabelecimento_id"`
	Estabelecimento   Estabelecimento `json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
