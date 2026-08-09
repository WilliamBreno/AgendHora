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
	ID uint `gorm:"primaryKey" json:"id"`
	// ClienteID identifica quem agendou — o Cliente é criado/atualizado
	// automaticamente a partir do nome/telefone/e-mail informados no
	// formulário (ver handlers.encontrarOuCriarCliente), nunca por cadastro
	// manual. default:0 só existe pra migration em cima de linhas
	// existentes (ver database.MigrarClientes, que preenche o valor real
	// em seguida a partir dos dados que já estavam gravados soltos aqui).
	ClienteID uint      `gorm:"not null;default:0;index" json:"cliente_id"`
	Cliente   Cliente   `json:"cliente,omitempty"`
	ServicoID uint      `gorm:"not null;index" json:"servico_id"`
	Servico   Servico   `json:"servico,omitempty"`
	Data      time.Time `gorm:"type:date;not null;index" json:"data"`
	// Hora fica no formato "HH:MM" (24h) para evitar problemas de fuso horário.
	Hora        string            `gorm:"not null" json:"hora"`
	Status      StatusAgendamento `gorm:"type:varchar(20);not null;default:confirmado;index" json:"status"`
	Observacoes string            `json:"observacoes"`
	// Pago é marcado manualmente pelo dono/profissional no painel de
	// detalhe — não tem relação com o Status (um agendamento pode estar
	// confirmado e ainda não pago, ex: pagamento na hora do atendimento).
	Pago bool `gorm:"not null;default:false" json:"pago"`
	// Encaixe marca um agendamento criado deliberadamente por cima de outro já
	// existente no mesmo horário — uma decisão manual do dono no painel admin,
	// não o comportamento padrão. A checagem de conflito continua bloqueando
	// por padrão; isso só fica marcado quando ela foi explicitamente ignorada.
	Encaixe bool `gorm:"not null;default:false" json:"encaixe"`
	// LembreteEnviado controla se o lembrete automático por e-mail (ver
	// internal/lembretes) já foi disparado pra esse agendamento — evita
	// reenviar a cada checagem do cron enquanto o horário ainda está dentro
	// da janela de antecedência do lembrete.
	LembreteEnviado bool `gorm:"not null;default:false;index" json:"lembrete_enviado"`
	// ProfissionalID identifica qual profissional (dono ou auxiliar) atende
	// esse agendamento — cada um tem sua própria agenda/disponibilidade.
	// default:0 só existe pra migration em cima de linhas existentes (ver
	// database.MigrarProfissionais, que preenche o valor real em seguida).
	ProfissionalID    uint    `gorm:"not null;default:0;index" json:"profissional_id"`
	Profissional      Usuario `json:"profissional,omitempty"`
	EstabelecimentoID uint    `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
