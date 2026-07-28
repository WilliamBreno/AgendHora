package models

// DiasSemana lista as chaves do JSON de HorarioFuncionamento, na ordem de
// time.Weekday (0 = domingo ... 6 = sábado), sem acento pra ficar seguro
// como chave JSON/URL.
var DiasSemana = []string{
	"domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado",
}

// HorarioDia é um dia de HorarioFuncionamento: {"abre":"09:00","fecha":"18:00","fechado":false}.
type HorarioDia struct {
	Abre    string `json:"abre"`
	Fecha   string `json:"fecha"`
	Fechado bool   `json:"fechado"`
}

// HorarioFuncionamento é o valor decodificado de Estabelecimento.HorarioFuncionamento.
type HorarioFuncionamento map[string]HorarioDia
