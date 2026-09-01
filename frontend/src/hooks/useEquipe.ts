import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { ConvitePendente, Equipe, PapelUsuario, Usuario } from "@/types"

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

  // resposta enxuta dos dois endpoints abaixo (profissionalResponse no
  // backend) — só os campos que realmente mudam, não o Usuario inteiro.
  type RespostaProfissional = Pick<
    Usuario,
    "id" | "nome" | "email" | "telefone" | "papel" | "pode_cadastrar_servico_individual"
  >

  function atualizarNaLista(atualizado: RespostaProfissional) {
    setEquipe((atual) =>
      atual
        ? {
            ...atual,
            profissionais: atual.profissionais.map((p) =>
              p.id === atualizado.id ? { ...p, ...atualizado } : p
            ),
          }
        : atual
    )
  }

  // atualizarPapel promove um auxiliar a dono (acesso completo) ou rebaixa
  // um dono de volta a auxiliar — reversível, nunca aceita mudar o próprio
  // papel (backend rejeita). Quem for alterado só vê o efeito depois de
  // sair e entrar de novo (o token já emitido carrega o papel antigo).
  async function atualizarPapel(id: number, papel: PapelUsuario) {
    const atualizado = await apiAdmin.patch<RespostaProfissional>(`/profissionais/${id}/papel`, { papel })
    atualizarNaLista(atualizado)
    return atualizado
  }

  // atualizarPermissoes liga/desliga a permissão de um auxiliar criar
  // serviço individual (ver CLAUDE.md "Serviços individuais").
  async function atualizarPermissoes(id: number, podeCadastrarServicoIndividual: boolean) {
    const atualizado = await apiAdmin.patch<RespostaProfissional>(`/profissionais/${id}/permissoes`, {
      pode_cadastrar_servico_individual: podeCadastrarServicoIndividual,
    })
    atualizarNaLista(atualizado)
    return atualizado
  }

  return {
    equipe,
    loading,
    convidar,
    atualizarPapel,
    atualizarPermissoes,
    recarregar: carregar,
  }
}
