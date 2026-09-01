package handlers

import (
	"time"

	"gorm.io/gorm"

	"agendamento/backend/internal/models"
)

// ProximoHorarioDisponivel procura, a partir de apartirDe (exclusive — o
// primeiro candidato é o próximo dia que cai no mesmo dia da semana que
// diaSemanaAlvo), até semanasMax semanas à frente, pelo primeiro dia em que
// [hora, hora+duracaoMin) está livre na agenda do profissional indicado —
// usada pelo aviso automático de reagendamento (ver internal/reagendamento)
// pra tentar reaproveitar o mesmo horário do último agendamento do cliente.
// duracaoMin já vem somado quando o agendamento original tinha mais de um
// serviço (ver Agendamento.DuracaoTotalEfetivaMin). Mesma conta
// conservadora da disponibilidade pública (nunca considera ConcluidoEm).
// Devolve nil (sem erro) quando não encontra nenhum horário livre dentro da
// janela.
func ProximoHorarioDisponivel(
	db *gorm.DB,
	estabelecimentoID, profissionalID uint,
	duracaoMin int,
	diaSemanaAlvo time.Weekday,
	hora string,
	apartirDe time.Time,
	semanasMax int,
) (*time.Time, error) {
	var profissional models.Usuario
	if err := db.First(&profissional, profissionalID).Error; err != nil {
		return nil, err
	}
	var estabelecimento models.Estabelecimento
	if err := db.First(&estabelecimento, estabelecimentoID).Error; err != nil {
		return nil, err
	}
	horarios := horarioDoProfissional(estabelecimento, profissional)

	horaMin, err := minutosDoDia(hora)
	if err != nil {
		return nil, err
	}
	duracao := duracaoMin

	diasAteAlvo := (int(diaSemanaAlvo) - int(apartirDe.Weekday()) + 7) % 7
	if diasAteAlvo == 0 {
		diasAteAlvo = 7
	}
	primeiraCandidata := apartirDe.AddDate(0, 0, diasAteAlvo)

	for semana := 0; semana < semanasMax; semana++ {
		data := primeiraCandidata.AddDate(0, 0, semana*7)

		diaSemana := models.DiasSemana[int(data.Weekday())]
		horarioDia, configurado := horarios[diaSemana]
		if !configurado || horarioDia.Fechado {
			continue
		}
		abre, errAbre := minutosDoDia(horarioDia.Abre)
		fecha, errFecha := minutosDoDia(horarioDia.Fecha)
		if errAbre != nil || errFecha != nil || horaMin < abre || horaMin+duracao > fecha {
			continue
		}
		if sobrepoeIntervalo(horaMin, horaMin+duracao, horarioDia) {
			continue
		}

		ocupados, err := intervalosOcupados(db, estabelecimentoID, profissionalID, data, 0, false)
		if err != nil {
			return nil, err
		}

		var bloqueiosDia []models.Bloqueio
		if err := db.Where(
			"estabelecimento_id = ? AND data = ? AND (profissional_id IS NULL OR profissional_id = ?)",
			estabelecimentoID, data, profissionalID,
		).Find(&bloqueiosDia).Error; err != nil {
			return nil, err
		}

		livre := true
		for _, o := range ocupados {
			if sobrepoe(horaMin, horaMin+duracao, o.inicio, o.fim) {
				livre = false
				break
			}
		}
		for _, b := range bloqueiosDia {
			if !livre {
				break
			}
			if b.HoraInicio == "" && b.HoraFim == "" {
				livre = false
				break
			}
			inicioBloqueio, err1 := minutosDoDia(b.HoraInicio)
			fimBloqueio, err2 := minutosDoDia(b.HoraFim)
			if err1 != nil || err2 != nil {
				continue
			}
			if sobrepoe(horaMin, horaMin+duracao, inicioBloqueio, fimBloqueio) {
				livre = false
			}
		}

		if livre {
			resultado := data
			return &resultado, nil
		}
	}
	return nil, nil
}
