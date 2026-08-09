import { AgendamentoPill } from "@/components/agenda/AgendamentoPill"
import type { Agendamento } from "@/types"

interface AgendaDiariaProps {
  agendamentos: Agendamento[]
  onAgendamentoClick: (agendamento: Agendamento) => void
}

// Lista vertical do dia, reaproveitando a mesma AgendamentoPill das outras
// visões — já vem ordenada por hora (ver AgendaPage).
export function AgendaDiaria({ agendamentos, onAgendamentoClick }: AgendaDiariaProps) {
  if (agendamentos.length === 0) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum agendamento nesse dia.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      {agendamentos.map((ag) => (
        <AgendamentoPill key={ag.id} agendamento={ag} onClick={() => onAgendamentoClick(ag)} />
      ))}
    </div>
  )
}
