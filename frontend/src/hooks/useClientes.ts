import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, enviarArquivoAdmin, ApiError } from "@/lib/api"
import type { Cliente, ClienteInput, ImportacaoClientesResultado } from "@/types"

export type FiltroClientes = "todos" | "mes" | "semana" | "sumidos"

const FILTRO_QUERY: Record<FiltroClientes, string> = {
  todos: "",
  mes: "?aniversariantes=mes",
  semana: "?aniversariantes=semana",
  sumidos: "?sumidos=true",
}

export function useClientes(filtro: FiltroClientes = "todos") {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<Cliente[]>(`/clientes${FILTRO_QUERY[filtro]}`)
      setClientes(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar clientes")
    } finally {
      setLoading(false)
    }
  }, [filtro])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: ClienteInput) {
    const criado = await apiAdmin.post<Cliente>("/clientes", input)
    await carregar()
    return criado
  }

  async function atualizar(id: number, input: ClienteInput) {
    const atualizado = await apiAdmin.put<Cliente>(`/clientes/${id}`, input)
    await carregar()
    return atualizado
  }

  async function importar(arquivo: File) {
    const resultado = await enviarArquivoAdmin<ImportacaoClientesResultado>(
      "/clientes/importar",
      "arquivo",
      arquivo
    )
    await carregar()
    return resultado
  }

  return { clientes, loading, criar, atualizar, importar, recarregar: carregar }
}
