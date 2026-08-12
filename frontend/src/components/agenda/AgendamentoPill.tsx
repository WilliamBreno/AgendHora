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
      title={
        agendamento.encaixe
          ? "Encaixe — sobreposto a outro agendamento"
          : `${agendamento.hora} ${agendamento.cliente_nome} — ${agendamento.servico.nome}`
      }
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-opacity hover:opacity-80",
        cores.bgSoft,
        cores.text,
        cancelado && "opacity-50",
        agendamento.encaixe && "border border-dashed border-current"
      )}
    >
      <span className={cn("w-full truncate text-xs font-semibold", cancelado && "line-through")}>
        {agendamento.hora} {agendamento.cliente_nome}
      </span>
      <span className="w-full truncate text-[11px] leading-tight font-normal opacity-80">
        {agendamento.servico.nome}
      </span>
    </button>
  )
}
