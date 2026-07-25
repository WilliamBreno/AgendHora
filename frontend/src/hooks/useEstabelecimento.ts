import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"
import type { Estabelecimento } from "@/types"

export function useEstabelecimento() {
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await api.get<Estabelecimento>("/api/estabelecimento")
      setEstabelecimento(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar estabelecimento")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function atualizarIcones(icones: string[]) {
    const resposta = await api.put<{ icones_padrao: string[] }>("/api/estabelecimento/icones", {
      icones,
    })
    setEstabelecimento((atual) =>
      atual ? { ...atual, icones_padrao: resposta.icones_padrao } : atual
    )
    return resposta.icones_padrao
  }

  return { estabelecimento, loading, atualizarIcones, recarregar: carregar }
}
