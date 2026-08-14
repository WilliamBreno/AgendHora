import { useEffect, useState } from "react"
import { ChevronDown, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Agendamento } from "@/types"

export interface FinanceiroInput {
  valor_final: number | null
  valor_sinal: number | null
  sinal_pago: boolean
  link_referencia: string
}

interface AgendamentoFinanceiroSectionProps {
  agendamento: Agendamento
  // destaque = true quando Estabelecimento.segmento === "tatuagem" — mostra
  // a seção já aberta, em vez de escondida atrás de "mais opções" (ver
  // CLAUDE.md "Segmentos de negócio").
  destaque: boolean
  onSalvar: (id: number, dados: FinanceiroInput) => Promise<Agendamento>
}

// Valor final, sinal (+ se já foi pago) e link de referência — campos
// genéricos, úteis pra qualquer estabelecimento, não só quem usa segmento
// "tatuagem" (que só muda se essa seção nasce aberta ou escondida atrás de
// "mais opções").
export function AgendamentoFinanceiroSection({
  agendamento,
  destaque,
  onSalvar,
}: AgendamentoFinanceiroSectionProps) {
  const [aberto, setAberto] = useState(destaque)
  const [valorFinal, setValorFinal] = useState("")
  const [valorSinal, setValorSinal] = useState("")
  const [sinalPago, setSinalPago] = useState(false)
  const [linkReferencia, setLinkReferencia] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setValorFinal(agendamento.valor_final !== null ? String(agendamento.valor_final) : "")
    setValorSinal(agendamento.valor_sinal !== null ? String(agendamento.valor_sinal) : "")
    setSinalPago(agendamento.sinal_pago)
    setLinkReferencia(agendamento.link_referencia)
    setAberto(destaque)
  }, [agendamento.id, destaque, agendamento.valor_final, agendamento.valor_sinal, agendamento.sinal_pago, agendamento.link_referencia])

  const alterado =
    valorFinal !== (agendamento.valor_final !== null ? String(agendamento.valor_final) : "") ||
    valorSinal !== (agendamento.valor_sinal !== null ? String(agendamento.valor_sinal) : "") ||
    sinalPago !== agendamento.sinal_pago ||
    linkReferencia !== agendamento.link_referencia

  async function handleSalvar() {
    setSalvando(true)
    try {
      await onSalvar(agendamento.id, {
        valor_final: valorFinal === "" ? null : Number(valorFinal),
        valor_sinal: valorSinal === "" ? null : Number(valorSinal),
        sinal_pago: sinalPago,
        link_referencia: linkReferencia.trim(),
      })
      toast.success("Dados financeiros atualizados.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={cn("rounded-lg border border-border", destaque && "border-primary/30 bg-primary/[0.03]")}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
      >
        <span>Valor final, sinal e referência</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="valor_final" className="text-xs">
                Valor final (R$)
              </Label>
              <Input
                id="valor_final"
                type="number"
                min={0}
                step="0.01"
                value={valorFinal}
                onChange={(e) => setValorFinal(e.target.value)}
                placeholder={
                  agendamento.servico.preco !== null ? String(agendamento.servico.preco) : "A combinar"
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="valor_sinal" className="text-xs">
                Sinal (R$)
              </Label>
              <Input
                id="valor_sinal"
                type="number"
                min={0}
                step="0.01"
                value={valorSinal}
                onChange={(e) => setValorSinal(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={sinalPago}
              disabled={valorSinal === ""}
              onChange={(e) => setSinalPago(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Sinal já foi pago
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="link_referencia" className="text-xs">
              Link de referência
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="link_referencia"
                value={linkReferencia}
                onChange={(e) => setLinkReferencia(e.target.value)}
                placeholder="https://..."
              />
              {agendamento.link_referencia && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  render={<a href={agendamento.link_referencia} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Abrir link</span>
                </Button>
              )}
            </div>
          </div>

          <Button type="button" size="sm" onClick={handleSalvar} disabled={salvando || !alterado}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  )
}
