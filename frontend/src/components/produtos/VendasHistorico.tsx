import { useState } from "react"
import { Check, Package, X } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useVendasProdutos } from "@/hooks/useVendasProdutos"
import { formatarDataCurta, formatarPreco } from "@/lib/formatacao"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { TipoCompradorVenda, VendaProduto } from "@/types"

const FILTROS: { valor: TipoCompradorVenda | "todas"; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "cliente", label: "Clientes" },
  { valor: "profissional", label: "Equipe" },
]

// VendasHistorico lista as vendas de produto já registradas — pra cliente
// final (avulsa ou junto de um agendamento) e pra compra interna da equipe
// (ver CLAUDE.md "Cadastro de produtos"). É onde o dono responde "quanto a
// equipe já consumiu internamente": filtro "Equipe" mostra só as compras com
// `tipo_comprador = "profissional"`.
export function VendasHistorico() {
  const [filtro, setFiltro] = useState<TipoCompradorVenda | "todas">("todas")
  const { vendas, loading, atualizarPago, cancelar } = useVendasProdutos(
    filtro === "todas" ? undefined : { tipoComprador: filtro }
  )
  const [paraCancelar, setParaCancelar] = useState<VendaProduto | null>(null)
  const [cancelando, setCancelando] = useState(false)

  async function alternarPago(venda: VendaProduto) {
    try {
      await atualizarPago(venda.id, !venda.pago)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar pagamento")
    }
  }

  async function confirmarCancelamento() {
    if (!paraCancelar) return
    setCancelando(true)
    try {
      await cancelar(paraCancelar.id)
      toast.success("Venda cancelada — estoque devolvido.")
      setParaCancelar(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao cancelar venda")
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filtro === f.valor
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : vendas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma venda registrada
          {filtro === "profissional" ? " pra equipe" : filtro === "cliente" ? " pra clientes" : ""}{" "}
          ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {vendas.map((venda) => (
            <div
              key={venda.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm",
                venda.cancelada && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Package className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {venda.produto.nome}
                    <span className="ml-1 font-normal text-muted-foreground">
                      × {venda.quantidade}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {venda.tipo_comprador === "profissional" ? (
                      <>Equipe · {venda.profissional?.nome ?? "—"}</>
                    ) : (
                      <>Cliente · {venda.cliente?.nome ?? "Avulso"}</>
                    )}
                    {" · "}
                    {formatarDataCurta(venda.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-heading font-semibold">{formatarPreco(venda.valor_total)}</p>
                  {venda.percentual_desconto ? (
                    <p className="text-xs text-muted-foreground">
                      Desconto {venda.percentual_desconto}%
                    </p>
                  ) : null}
                </div>

                {venda.cancelada ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Cancelada
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => alternarPago(venda)}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                        venda.pago
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <Check className="size-3" />
                      {venda.pago ? "Pago" : "Marcar pago"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setParaCancelar(venda)}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-3" />
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={paraCancelar !== null}
        onOpenChange={(open) => !open && setParaCancelar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a venda de "{paraCancelar?.produto.nome}"? A
              quantidade volta pro estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarCancelamento}
              disabled={cancelando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelando ? "Cancelando..." : "Cancelar venda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
