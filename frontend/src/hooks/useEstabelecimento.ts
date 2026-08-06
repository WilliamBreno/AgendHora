import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { Estabelecimento, EstabelecimentoDadosInput, HorarioFuncionamento } from "@/types"

export function useEstabelecimento() {
  const { atualizarEstabelecimento } = useAuth()
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null)
  const [loading, setLoading] = useState(true)

  // mantém o AuthContext (usado na sidebar/onboarding) em dia com qualquer
  // mudança feita por aqui — antes cada um guardava sua própria cópia e a
  // sidebar só atualizava depois de um reload. Sincroniza depois do render
  // (não durante), pra não disparar "setState de outro componente" do React.
  useEffect(() => {
    if (estabelecimento) atualizarEstabelecimento(estabelecimento)
  }, [estabelecimento, atualizarEstabelecimento])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Estabelecimento>("/estabelecimento")
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
    const resposta = await apiAdmin.put<{ icones_padrao: string[] }>("/estabelecimento/icones", {
      icones,
    })
    setEstabelecimento((atual) =>
      atual ? { ...atual, icones_padrao: resposta.icones_padrao } : atual
    )
    return resposta.icones_padrao
  }

  async function atualizarDados(dados: EstabelecimentoDadosInput) {
    const atualizado = await apiAdmin.put<Estabelecimento>("/estabelecimento", dados)
    setEstabelecimento(atualizado)
    return atualizado
  }

  async function atualizarHorario(horarios: HorarioFuncionamento) {
    const resposta = await apiAdmin.put<{ horario_funcionamento: HorarioFuncionamento }>(
      "/estabelecimento/horario",
      { horarios }
    )
    setEstabelecimento((atual) =>
      atual ? { ...atual, horario_funcionamento: resposta.horario_funcionamento } : atual
    )
    return resposta.horario_funcionamento
  }

  async function atualizarLogo(logo: string) {
    const resposta = await apiAdmin.put<{ logo: string }>("/estabelecimento/logo", { logo })
    setEstabelecimento((atual) => (atual ? { ...atual, logo: resposta.logo } : atual))
    return resposta.logo
  }

  async function atualizarAviso(ativo: boolean, texto: string) {
    const resposta = await apiAdmin.put<{ aviso_ativo: boolean; aviso_texto: string }>(
      "/estabelecimento/aviso",
      { ativo, texto }
    )
    setEstabelecimento((atual) =>
      atual
        ? { ...atual, aviso_ativo: resposta.aviso_ativo, aviso_texto: resposta.aviso_texto }
        : atual
    )
    return resposta
  }

  return {
    estabelecimento,
    loading,
    atualizarIcones,
    atualizarDados,
    atualizarHorario,
    atualizarLogo,
    atualizarAviso,
    recarregar: carregar,
  }
}
