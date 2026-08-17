import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { VendaProduto, VendaProdutoInput } from "@/types"

interface FiltrosVendasProdutos {
  inicio?: string
  fim?: string
  tipoComprador?: VendaProduto["tipo_comprador"]
  agendamentoId?: number
}

function construirQuery(filtros?: FiltrosVendasProdutos) {
  if (!filtros) return ""
  const params = new URLSearchParams()
  if (filtros.inicio) params.set("inicio", filtros.inicio)
  if (filtros.fim) params.set("fim", filtros.fim)
  if (filtros.tipoComprador) params.set("tipo_comprador", filtros.tipoComprador)
  if (filtros.agendamentoId) params.set("agendamento_id", String(filtros.agendamentoId))
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function useVendasProdutos(filtros?: FiltrosVendasProdutos) {
  const [vendas, setVendas] = useState<VendaProduto[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiAdmin.get<VendaProduto[]>(`/vendas-produtos${construirQuery(filtros)}`)
      setVendas(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar vendas")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros?.inicio, filtros?.fim, filtros?.tipoComprador, filtros?.agendamentoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function registrar(input: VendaProdutoInput) {
    const criada = await apiAdmin.post<VendaProduto>("/vendas-produtos", input)
    setVendas((atual) => [criada, ...atual])
    return criada
  }

  async function atualizarPago(id: number, pago: boolean) {
    const atualizada = await apiAdmin.patch<VendaProduto>(`/vendas-produtos/${id}/pago`, { pago })
    setVendas((atual) => atual.map((v) => (v.id === id ? atualizada : v)))
    return atualizada
  }

  async function cancelar(id: number) {
    const cancelada = await apiAdmin.patch<VendaProduto>(`/vendas-produtos/${id}/cancelar`, {})
    setVendas((atual) => atual.map((v) => (v.id === id ? cancelada : v)))
    return cancelada
  }

  return { vendas, loading, registrar, atualizarPago, cancelar, recarregar: carregar }
}
