import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useHistoricoCliente } from "@/hooks/useHistoricoCliente"
import { formatarDataExibicao, formatarPrecoTotalServicos, nomesServicos } from "@/lib/formatacao"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { DynamicIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { Cliente, StatusAgendamento } from "@/types"

interface ClienteHistoricoSheetProps {
  cliente: Cliente | null
  onOpenChange: (open: boolean) => void
}

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  pendente: "Pendente",
}

export function ClienteHistoricoSheet({ cliente, onOpenChange }: ClienteHistoricoSheetProps) {
  const { agendamentos, loading } = useHistoricoCliente(cliente?.id ?? null)

  return (
    <Sheet open={cliente !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {cliente && (
          <>
            <SheetHeader>
              <SheetTitle>{cliente.nome}</SheetTitle>
              <SheetDescription>
                {cliente.telefone} · Histórico completo de agendamentos
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-3 px-4 pb-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : agendamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esse cliente ainda não tem agendamentos.
                </p>
              ) : (
                agendamentos.map((ag) => {
                  const cores = CORES_SERVICO_CLASSES[ag.servico.cor]
                  return (
                    <div
                      key={ag.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          cores.bgSoft
                        )}
                      >
                        <DynamicIcon name={ag.servico.icone} className={cn("size-4", cores.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{nomesServicos(ag.servicos)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatarDataExibicao(ag.data)} às {ag.hora} ·{" "}
                          {formatarPrecoTotalServicos(ag.servicos)}
                        </p>
                        {ag.profissional_nome && (
                          <p className="text-xs text-muted-foreground">
                            com {ag.profissional_nome}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            ag.status === "cancelado" ? "text-muted-foreground" : "text-primary"
                          )}
                        >
                          {STATUS_LABEL[ag.status]}
                        </span>
                        {ag.status !== "cancelado" && (
                          <span className="text-xs text-muted-foreground">
                            {ag.pago ? "Pago" : "Não pago"}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
