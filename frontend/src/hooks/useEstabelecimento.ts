import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"
import type { Estabelecimento, EstabelecimentoDadosInput, HorarioFuncionamento } from "@/types"

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

  async function atualizarDados(dados: EstabelecimentoDadosInput) {
    const atualizado = await api.put<Estabelecimento>("/api/estabelecimento", dados)
    setEstabelecimento(atualizado)
    return atualizado
  }

  async function atualizarHorario(horarios: HorarioFuncionamento) {
    const resposta = await api.put<{ horario_funcionamento: HorarioFuncionamento }>(
      "/api/estabelecimento/horario",
      { horarios }
    )
    setEstabelecimento((atual) =>
      atual ? { ...atual, horario_funcionamento: resposta.horario_funcionamento } : atual
    )
    return resposta.horario_funcionamento
  }

  return {
    estabelecimento,
    loading,
    atualizarIcones,
    atualizarDados,
    atualizarHorario,
    recarregar: carregar,
  }
}
