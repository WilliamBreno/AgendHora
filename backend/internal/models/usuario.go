package models

import (
	"time"

	"gorm.io/datatypes"
)

// PapelUsuario distingue o dono (acesso completo) do profissional auxiliar
// (acesso restrito — sem Configurações, sem poder convidar outros profissionais).
type PapelUsuario string

const (
	PapelDono     PapelUsuario = "dono"
	PapelAuxiliar PapelUsuario = "auxiliar"
)

// Usuario é quem acessa a área autenticada: o dono do estabelecimento ou um
// profissional auxiliar vinculado a ele. Cada Usuario é também um
// "profissional" agendável — Agendamento.ProfissionalID aponta pra cá.
type Usuario struct {
	ID uint `gorm:"primaryKey" json:"id"`
	// default:'' só existe pra permitir a migration adicionar a coluna numa
	// tabela com linhas existentes sem violar NOT NULL — database.MigrarProfissionais
	// preenche essas linhas antigas com um nome de fallback logo em seguida.
	Nome              string          `gorm:"not null;default:''" json:"nome"`
	Email             string          `gorm:"uniqueIndex;not null" json:"email"`
	Telefone          string          `json:"telefone"`
	SenhaHash         string          `gorm:"not null" json:"-"`
	Papel             PapelUsuario    `gorm:"type:varchar(20);not null;default:dono" json:"papel"`
	EstabelecimentoID uint            `gorm:"not null;index" json:"estabelecimento_id"`
	Estabelecimento   Estabelecimento `json:"-"`

	// HorarioTrabalho é o horário de trabalho + intervalo de descanso próprio
	// deste profissional. Só é usado de fato para PapelAuxiliar — o dono usa
	// Estabelecimento.HorarioFuncionamento (editado em Configurações, que só
	// ele acessa). Fica vazio até o auxiliar configurar o próprio horário
	// pela primeira vez (ver handlers.UsuarioHandler.AtualizarHorario).
	HorarioTrabalho datatypes.JSON `json:"horario_trabalho"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConviteProfissional é o convite que o dono envia por e-mail pra um
// profissional auxiliar se cadastrar. Não cria o Usuario na hora — só quando
// o profissional aceita o convite e define nome/senha (ver
// handlers.ConviteHandler).
type ConviteProfissional struct {
	ID                uint   `gorm:"primaryKey" json:"id"`
	Email             string `gorm:"not null;index" json:"email"`
	Telefone          string `json:"telefone"`
	Token             string `gorm:"uniqueIndex;not null" json:"-"`
	EstabelecimentoID uint   `gorm:"not null;index" json:"estabelecimento_id"`
	Usado             bool   `gorm:"not null;default:false" json:"usado"`

	CreatedAt time.Time `json:"created_at"`
}
