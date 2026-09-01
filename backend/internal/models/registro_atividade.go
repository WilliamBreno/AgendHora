package models

import "time"

// AcaoAtividade identifica o tipo de ação registrada — usada pelo frontend
// só pra escolher o ícone certo, a Descricao já vem pronta em português.
type AcaoAtividade string

const (
	AcaoServicoCriado        AcaoAtividade = "servico_criado"
	AcaoAgendamentoCriado    AcaoAtividade = "agendamento_criado"
	AcaoAgendamentoCancelado AcaoAtividade = "agendamento_cancelado"
	AcaoAgendamentoPago      AcaoAtividade = "agendamento_pago"
)

// RegistroAtividade é o histórico que o dono vê na tela Equipe — quem fez o
// quê, entre as ações que dono e auxiliares realizam pelo painel (ver
// CLAUDE.md "Histórico de atividades"). Não é um log genérico de toda ação
// do sistema: só os pontos explicitamente pedidos (cadastro de serviço,
// agendamento criado pelo painel, cancelamento, marcação de pago).
// Descricao é montada e congelada no momento do registro — não depende de
// join nenhum depois (se o serviço for renomeado ou o agendamento excluído,
// a linha do histórico continua legível do jeito que aconteceu).
type RegistroAtividade struct {
	ID                uint          `gorm:"primaryKey" json:"id"`
	EstabelecimentoID uint          `gorm:"not null;index" json:"estabelecimento_id"`
	UsuarioID         uint          `gorm:"not null;index" json:"usuario_id"`
	Usuario           Usuario       `json:"usuario,omitempty"`
	Acao              AcaoAtividade `gorm:"type:varchar(30);not null" json:"acao"`
	Descricao         string        `gorm:"not null" json:"descricao"`
	CreatedAt         time.Time     `json:"created_at"`
}
