package handlers

import (
	"math"
	"strings"
	"testing"
	"time"

	"agendamento/backend/internal/models"
)

// ag monta um Agendamento mínimo pra teste — só os campos que
// servicoParaPromover/gerarSugestoes de fato usam.
func ag(servicoID uint, servicoNome string, precoServico float64, duracaoMin int, data time.Time, hora string, pago bool) models.Agendamento {
	preco := precoServico
	return models.Agendamento{
		ServicoID: servicoID,
		Servico: models.Servico{
			ID: servicoID, Nome: servicoNome, Preco: &preco, DuracaoMin: duracaoMin, Cor: "teal",
		},
		Data:   data,
		Hora:   hora,
		Status: models.StatusConfirmado,
		Pago:   pago,
	}
}

func dia(ano int, mes time.Month, dia int) time.Time {
	return time.Date(ano, mes, dia, 0, 0, 0, 0, time.UTC)
}

func TestServicoParaPromover(t *testing.T) {
	inicio, fim := dia(2026, time.March, 1), dia(2026, time.March, 31)

	t.Run("sem agendamentos", func(t *testing.T) {
		_, _, _, _, ok := servicoParaPromover(nil, inicio, fim)
		if ok {
			t.Fatal("esperava ok=false sem nenhum agendamento")
		}
	})

	t.Run("um serviço só não tem com o que comparar", func(t *testing.T) {
		agendamentos := []models.Agendamento{
			ag(1, "Corte", 30, 30, dia(2026, time.March, 5), "10:00", false),
			ag(1, "Corte", 30, 30, dia(2026, time.March, 6), "10:00", false),
		}
		_, _, _, _, ok := servicoParaPromover(agendamentos, inicio, fim)
		if ok {
			t.Fatal("esperava ok=false com um serviço só")
		}
	})

	t.Run("empate entre serviços não é fraqueza", func(t *testing.T) {
		agendamentos := []models.Agendamento{
			ag(1, "Corte", 30, 30, dia(2026, time.March, 5), "10:00", false),
			ag(2, "Barba", 20, 20, dia(2026, time.March, 5), "11:00", false),
		}
		_, _, _, _, ok := servicoParaPromover(agendamentos, inicio, fim)
		if ok {
			t.Fatal("esperava ok=false com quantidades empatadas")
		}
	})

	t.Run("diferença pequena não dispara", func(t *testing.T) {
		// fraco=4, outro=6 → 4 >= 6*0.6 (3.6) → não dispara
		var agendamentos []models.Agendamento
		for i := 0; i < 4; i++ {
			agendamentos = append(agendamentos, ag(1, "Fraco", 30, 30, dia(2026, time.March, 1+i), "10:00", false))
		}
		for i := 0; i < 6; i++ {
			agendamentos = append(agendamentos, ag(2, "Forte", 30, 30, dia(2026, time.March, 10+i), "10:00", false))
		}
		_, _, _, _, ok := servicoParaPromover(agendamentos, inicio, fim)
		if ok {
			t.Fatal("esperava ok=false com diferença pequena (4 vs média 6)")
		}
	})

	t.Run("diferença grande dispara e traz os números certos", func(t *testing.T) {
		var agendamentos []models.Agendamento
		agendamentos = append(agendamentos, ag(1, "Fraco", 30, 30, dia(2026, time.March, 2), "10:00", false))
		for i := 0; i < 10; i++ {
			agendamentos = append(agendamentos, ag(2, "Forte", 50, 40, dia(2026, time.March, 3+i), "10:00", false))
		}
		nomeFraco, qtdFraco, mediaOutros, nomeTop, ok := servicoParaPromover(agendamentos, inicio, fim)
		if !ok {
			t.Fatal("esperava ok=true com 1 agendamento fraco contra 10 do outro")
		}
		if nomeFraco != "Fraco" || qtdFraco != 1 {
			t.Errorf("nomeFraco/qtdFraco = %q/%d, esperado Fraco/1", nomeFraco, qtdFraco)
		}
		if mediaOutros != 10 {
			t.Errorf("mediaOutros = %v, esperado 10", mediaOutros)
		}
		if nomeTop != "Forte" {
			t.Errorf("nomeTop = %q, esperado Forte", nomeTop)
		}
	})

	t.Run("três serviços: média exclui o próprio fraco", func(t *testing.T) {
		var agendamentos []models.Agendamento
		agendamentos = append(agendamentos, ag(1, "A", 10, 10, dia(2026, time.March, 1), "09:00", false))
		for i := 0; i < 10; i++ {
			agendamentos = append(agendamentos, ag(2, "B", 10, 10, dia(2026, time.March, 2+i), "09:00", false))
		}
		for i := 0; i < 8; i++ {
			agendamentos = append(agendamentos, ag(3, "C", 10, 10, dia(2026, time.March, 13+i), "09:00", false))
		}
		nomeFraco, qtdFraco, mediaOutros, nomeTop, ok := servicoParaPromover(agendamentos, inicio, fim)
		if !ok {
			t.Fatal("esperava ok=true")
		}
		if nomeFraco != "A" || qtdFraco != 1 {
			t.Errorf("nomeFraco/qtdFraco = %q/%d, esperado A/1", nomeFraco, qtdFraco)
		}
		// média de B(10) e C(8), excluindo A: (10+8)/2 = 9
		if mediaOutros != 9 {
			t.Errorf("mediaOutros = %v, esperado 9 (média de B e C, sem A)", mediaOutros)
		}
		if nomeTop != "B" {
			t.Errorf("nomeTop = %q, esperado B (maior quantidade)", nomeTop)
		}
	})

	t.Run("respeita o filtro de período", func(t *testing.T) {
		fora := dia(2026, time.April, 10) // fora de [inicio, fim] = março
		agendamentos := []models.Agendamento{
			ag(1, "Fraco", 30, 30, dia(2026, time.March, 2), "10:00", false),
			ag(2, "Forte", 30, 30, dia(2026, time.March, 3), "10:00", false),
			ag(2, "Forte", 30, 30, dia(2026, time.March, 4), "10:00", false),
			ag(2, "Forte", 30, 30, dia(2026, time.March, 5), "10:00", false),
			// esses 3 de abril não podem contar — se contassem, mudariam o resultado
			ag(3, "AbrilA", 30, 30, fora, "10:00", false),
			ag(3, "AbrilA", 30, 30, fora, "10:00", false),
			ag(3, "AbrilA", 30, 30, fora, "10:00", false),
		}
		nomeFraco, qtdFraco, _, _, ok := servicoParaPromover(agendamentos, inicio, fim)
		if !ok {
			t.Fatal("esperava ok=true considerando só março")
		}
		if nomeFraco != "Fraco" || qtdFraco != 1 {
			t.Errorf("nomeFraco/qtdFraco = %q/%d, esperado Fraco/1 (abril não deveria contar)", nomeFraco, qtdFraco)
		}
	})
}

// horarioComercialTeste é seg-sáb 09:00-18:00, domingo fechado — mesmo
// padrão de models.HorarioFuncionamentoDefault(), só que construído aqui
// pra não depender desse helper mudar no futuro.
func horarioComercialTeste() models.HorarioFuncionamento {
	return models.HorarioFuncionamentoDefault()
}

func TestGerarSugestoes(t *testing.T) {
	horarios := horarioComercialTeste()

	t.Run("sem agendamento no mês não sugere nada", func(t *testing.T) {
		hoje := dia(2026, time.March, 15)
		sugestoes := gerarSugestoes(nil, horarios, hoje, hoje)
		if len(sugestoes) != 0 {
			t.Fatalf("esperava nenhuma sugestão sem histórico, veio %d", len(sugestoes))
		}
	})

	t.Run("nunca mais que 3 sugestões", func(t *testing.T) {
		hoje := dia(2026, time.March, 15) // domingo
		var agendamentos []models.Agendamento
		// bastante volume em poucos serviços de baixa duração pra gerar
		// ocupação alta e cenário "indo bem" com todas as sugestões possíveis
		for i := 1; i <= 10; i++ {
			d := dia(2026, time.March, i)
			if d.Weekday() == time.Sunday {
				continue
			}
			agendamentos = append(agendamentos, ag(1, "Popular", 50, 30, d, "09:00", true))
		}
		agendamentos = append(agendamentos, ag(2, "Raro", 50, 30, dia(2026, time.March, 3), "14:00", true))

		sugestoes := gerarSugestoes(agendamentos, horarios, hoje, hoje)
		if len(sugestoes) > 3 {
			t.Fatalf("esperava no máximo 3 sugestões, veio %d", len(sugestoes))
		}
	})

	t.Run("ocupação baixa gera alerta e o serviço fraco também vira alerta", func(t *testing.T) {
		hoje := dia(2026, time.March, 15) // domingo — fimSemana cobre a semana toda
		inicioSemanaAtual := inicioSemana(hoje)
		var agendamentos []models.Agendamento
		// poucos agendamentos na semana atual → ocupação baixa
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, inicioSemanaAtual.AddDate(0, 0, 1), "09:00", false))
		// mais alguns do mesmo mês, mas fora da semana atual, criando um
		// segundo serviço bem mais fraco no mês inteiro
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, dia(2026, time.March, 2), "09:00", false))
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, dia(2026, time.March, 3), "09:00", false))
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, dia(2026, time.March, 4), "09:00", false))
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, dia(2026, time.March, 5), "09:00", false))
		agendamentos = append(agendamentos, ag(1, "Popular", 100, 60, dia(2026, time.March, 6), "09:00", false))
		agendamentos = append(agendamentos, ag(2, "Fraco", 100, 60, dia(2026, time.March, 2), "11:00", false))

		sugestoes := gerarSugestoes(agendamentos, horarios, hoje, hoje)

		temAlertaOcupacao := false
		temAlertaServicoFraco := false
		temIncentivo := false
		for _, s := range sugestoes {
			if s.Tipo == "incentivo" {
				temIncentivo = true
			}
			if s.Tipo == "alerta" && strings.Contains(s.Titulo, "Ocupação") {
				temAlertaOcupacao = true
			}
			if s.Tipo == "alerta" && strings.Contains(s.Titulo, "procura baixa") {
				temAlertaServicoFraco = true
			}
		}
		if !temAlertaOcupacao {
			t.Error("esperava alerta de ocupação baixa")
		}
		if !temAlertaServicoFraco {
			t.Error("esperava alerta de serviço com procura baixa (tom de alerta, já que o resto também não vai bem)")
		}
		if temIncentivo {
			t.Error("não deveria misturar incentivo com alerta na mesma passada")
		}
	})

	t.Run("cenário bom nunca soa como cobrança", func(t *testing.T) {
		hoje := dia(2026, time.March, 15)
		inicioSemanaAtual := inicioSemana(hoje)
		var agendamentos []models.Agendamento
		// agenda bem cheia essa semana (ocupação alta) — sem faturamento caindo
		for i := 0; i < 6; i++ {
			d := inicioSemanaAtual.AddDate(0, 0, i)
			if d.Weekday() == time.Sunday {
				continue
			}
			for h := 9; h < 17; h++ {
				agendamentos = append(agendamentos, ag(1, "Popular", 80, 60, d, twoDigitHora(h), true))
			}
		}
		// um serviço bem mais fraco no mesmo mês, pra também testar o tom
		// "oportunidade" em vez de "problema"
		agendamentos = append(agendamentos, ag(2, "Novo", 80, 60, dia(2026, time.March, 2), "09:00", true))

		sugestoes := gerarSugestoes(agendamentos, horarios, hoje, hoje)
		for _, s := range sugestoes {
			if s.Tipo == "alerta" {
				t.Errorf("não esperava nenhum alerta num cenário de agenda cheia, veio: %q", s.Titulo)
			}
			if strings.Contains(strings.ToLower(s.Descricao), "procura baixa") {
				t.Errorf("descrição não deveria soar como problema num cenário bom: %q", s.Descricao)
			}
		}
	})

	t.Run("nunca produz NaN ou Inf no texto", func(t *testing.T) {
		hoje := dia(2026, time.March, 15)
		agendamentos := []models.Agendamento{
			ag(1, "Único", 0, 30, dia(2026, time.March, 2), "09:00", false),
		}
		sugestoes := gerarSugestoes(agendamentos, models.HorarioFuncionamento{}, hoje, hoje)
		for _, s := range sugestoes {
			if strings.Contains(s.Descricao, "NaN") || strings.Contains(s.Descricao, "Inf") {
				t.Errorf("descrição com valor inválido: %q", s.Descricao)
			}
		}
	})
}

// twoDigitHora monta "HH:00" — helper só pra não repetir fmt.Sprintf no teste.
func twoDigitHora(h int) string {
	if h < 10 {
		return "0" + itoa(h) + ":00"
	}
	return itoa(h) + ":00"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digitos := ""
	for n > 0 {
		digitos = string(rune('0'+n%10)) + digitos
		n /= 10
	}
	return digitos
}

// garante que nenhuma das funções auxiliares usadas por gerarSugestoes
// devolve NaN/Inf mesmo em entradas degeneradas (duração zero, sem horário
// configurado) — testado à parte por ser a fonte mais provável de erro
// matemático (divisão por zero).
func TestOcupacaoNoPeriodoNuncaGeraValorInvalido(t *testing.T) {
	inicio, fim := dia(2026, time.March, 1), dia(2026, time.March, 7)
	agendamentos := []models.Agendamento{
		ag(1, "X", 10, 0, dia(2026, time.March, 2), "09:00", false), // duração 0
	}
	disponivel, ocupado := ocupacaoNoPeriodo(agendamentos, models.HorarioFuncionamento{}, inicio, fim)
	if math.IsNaN(disponivel) || math.IsInf(disponivel, 0) {
		t.Errorf("disponivel inválido: %v", disponivel)
	}
	if math.IsNaN(ocupado) || math.IsInf(ocupado, 0) {
		t.Errorf("ocupado inválido: %v", ocupado)
	}
}
