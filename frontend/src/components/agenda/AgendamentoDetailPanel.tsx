import { useState } from "react"
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
import { formatarDataExibicao, formatarPrecoServico } from "@/lib/formatacao"
import type { Agendamento, StatusAgendamento } from "@/types"

interface AgendamentoDetailPanelProps {
  agendamento: Agendamento | null
  onOpenChange: (open: boolean) => void
  onCancelar: (id: number) => Promise<void>
}

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  pendente: "Pendente",
}

export function AgendamentoDetailPanel({
  agendamento,
  onOpenChange,
  onCancelar,
}: AgendamentoDetailPanelProps) {
  const [cancelando, setCancelando] = useState(false)

  async function handleCancelar() {
    if (!agendamento) return
    setCancelando(true)
    try {
      await onCancelar(agendamento.id)
    } finally {
      setCancelando(false)
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
                  <p className="font-medium">{agendamento.servico.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {agendamento.servico.duracao_min} min ·{" "}
                    {formatarPrecoServico(agendamento.servico.preco, agendamento.servico.preco_a_partir)}
                  </p>
                </div>
              </div>

              <dl className="flex flex-col gap-2 text-sm">
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
              </dl>

              {agendamento.observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{agendamento.observacoes}</p>
                </div>
              )}
            </div>

            <SheetFooter>
              {agendamento.status !== "cancelado" && (
                <Button
                  variant="outline"
                  onClick={handleCancelar}
                  disabled={cancelando}
                  className="text-destructive hover:text-destructive"
                >
                  {cancelando ? "Cancelando..." : "Cancelar agendamento"}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
