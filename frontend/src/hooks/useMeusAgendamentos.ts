import { useState } from "react"
import { apiPublico, ApiError } from "@/lib/api"
import type { Agendamento } from "@/types"

export function useMeusAgendamentos(slug: string) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function buscar(telefone: string) {
    setLoading(true)
    setErro(null)
    try {
      const dados = await apiPublico(slug).get<Agendamento[]>(
        `/meus-agendamentos?telefone=${encodeURIComponent(telefone)}`
      )
      setAgendamentos(dados)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao buscar agendamentos")
      setAgendamentos(null)
    } finally {
      setLoading(false)
    }
  }

  async function cancelar(id: number, telefone: string) {
    const atualizado = await apiPublico(slug).patch<Agendamento>(`/agendamentos/${id}/cancelar`, {
      telefone,
    })
    setAgendamentos((atual) => atual?.map((a) => (a.id === id ? atualizado : a)) ?? null)
    return atualizado
  }

  return { agendamentos, loading, erro, buscar, cancelar }
}
