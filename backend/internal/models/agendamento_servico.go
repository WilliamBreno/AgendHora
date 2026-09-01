package models

import "time"

// AgendamentoServico vincula um serviço ADICIONAL a um agendamento que tem
// mais de um serviço no mesmo horário (ver CLAUDE.md "Agendamento com mais
// de um serviço") — o primeiro/principal continua em Agendamento.ServicoID/
// Servico, como sempre; esta tabela só guarda os demais, na ordem em que
// foram escolhidos (id crescente = ordem de inserção, sem precisar de um
// campo de ordem à parte).
type AgendamentoServico struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	AgendamentoID uint      `gorm:"not null;index" json:"agendamento_id"`
	ServicoID     uint      `gorm:"not null;index" json:"servico_id"`
	Servico       Servico   `json:"servico,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}
