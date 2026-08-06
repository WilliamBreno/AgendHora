package models

// DiasSemana lista as chaves do JSON de HorarioFuncionamento, na ordem de
// time.Weekday (0 = domingo ... 6 = sábado), sem acento pra ficar seguro
// como chave JSON/URL.
var DiasSemana = []string{
	"domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado",
}

// HorarioDia é um dia de HorarioFuncionamento: {"abre":"09:00","fecha":"18:00","fechado":false}.
// IntervaloInicio/IntervaloFim são opcionais (ambos vazios = sem intervalo
// configurado nesse dia) e marcam um horário de descanso — ex: almoço — em
// que o motor de disponibilidade não oferece horário pro cliente agendar.
type HorarioDia struct {
	Abre            string `json:"abre"`
	Fecha           string `json:"fecha"`
	Fechado         bool   `json:"fechado"`
	IntervaloInicio string `json:"intervalo_inicio,omitempty"`
	IntervaloFim    string `json:"intervalo_fim,omitempty"`
}

// TemIntervalo indica se o dia tem um intervalo de descanso configurado.
func (h HorarioDia) TemIntervalo() bool {
	return h.IntervaloInicio != "" && h.IntervaloFim != ""
}

// HorarioFuncionamento é o valor decodificado de Estabelecimento.HorarioFuncionamento.
type HorarioFuncionamento map[string]HorarioDia

// HorarioFuncionamentoDefault é um horário comercial razoável (seg-sáb,
// 09:00-18:00, domingo fechado) usado ao cadastrar uma empresa nova — o
// dono ajusta em Configurações depois.
func HorarioFuncionamentoDefault() HorarioFuncionamento {
	horario := HorarioFuncionamento{}
	for _, dia := range DiasSemana {
		if dia == "domingo" {
			horario[dia] = HorarioDia{Fechado: true}
			continue
		}
		horario[dia] = HorarioDia{Abre: "09:00", Fecha: "18:00"}
	}
	return horario
}
