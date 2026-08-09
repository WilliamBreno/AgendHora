package models

import "time"

// Bloqueio marca um período indisponível pra agendar — folga, almoço,
// feriado, férias etc. Entra no mesmo cálculo de disponibilidade que os
// Agendamentos, como mais uma fonte de "horário ocupado" (ver
// handlers.DisponibilidadeHandler.Listar), não é um sistema separado.
type Bloqueio struct {
	ID   uint      `gorm:"primaryKey" json:"id"`
	Data time.Time `gorm:"type:date;not null;index" json:"data"`
	// HoraInicio/HoraFim vazios (os dois) bloqueiam o dia inteiro; com
	// valor (formato "HH:MM", igual Agendamento.Hora), bloqueiam só aquele
	// intervalo.
	HoraInicio string `json:"hora_inicio"`
	HoraFim    string `json:"hora_fim"`
	Motivo     string `json:"motivo"`
	// ProfissionalID nulo bloqueia o estabelecimento inteiro; preenchido
	// bloqueia só a agenda daquele profissional.
	ProfissionalID    *uint   `json:"profissional_id"`
	Profissional      Usuario `json:"profissional,omitempty"`
	EstabelecimentoID uint    `gorm:"not null;index" json:"estabelecimento_id"`

	CreatedAt time.Time `json:"created_at"`
}
