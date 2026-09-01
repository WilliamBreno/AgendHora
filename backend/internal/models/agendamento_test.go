package models

import "testing"

func preco(v float64) *float64 { return &v }

func TestTodosServicos(t *testing.T) {
	a := Agendamento{
		Servico: Servico{ID: 1, Nome: "Corte"},
		ServicosAdicionais: []AgendamentoServico{
			{Servico: Servico{ID: 2, Nome: "Barba"}},
			{Servico: Servico{ID: 3, Nome: "Sobrancelha"}},
		},
	}
	todos := a.TodosServicos()
	if len(todos) != 3 {
		t.Fatalf("esperava 3 serviços, veio %d", len(todos))
	}
	if todos[0].Nome != "Corte" || todos[1].Nome != "Barba" || todos[2].Nome != "Sobrancelha" {
		t.Errorf("ordem errada: %v", todos)
	}
}

func TestTodosServicosSemAdicionais(t *testing.T) {
	a := Agendamento{Servico: Servico{ID: 1, Nome: "Corte"}}
	todos := a.TodosServicos()
	if len(todos) != 1 || todos[0].Nome != "Corte" {
		t.Errorf("esperava só o serviço principal, veio %v", todos)
	}
}

func TestDuracaoTotalEfetivaMin(t *testing.T) {
	maxCorte := 45
	a := Agendamento{
		Servico: Servico{DuracaoMin: 30, DuracaoMaxMin: &maxCorte}, // efetiva: 45
		ServicosAdicionais: []AgendamentoServico{
			{Servico: Servico{DuracaoMin: 20}}, // efetiva: 20
			{Servico: Servico{DuracaoMin: 15}}, // efetiva: 15
		},
	}
	if got := a.DuracaoTotalEfetivaMin(); got != 80 {
		t.Errorf("DuracaoTotalEfetivaMin() = %d, esperado 80 (45+20+15)", got)
	}
}

func TestDuracaoTotalEfetivaMinUmServicoSo(t *testing.T) {
	a := Agendamento{Servico: Servico{DuracaoMin: 30}}
	if got := a.DuracaoTotalEfetivaMin(); got != 30 {
		t.Errorf("DuracaoTotalEfetivaMin() = %d, esperado 30", got)
	}
}

func TestPrecoTotalTodosComPreco(t *testing.T) {
	a := Agendamento{
		Servico: Servico{Preco: preco(50)},
		ServicosAdicionais: []AgendamentoServico{
			{Servico: Servico{Preco: preco(30)}},
		},
	}
	total := a.PrecoTotal()
	if total == nil {
		t.Fatal("esperava preço total não-nulo")
	}
	if *total != 80 {
		t.Errorf("PrecoTotal() = %v, esperado 80", *total)
	}
}

func TestPrecoTotalComAlgumACombinar(t *testing.T) {
	a := Agendamento{
		Servico: Servico{Preco: preco(50)},
		ServicosAdicionais: []AgendamentoServico{
			{Servico: Servico{Preco: nil}}, // "a combinar"
		},
	}
	if total := a.PrecoTotal(); total != nil {
		t.Errorf("PrecoTotal() = %v, esperado nil (a combinar) quando qualquer serviço não tem preço", total)
	}
}

func TestPrecoTotalPrincipalSemPreco(t *testing.T) {
	a := Agendamento{Servico: Servico{Preco: nil}}
	if total := a.PrecoTotal(); total != nil {
		t.Errorf("PrecoTotal() = %v, esperado nil", total)
	}
}
