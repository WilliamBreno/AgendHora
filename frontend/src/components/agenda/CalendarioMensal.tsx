import { DIAS_SEMANA_PT, type DiaCalendario } from "@/lib/calendario"
import { AgendamentoPill } from "@/components/agenda/AgendamentoPill"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Agendamento } from "@/types"

const MAX_PILULAS_VISIVEIS = 3

interface CalendarioMensalProps {
  semanas: DiaCalendario[][]
  agendamentosPorDia: Record<string, Agendamento[]>
  onAgendamentoClick: (agendamento: Agendamento) => void
}

export function CalendarioMensal({
  semanas,
  agendamentosPorDia,
  onAgendamentoClick,
}: CalendarioMensalProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[2.25rem_repeat(7,1fr)] border-b border-border bg-muted/40">
        <div />
        {DIAS_SEMANA_PT.map((dia) => (
          <div
            key={dia}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {dia}
          </div>
        ))}
      </div>

      {semanas.map((semana, i) => (
        <div
          key={i}
          className="grid grid-cols-[2.25rem_repeat(7,1fr)] border-b border-border last:border-b-0"
        >
          <div className="flex items-center justify-center border-r border-border bg-muted/20">
            <span className="-rotate-90 text-[10px] font-medium whitespace-nowrap text-muted-foreground">
              Semana {i + 1}
            </span>
          </div>
          {semana.map((dia) => {
            const agendamentosDoDia = agendamentosPorDia[dia.data] ?? []
            const visiveis = agendamentosDoDia.slice(0, MAX_PILULAS_VISIVEIS)
            const ocultos = agendamentosDoDia.slice(MAX_PILULAS_VISIVEIS)

            return (
              <div
                key={dia.data}
                className={cn(
                  "flex min-h-24 flex-col gap-1 border-r border-border p-1.5 last:border-r-0",
                  !dia.noMesAtual && "bg-muted/20"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center self-start rounded-full text-xs",
                    !dia.noMesAtual && "text-muted-foreground/50",
                    dia.hoje && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {dia.dia}
                </span>
                <div className="flex flex-col gap-1">
                  {visiveis.map((ag) => (
                    <AgendamentoPill
                      key={ag.id}
                      agendamento={ag}
                      onClick={() => onAgendamentoClick(ag)}
                    />
                  ))}
                  {ocultos.length > 0 && (
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="px-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            +{ocultos.length} mais
                          </button>
                        }
                      />
                      <PopoverContent className="w-56" align="start">
                        <div className="flex flex-col gap-1">
                          {ocultos.map((ag) => (
                            <AgendamentoPill
                              key={ag.id}
                              agendamento={ag}
                              onClick={() => onAgendamentoClick(ag)}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
