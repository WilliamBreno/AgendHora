package handlers

import (
	"encoding/json"

	"agendamento/backend/internal/models"
)

// horarioDoProfissional resolve qual HorarioFuncionamento usar pra um
// profissional: o dono usa o horário geral do estabelecimento (editado em
// Configurações, que só ele acessa); um auxiliar usa o próprio horário de
// trabalho, com fallback pro do estabelecimento enquanto ele ainda não
// configurou o seu (ver handlers.UsuarioHandler.AtualizarHorario).
func horarioDoProfissional(estabelecimento models.Estabelecimento, usuario models.Usuario) models.HorarioFuncionamento {
	fonte := estabelecimento.HorarioFuncionamento
	if usuario.Papel == models.PapelAuxiliar && len(usuario.HorarioTrabalho) > 0 {
		fonte = usuario.HorarioTrabalho
	}
	var horarios models.HorarioFuncionamento
	if err := json.Unmarshal(fonte, &horarios); err != nil {
		return models.HorarioFuncionamento{}
	}
	return horarios
}

// sobrepoeIntervalo verifica se [inicio, fim) esbarra no intervalo de
// descanso configurado pro dia (ex: almoço) — quando há um, nenhum horário
// de agendamento pode cair dentro dele.
func sobrepoeIntervalo(inicio, fim int, dia models.HorarioDia) bool {
	if !dia.TemIntervalo() {
		return false
	}
	intInicio, err1 := minutosDoDia(dia.IntervaloInicio)
	intFim, err2 := minutosDoDia(dia.IntervaloFim)
	if err1 != nil || err2 != nil {
		return false
	}
	return sobrepoe(inicio, fim, intInicio, intFim)
}
