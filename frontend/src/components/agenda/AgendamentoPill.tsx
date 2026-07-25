import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { cn } from "@/lib/utils"
import type { Agendamento } from "@/types"

interface AgendamentoPillProps {
  agendamento: Agendamento
  onClick: () => void
}

export function AgendamentoPill({ agendamento, onClick }: AgendamentoPillProps) {
  const cores = CORES_SERVICO_CLASSES[agendamento.servico.cor]
  const cancelado = agendamento.status === "cancelado"

  return (
    <button
      type="button"
      onClick={onClick}
      title={agendamento.encaixe ? "Encaixe — sobreposto a outro agendamento" : undefined}
      className={cn(
        "w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium transition-opacity hover:opacity-80",
        cores.bgSoft,
        cores.text,
        cancelado && "line-through opacity-50",
        agendamento.encaixe && "border border-dashed border-current"
      )}
    >
      {agendamento.hora} {agendamento.cliente_nome}
    </button>
  )
}
