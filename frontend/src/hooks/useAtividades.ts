import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { RegistroAtividade } from "@/types"

// Histórico de ações da equipe (ver CLAUDE.md "Histórico de atividades") —
// habilitado evita a chamada pra quem não é dono, mesma convenção de
// useEquipe (a rota é dono-only, auxiliar recebe 403).
export function useAtividades(habilitado = true) {
  const [atividades, setAtividades] = useState<RegistroAtividade[]>([])
  const [loading, setLoading] = useState(habilitado)

  const carregar = useCallback(async () => {
    if (!habilitado) return
    setLoading(true)
    try {
      const dados = await apiAdmin.get<RegistroAtividade[]>("/atividades")
      setAtividades(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar atividades")
    } finally {
      setLoading(false)
    }
  }, [habilitado])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { atividades, loading, recarregar: carregar }
}
