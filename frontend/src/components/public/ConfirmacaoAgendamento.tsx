import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatarDataExibicao, formatarPreco } from "@/lib/formatacao"
import type { Agendamento } from "@/types"

interface ConfirmacaoAgendamentoProps {
  agendamento: Agendamento
  onNovoAgendamento: () => void
}

export function ConfirmacaoAgendamento({
  agendamento,
  onNovoAgendamento,
}: ConfirmacaoAgendamentoProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 className="size-12 text-primary" />
      <div>
        <h2 className="font-heading text-xl font-semibold">Agendamento confirmado!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {agendamento.cliente_email
            ? "Enviamos os detalhes para o seu e-mail."
            : "Guarde os detalhes abaixo."}
        </p>
      </div>

      <div className="w-full max-w-xs rounded-xl border border-border bg-card p-4 text-left text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Serviço</span>
          <span className="font-medium">{agendamento.servico.nome}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Data</span>
          <span className="font-medium">{formatarDataExibicao(agendamento.data)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Horário</span>
          <span className="font-medium">{agendamento.hora}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-medium">{formatarPreco(agendamento.servico.preco)}</span>
        </div>
      </div>

      <Button variant="outline" onClick={onNovoAgendamento}>
        Fazer outro agendamento
      </Button>
    </div>
  )
}
