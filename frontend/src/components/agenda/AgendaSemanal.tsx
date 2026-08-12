import { DIAS_SEMANA_PT, type DiaCalendario } from "@/lib/calendario"
import { AgendamentoPill } from "@/components/agenda/AgendamentoPill"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Agendamento } from "@/types"

const MAX_PILULAS_VISIVEIS = 6

interface AgendaSemanalProps {
  dias: DiaCalendario[]
  agendamentosPorDia: Record<string, Agendamento[]>
  onAgendamentoClick: (agendamento: Agendamento) => void
}

// Reaproveita a mesma AgendamentoPill e o mesmo padrão de "+N mais" da
// visão mensal — só muda o layout (uma semana só, células mais altas).
export function AgendaSemanal({ dias, agendamentosPorDia, onAgendamentoClick }: AgendaSemanalProps) {
  return (
    <div className="min-w-[640px] overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {dias.map((dia, i) => (
          <div key={dia.data} className="border-r border-border px-2 py-2 text-center last:border-r-0">
            <p className="text-xs font-medium text-muted-foreground">{DIAS_SEMANA_PT[i]}</p>
            <span
              className={cn(
                "mt-1 inline-flex size-6 items-center justify-center rounded-full text-sm",
                dia.hoje && "bg-primary font-semibold text-primary-foreground"
              )}
            >
              {dia.dia}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const agendamentosDoDia = agendamentosPorDia[dia.data] ?? []
          const visiveis = agendamentosDoDia.slice(0, MAX_PILULAS_VISIVEIS)
          const ocultos = agendamentosDoDia.slice(MAX_PILULAS_VISIVEIS)

          return (
            <div
              key={dia.data}
              className="flex min-h-48 flex-col gap-1 border-r border-border p-1.5 last:border-r-0"
            >
              {visiveis.map((ag) => (
                <AgendamentoPill key={ag.id} agendamento={ag} onClick={() => onAgendamentoClick(ag)} />
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
          )
        })}
      </div>
    </div>
  )
}
