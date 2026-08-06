import { apiAdmin } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { HorarioFuncionamento } from "@/types"

// Horário de trabalho + intervalo de descanso do PRÓPRIO usuário logado —
// usado pelo profissional auxiliar (que não acessa Configurações) pra
// definir sua própria agenda, independente do horário geral da empresa.
export function useMeuHorario() {
  const { usuario, estabelecimento, atualizarUsuario } = useAuth()

  const horarios = usuario?.horario_trabalho ?? estabelecimento?.horario_funcionamento ?? {}

  async function atualizar(novoHorario: HorarioFuncionamento) {
    const resposta = await apiAdmin.put<{ horario_trabalho: HorarioFuncionamento }>(
      "/usuario/horario",
      { horarios: novoHorario }
    )
    if (usuario) {
      atualizarUsuario({ ...usuario, horario_trabalho: resposta.horario_trabalho })
    }
    return resposta.horario_trabalho
  }

  return { horarios, atualizar }
}
