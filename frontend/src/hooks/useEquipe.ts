import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { ConvitePendente, Equipe } from "@/types"

// habilitado evita a chamada pra quem não é dono — a rota é dono-only
// (auxiliar recebe 403), então nem faz sentido tentar buscar.
export function useEquipe(habilitado = true) {
  const [equipe, setEquipe] = useState<Equipe | null>(null)
  const [loading, setLoading] = useState(habilitado)

  const carregar = useCallback(async () => {
    if (!habilitado) return
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Equipe>("/profissionais")
      setEquipe(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar equipe")
    } finally {
      setLoading(false)
    }
  }, [habilitado])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function convidar(email: string, telefone: string) {
    const convite = await apiAdmin.post<ConvitePendente>("/profissionais/convidar", {
      email,
      telefone,
    })
    setEquipe((atual) =>
      atual ? { ...atual, convites_pendentes: [...atual.convites_pendentes, convite] } : atual
    )
    return convite
  }

  return { equipe, loading, convidar, recarregar: carregar }
}
