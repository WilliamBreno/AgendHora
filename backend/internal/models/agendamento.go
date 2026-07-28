package models

import "time"

type StatusAgendamento string

const (
	// StatusConfirmado é o estado padrão ao criar um agendamento (fluxo self-service,
	// sem aprovação do dono).
	StatusConfirmado StatusAgendamento = "confirmado"
	// StatusCancelado indica que o cliente ou o dono cancelou o agendamento.
	StatusCancelado StatusAgendamento = "cancelado"
	// StatusPendente não é usado no fluxo padrão da v1: fica reservado para o
	// interruptor futuro opcional de aprovação manual em Configurações.
	StatusPendente StatusAgendamento = "pendente"
)

// Agendamento é um horário reservado por um cliente final para um serviço.
type Agendamento struct {
	ID              uint   `gorm:"primaryKey" json:"id"`
	ClienteNome     string `gorm:"not null" json:"cliente_nome"`
	ClienteTelefone string `gorm:"not null" json:"cliente_telefone"`
	// ClienteEmail é opcional — sem ele não há como mandar o e-mail de
	// confirmação pro cliente, mas o agendamento continua válido normalmente
	// (a notificação pro dono não depende disso).
	ClienteEmail string    `json:"cliente_email"`
	ServicoID    uint      `gorm:"not null;index" json:"servico_id"`
	Servico      Servico   `json:"servico,omitempty"`
	Data         time.Time `gorm:"type:date;not null;index" json:"data"`
	// Hora fica no formato "HH:MM" (24h) para evitar problemas de fuso horário.
	Hora        string            `gorm:"not null" json:"hora"`
	Status      StatusAgendamento `gorm:"type:varchar(20);not null;default:confirmado;index" json:"status"`
	Observacoes string            `json:"observacoes"`
	// Encaixe marca um agendamento criado deliberadamente por cima de outro já
	// existente no mesmo horário — uma decisão manual do dono no painel admin,
	// não o comportamento padrão. A checagem de conflito continua bloqueando
	// por padrão; isso só fica marcado quando ela foi explicitamente ignorada.
	Encaixe           bool `gorm:"not null;default:false" json:"encaixe"`
	EstabelecimentoID uint `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
