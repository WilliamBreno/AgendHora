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

  async function atualizarAviso(ativo: boolean, texto: string, corTexto: string, corFundo: string) {
    const resposta = await apiAdmin.put<{
      aviso_ativo: boolean
      aviso_texto: string
      aviso_cor_texto: string
      aviso_cor_fundo: string
    }>("/estabelecimento/aviso", { ativo, texto, cor_texto: corTexto, cor_fundo: corFundo })
    setEstabelecimento((atual) =>
      atual
        ? {
            ...atual,
            aviso_ativo: resposta.aviso_ativo,
            aviso_texto: resposta.aviso_texto,
            aviso_cor_texto: resposta.aviso_cor_texto,
            aviso_cor_fundo: resposta.aviso_cor_fundo,
          }
        : atual
    )
    return resposta
  }

  // renovar gera (ou reaproveita) o link de renovação e abre numa aba nova —
  // usado pelo banner de vencimento e pelo card "Meu Plano" em Configurações.
  // Sempre disponível, não só perto do vencimento (renovação adiantada é
  // permitida, ver CLAUDE.md "Renovação mensal").
  async function renovar() {
    const atualizado = await apiAdmin.post<Estabelecimento>("/estabelecimento/renovar", {})
    setEstabelecimento(atualizado)
    if (atualizado.link_pagamento_url) {
      window.open(atualizado.link_pagamento_url, "_blank")
    }
    return atualizado
  }

  // verificarRenovacao é o "já paguei, verificar" da tela "Meu Plano" —
  // confirma um link de renovação pendente sem esperar o webhook.
  async function verificarRenovacao() {
    const atualizado = await apiAdmin.post<Estabelecimento>("/estabelecimento/renovar/verificar", {})
    setEstabelecimento(atualizado)
    return atualizado
  }

  // atualizarDescontoProfissional define o desconto padrão (0-100) aplicado
  // automaticamente na compra interna de profissionais — null remove o
  // desconto padrão (ver CLAUDE.md "Cadastro de produtos").
  async function atualizarDescontoProfissional(percentual: number | null) {
    const resposta = await apiAdmin.put<{ desconto_profissional_percentual: number | null }>(
      "/estabelecimento/desconto-profissional",
      { percentual }
    )
    setEstabelecimento((atual) =>
      atual
        ? { ...atual, desconto_profissional_percentual: resposta.desconto_profissional_percentual }
        : atual
    )
    return resposta.desconto_profissional_percentual
  }

  return {
    estabelecimento,
    loading,
    atualizarIcones,
    atualizarDados,
    atualizarHorario,
    atualizarLogo,
    atualizarAviso,
    renovar,
    verificarRenovacao,
    atualizarDescontoProfissional,
    recarregar: carregar,
  }
}
