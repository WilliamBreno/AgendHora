import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Servico, ServicoInput } from "@/types"

function ordenarPorNome(servicos: Servico[]) {
  return [...servicos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export function useServicos() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Servico[]>("/servicos")
      setServicos(ordenarPorNome(dados))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar serviços")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: ServicoInput) {
    const criado = await apiAdmin.post<Servico>("/servicos", input)
    setServicos((atual) => ordenarPorNome([...atual, criado]))
    return criado
  }

  async function atualizar(id: number, input: ServicoInput) {
    const atualizado = await apiAdmin.put<Servico>(`/servicos/${id}`, input)
    setServicos((atual) => ordenarPorNome(atual.map((s) => (s.id === id ? atualizado : s))))
    return atualizado
  }

  async function excluir(id: number) {
    await apiAdmin.delete(`/servicos/${id}`)
    setServicos((atual) => atual.filter((s) => s.id !== id))
  }

  return { servicos, loading, criar, atualizar, excluir, recarregar: carregar }
}
