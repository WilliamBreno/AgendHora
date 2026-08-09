import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Bloqueio, BloqueioInput } from "@/types"

export function useBloqueios() {
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Bloqueio[]>("/bloqueios")
      setBloqueios(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar bloqueios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: BloqueioInput) {
    const criado = await apiAdmin.post<Bloqueio>("/bloqueios", input)
    setBloqueios((atual) =>
      [...atual, criado].sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
    )
    return criado
  }

  async function remover(id: number) {
    await apiAdmin.delete(`/bloqueios/${id}`)
    setBloqueios((atual) => atual.filter((b) => b.id !== id))
  }

  return { bloqueios, loading, criar, remover, recarregar: carregar }
}
