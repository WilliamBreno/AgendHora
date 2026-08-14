import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Agendamento, AgendamentoInput } from "@/types"

// profissionalIds vazio = toda a equipe (sem filtro) — multi-seleção, ver
// CLAUDE.md "Multi-seleção de profissional".
export function useAgendamentos(inicio: string, fim: string, profissionalIds: number[] = []) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  // chave estável pra não recarregar a cada novo array com o mesmo conteúdo
  // (o componente que chama costuma criar um array novo a cada render).
  const idsChave = profissionalIds.join(",")

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const filtro = idsChave
        ? "&" + idsChave.split(",").map((id) => `profissional_id=${id}`).join("&")
        : ""
      const dados = await apiAdmin.get<Agendamento[]>(
        `/agendamentos?inicio=${inicio}&fim=${fim}${filtro}`
      )
      setAgendamentos(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar agenda")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, idsChave])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: AgendamentoInput) {
    const criado = await apiAdmin.post<Agendamento>("/agendamentos", input)
    setAgendamentos((atual) => [...atual, criado])
    return criado
  }

  async function cancelar(id: number) {
    const atualizado = await apiAdmin.patch<Agendamento>(`/agendamentos/${id}/cancelar`)
    setAgendamentos((atual) => atual.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  }

  async function atualizarPago(id: number, pago: boolean) {
    const atualizado = await apiAdmin.patch<Agendamento>(`/agendamentos/${id}/pago`, { pago })
    setAgendamentos((atual) => atual.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  }

  async function reagendar(id: number, data: string, hora: string, encaixe?: boolean) {
    const atualizado = await apiAdmin.patch<Agendamento>(`/agendamentos/${id}/reagendar`, {
      data,
      hora,
      encaixe,
    })
    setAgendamentos((atual) => atual.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  }

  // atualizarFinanceiro edita valor final/sinal/link de referência (ver
  // CLAUDE.md "Segmentos de negócio") — sempre manda os 4 campos juntos,
  // igual o painel de detalhe já trabalha com o objeto inteiro.
  async function atualizarFinanceiro(
    id: number,
    dados: {
      valor_final: number | null
      valor_sinal: number | null
      sinal_pago: boolean
      link_referencia: string
    }
  ) {
    const atualizado = await apiAdmin.patch<Agendamento>(`/agendamentos/${id}/financeiro`, dados)
    setAgendamentos((atual) => atual.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  }

  // concluir registra concluido_em com o horário atual — botão "Concluir
  // agora" no painel de detalhe (ver CLAUDE.md "Encaixe de horários").
  async function concluir(id: number) {
    const atualizado = await apiAdmin.patch<Agendamento>(`/agendamentos/${id}/concluir`)
    setAgendamentos((atual) => atual.map((a) => (a.id === id ? atualizado : a)))
    return atualizado
  }

  return {
    agendamentos,
    loading,
    criar,
    cancelar,
    atualizarPago,
    reagendar,
    atualizarFinanceiro,
    concluir,
    recarregar: carregar,
  }
}
