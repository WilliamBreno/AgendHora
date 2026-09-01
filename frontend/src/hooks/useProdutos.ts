import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, enviarArquivoAdmin, ApiError } from "@/lib/api"
import type {
  ImportacaoProdutosResultado,
  ItemImportadoProduto,
  Produto,
  ProdutoInput,
} from "@/types"

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

  // importarPreview só lê o arquivo (PDF ou XLSX) e devolve os itens
  // encontrados — nada é salvo ainda (ver CLAUDE.md "Importação de
  // produtos"). PDF é leitura heurística e pode errar, por isso sempre
  // passa por essa prévia editável antes de confirmar.
  async function importarPreview(arquivo: File) {
    const resposta = await enviarArquivoAdmin<{ itens: ItemImportadoProduto[] }>(
      "/produtos/importar/preview",
      "arquivo",
      arquivo
    )
    return resposta.itens
  }

  async function importarConfirmar(itens: ItemImportadoProduto[]) {
    const resultado = await apiAdmin.post<ImportacaoProdutosResultado>(
      "/produtos/importar/confirmar",
      { itens }
    )
    await carregar()
    return resultado
  }

  return {
    produtos,
    loading,
    criar,
    atualizar,
    excluir,
    importarPreview,
    importarConfirmar,
    recarregar: carregar,
  }
}
