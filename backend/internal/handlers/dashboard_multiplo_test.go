package handlers

import (
	"math"
	"testing"
	"time"

	"agendamento/backend/internal/models"
)

// agComAdicionais monta um agendamento com serviço principal + adicionais —
// usado só nos testes de agendamento com mais de um serviço (ver CLAUDE.md
// "Agendamento com mais de um serviço").
func agComAdicionais(principal models.Agendamento, adicionais ...models.Servico) models.Agendamento {
	itens := make([]models.AgendamentoServico, len(adicionais))
	for i, s := range adicionais {
		itens[i] = models.AgendamentoServico{ServicoID: s.ID, Servico: s}
	}
	principal.ServicosAdicionais = itens
	return principal
}

func TestValorAgendamentoComMultiplosServicos(t *testing.T) {
	t.Run("soma o preço de todos os serviços", func(t *testing.T) {
		a := agComAdicionais(
			ag(1, "Corte", 50, 30, dia(2026, time.March, 5), "10:00", false),
			models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(30)},
		)
		if got := valorAgendamento(a); got != 80 {
			t.Errorf("valorAgendamento() = %v, esperado 80 (50+30)", got)
		}
	})

	t.Run("qualquer serviço sem preço zera o total (sem ValorFinal)", func(t *testing.T) {
		a := agComAdicionais(
			ag(1, "Corte", 50, 30, dia(2026, time.March, 5), "10:00", false),
			models.Servico{ID: 2, Nome: "Tatuagem", Preco: nil},
		)
		if got := valorAgendamento(a); got != 0 {
			t.Errorf("valorAgendamento() = %v, esperado 0 (a combinar, sem ValorFinal)", got)
		}
	})

	t.Run("ValorFinal sempre tem prioridade sobre a soma dos serviços", func(t *testing.T) {
		valorFinal := 999.0
		a := agComAdicionais(
			ag(1, "Corte", 50, 30, dia(2026, time.March, 5), "10:00", false),
			models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(30)},
		)
		a.ValorFinal = &valorFinal
		if got := valorAgendamento(a); got != 999 {
			t.Errorf("valorAgendamento() = %v, esperado 999 (ValorFinal)", got)
		}
	})
}

func floatPtr(v float64) *float64 { return &v }

func TestRankingComMultiplosServicos(t *testing.T) {
	inicio, fim := dia(2026, time.March, 1), dia(2026, time.March, 31)

	t.Run("cada serviço do combo conta 1 no ranking de quantidade", func(t *testing.T) {
		agendamentos := []models.Agendamento{
			agComAdicionais(
				ag(1, "Corte", 60, 30, dia(2026, time.March, 5), "10:00", false),
				models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(20)},
			),
		}
		porQtd, _ := ranking(agendamentos, inicio, fim)
		if len(porQtd) != 2 {
			t.Fatalf("esperava 2 serviços no ranking, veio %d", len(porQtd))
		}
		for _, item := range porQtd {
			if item.Quantidade != 1 {
				t.Errorf("serviço %q com quantidade %d, esperado 1", item.Nome, item.Quantidade)
			}
		}
	})

	t.Run("faturamento é rateado proporcionalmente ao preço de cada serviço", func(t *testing.T) {
		// Corte R$60 + Barba R$20 = R$80 no total; proporção 60/80 e 20/80.
		agendamentos := []models.Agendamento{
			agComAdicionais(
				ag(1, "Corte", 60, 30, dia(2026, time.March, 5), "10:00", false),
				models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(20)},
			),
		}
		_, porFat := ranking(agendamentos, inicio, fim)
		faturamentoPorNome := map[string]float64{}
		for _, item := range porFat {
			faturamentoPorNome[item.Nome] = item.Faturamento
		}
		if math.Abs(faturamentoPorNome["Corte"]-60) > 0.001 {
			t.Errorf("faturamento de Corte = %v, esperado 60", faturamentoPorNome["Corte"])
		}
		if math.Abs(faturamentoPorNome["Barba"]-20) > 0.001 {
			t.Errorf("faturamento de Barba = %v, esperado 20", faturamentoPorNome["Barba"])
		}
	})

	t.Run("ValorFinal do combo é rateado pela proporção dos preços de catálogo", func(t *testing.T) {
		// Corte R$60 + Barba R$20 (proporção 3:1), mas o dono negociou
		// ValorFinal=40 pro combo inteiro — Corte deve ficar com 30, Barba com 10.
		valorFinal := 40.0
		a := agComAdicionais(
			ag(1, "Corte", 60, 30, dia(2026, time.March, 5), "10:00", false),
			models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(20)},
		)
		a.ValorFinal = &valorFinal
		_, porFat := ranking([]models.Agendamento{a}, inicio, fim)
		faturamentoPorNome := map[string]float64{}
		for _, item := range porFat {
			faturamentoPorNome[item.Nome] = item.Faturamento
		}
		if math.Abs(faturamentoPorNome["Corte"]-30) > 0.001 {
			t.Errorf("faturamento de Corte = %v, esperado 30 (3/4 de 40)", faturamentoPorNome["Corte"])
		}
		if math.Abs(faturamentoPorNome["Barba"]-10) > 0.001 {
			t.Errorf("faturamento de Barba = %v, esperado 10 (1/4 de 40)", faturamentoPorNome["Barba"])
		}
	})

	t.Run("sem nenhum preço de catálogo, rateia em partes iguais sem NaN", func(t *testing.T) {
		valorFinal := 50.0
		a := agComAdicionais(
			ag(1, "Corte", 0, 30, dia(2026, time.March, 5), "10:00", false),
			models.Servico{ID: 2, Nome: "Barba", Preco: nil},
		)
		a.Servico.Preco = nil
		a.ValorFinal = &valorFinal
		_, porFat := ranking([]models.Agendamento{a}, inicio, fim)
		for _, item := range porFat {
			if math.IsNaN(item.Faturamento) || math.IsInf(item.Faturamento, 0) {
				t.Fatalf("faturamento inválido pro serviço %q: %v", item.Nome, item.Faturamento)
			}
			if math.Abs(item.Faturamento-25) > 0.001 {
				t.Errorf("faturamento de %q = %v, esperado 25 (metade igual de 50)", item.Nome, item.Faturamento)
			}
		}
	})
}

func TestDuracaoTotalConsideradaNaOcupacao(t *testing.T) {
	horarios := horarioComercialTeste()
	inicio, fim := dia(2026, time.March, 2), dia(2026, time.March, 2) // segunda-feira

	agendamentos := []models.Agendamento{
		agComAdicionais(
			ag(1, "Corte", 50, 30, dia(2026, time.March, 2), "10:00", false),
			models.Servico{ID: 2, Nome: "Barba", Preco: floatPtr(20), DuracaoMin: 20},
		),
	}

	_, ocupado := ocupacaoNoPeriodo(agendamentos, horarios, inicio, fim)
	if ocupado != 50 {
		t.Errorf("minutos ocupados = %v, esperado 50 (30+20)", ocupado)
	}
}
