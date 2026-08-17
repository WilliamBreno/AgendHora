import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Produto, ProdutoInput } from "@/types"

function ordenarPorNome(produtos: Produto[]) {
  return [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Produto[]>("/produtos")
      setProdutos(ordenarPorNome(dados))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar produtos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: ProdutoInput) {
    const criado = await apiAdmin.post<Produto>("/produtos", input)
    setProdutos((atual) => ordenarPorNome([...atual, criado]))
    return criado
  }

  async function atualizar(id: number, input: ProdutoInput) {
    const atualizado = await apiAdmin.put<Produto>(`/produtos/${id}`, input)
    setProdutos((atual) => ordenarPorNome(atual.map((p) => (p.id === id ? atualizado : p))))
    return atualizado
  }

  async function excluir(id: number) {
    await apiAdmin.delete(`/produtos/${id}`)
    setProdutos((atual) => atual.filter((p) => p.id !== id))
  }

  return { produtos, loading, criar, atualizar, excluir, recarregar: carregar }
}
