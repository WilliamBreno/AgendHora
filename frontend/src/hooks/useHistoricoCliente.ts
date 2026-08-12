import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Agendamento } from "@/types"

// clienteId nulo = painel fechado, não busca nada. Ordena do mais recente
// pro mais antigo (a API devolve em ordem de agenda — data/hora crescente —
// que faz sentido pra grade mensal, mas não pra um histórico).
export function useHistoricoCliente(clienteId: number | null) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    if (clienteId === null) return
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Agendamento[]>(`/agendamentos?cliente_id=${clienteId}`)
      const ordenados = [...dados].sort((a, b) =>
        `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)
      )
      setAgendamentos(ordenados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar histórico")
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    if (clienteId === null) {
      setAgendamentos([])
      return
    }
    carregar()
  }, [clienteId, carregar])

  return { agendamentos, loading }
}
