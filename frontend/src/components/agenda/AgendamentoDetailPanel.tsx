import { useState } from "react"
import { CheckCircle2, CircleDollarSign, ShoppingCart } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { DynamicIcon } from "@/lib/icons"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { cn } from "@/lib/utils"
import {
  duracaoEfetivaMin,
  formatarDataExibicao,
  formatarDuracao,
  formatarPrecoTotalServicos,
  nomesServicos,
} from "@/lib/formatacao"
import {
  AgendamentoFinanceiroSection,
  type FinanceiroInput,
} from "@/components/agenda/AgendamentoFinanceiroSection"
import { VendaProdutoDialog } from "@/components/produtos/VendaProdutoDialog"
import type { Agendamento, Produto, StatusAgendamento, Usuario, VendaProdutoInput } from "@/types"

interface AgendamentoDetailPanelProps {
  agendamento: Agendamento | null
  // segmento do estabelecimento (ver CLAUDE.md "Segmentos de negócio") —
  // "tatuagem" abre a seção de valor final/sinal/referência já em destaque.
  segmento: string
  onOpenChange: (open: boolean) => void
  onCancelar: (id: number) => Promise<void>
  onAtualizarPago: (id: number, pago: boolean) => Promise<void>
  onAtualizarFinanceiro: (id: number, dados: FinanceiroInput) => Promise<Agendamento>
  onConcluir: (id: number) => Promise<void>
  onReagendarClick: () => void
  // produtos que o cliente pode levar junto do serviço (ver CLAUDE.md
  // "Cadastro de produtos") — só o essencial pra registrar a venda vinculada.
  produtos: Produto[]
  profissionais: Usuario[]
  usuarioAtualId: number
  descontoPadrao: number | null
  onRegistrarVendaProduto: (input: VendaProdutoInput) => Promise<void>
}

function formatarHoraConclusao(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  pendente: "Pendente",
}

export function AgendamentoDetailPanel({
  agendamento,
  segmento,
  onOpenChange,
  onCancelar,
  onAtualizarPago,
  onAtualizarFinanceiro,
  onConcluir,
  onReagendarClick,
  produtos,
  profissionais,
  usuarioAtualId,
  descontoPadrao,
  onRegistrarVendaProduto,
}: AgendamentoDetailPanelProps) {
  const [cancelando, setCancelando] = useState(false)
  const [salvandoPago, setSalvandoPago] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const [vendaAberta, setVendaAberta] = useState(false)

  async function handleCancelar() {
    if (!agendamento) return
    setCancelando(true)
    try {
      await onCancelar(agendamento.id)
    } finally {
      setCancelando(false)
    }
  }

  async function handleConcluir() {
    if (!agendamento) return
    setConcluindo(true)
    try {
      await onConcluir(agendamento.id)
    } finally {
      setConcluindo(false)
    }
  }

  async function handleTogglePago(pago: boolean) {
    if (!agendamento) return
    setSalvandoPago(true)
    try {
      await onAtualizarPago(agendamento.id, pago)
    } finally {
      setSalvandoPago(false)
    }
  }

  return (
    <Sheet open={agendamento !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {agendamento && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{agendamento.cliente_nome}</SheetTitle>
                {agendamento.encaixe && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Encaixe
                  </span>
                )}
              </div>
              <SheetDescription>{agendamento.cliente_telefone}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    CORES_SERVICO_CLASSES[agendamento.servico.cor].bgSoft
                  )}
                >
                  <DynamicIcon
                    name={agendamento.servico.icone}
                    className={cn("size-4", CORES_SERVICO_CLASSES[agendamento.servico.cor].text)}
                  />
                </div>
                <div>
                  <p className="font-medium">{nomesServicos(agendamento.servicos)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatarDuracao(
                      agendamento.servicos.reduce((soma, s) => soma + duracaoEfetivaMin(s), 0)
                    )}{" "}
                    · {formatarPrecoTotalServicos(agendamento.servicos)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTogglePago(!agendamento.pago)}
                disabled={salvandoPago}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  agendamento.pago
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {agendamento.pago ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <CircleDollarSign className="size-4" />
                )}
                {salvandoPago
                  ? "Atualizando..."
                  : agendamento.pago
                    ? "Pago"
                    : "Marcar como pago"}
              </button>

              <dl className="flex flex-col gap-2 text-sm">
                {agendamento.profissional_nome && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Profissional</dt>
                    <dd className="font-medium">{agendamento.profissional_nome}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Data</dt>
                  <dd className="font-medium">{formatarDataExibicao(agendamento.data)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Horário</dt>
                  <dd className="font-medium">{agendamento.hora}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">{STATUS_LABEL[agendamento.status]}</dd>
                </div>
                {agendamento.concluido_em && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Concluído às</dt>
                    <dd className="font-medium">{formatarHoraConclusao(agendamento.concluido_em)}</dd>
                  </div>
                )}
              </dl>

              {agendamento.observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{agendamento.observacoes}</p>
                </div>
              )}

              {/* Só existe pra segmento "tatuagem" — pra qualquer outro
                  segmento, essa seção nem aparece no painel (ver CLAUDE.md
                  "Segmentos de negócio"). */}
              {segmento === "tatuagem" && (
                <AgendamentoFinanceiroSection
                  agendamento={agendamento}
                  onSalvar={onAtualizarFinanceiro}
                />
              )}
            </div>

            <SheetFooter>
              {agendamento.status !== "cancelado" && (
                <>
                  {agendamento.status === "confirmado" && !agendamento.concluido_em && (
                    <Button onClick={handleConcluir} disabled={concluindo}>
                      {concluindo ? "Concluindo..." : "Concluir agora"}
                    </Button>
                  )}
                  {produtos.length > 0 && (
                    <Button variant="outline" onClick={() => setVendaAberta(true)}>
                      <ShoppingCart className="size-4" />
                      Vender produto
                    </Button>
                  )}
                  <Button variant="outline" onClick={onReagendarClick}>
                    Reagendar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelar}
                    disabled={cancelando}
                    className="text-destructive hover:text-destructive"
                  >
                    {cancelando ? "Cancelando..." : "Cancelar agendamento"}
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>

      {agendamento && (
        <VendaProdutoDialog
          open={vendaAberta}
          onOpenChange={setVendaAberta}
          produtos={produtos}
          profissionais={profissionais}
          usuarioAtualId={usuarioAtualId}
          descontoPadrao={descontoPadrao}
          agendamento={{ id: agendamento.id, clienteNome: agendamento.cliente_nome }}
          onSubmit={onRegistrarVendaProduto}
        />
      )}
    </Sheet>
  )
}
