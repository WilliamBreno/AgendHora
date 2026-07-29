import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Agendamento, AgendamentoInput } from "@/types"

export function useAgendamentos(inicio: string, fim: string) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Agendamento[]>(`/agendamentos?inicio=${inicio}&fim=${fim}`)
      setAgendamentos(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar agenda")
    } finally {
      setLoading(false)
    }
  }, [inicio, fim])

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

  return { agendamentos, loading, criar, cancelar, recarregar: carregar }
}
