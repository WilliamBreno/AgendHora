import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { nomesServicos } from "@/lib/formatacao"
import { cn } from "@/lib/utils"
import type { Agendamento } from "@/types"

interface AgendamentoPillProps {
  agendamento: Agendamento
  onClick: () => void
}

export function AgendamentoPill({ agendamento, onClick }: AgendamentoPillProps) {
  // cor do serviço principal (ver CLAUDE.md "Agendamento com mais de um
  // serviço") — um "+N" ao lado do nome avisa que tem mais serviços.
  const cores = CORES_SERVICO_CLASSES[agendamento.servico.cor]
  const cancelado = agendamento.status === "cancelado"
  const extras = agendamento.servicos.length - 1

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        agendamento.encaixe
          ? "Encaixe — sobreposto a outro agendamento"
          : `${agendamento.hora} ${agendamento.cliente_nome} — ${nomesServicos(agendamento.servicos)}`
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
        {extras > 0 && ` +${extras}`}
      </span>
    </button>
  )
}
