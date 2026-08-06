import { NumberTicker } from "@/components/ui/number-ticker"
import type { PeriodoMetricas } from "@/types"

interface MetricaCardProps {
  titulo: string
  metricas: PeriodoMetricas
}

export function MetricaCard({ titulo, metricas }: MetricaCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className="font-heading text-2xl font-semibold text-foreground">
        R$ <NumberTicker value={metricas.faturamento} decimalPlaces={2} />
      </p>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <NumberTicker value={metricas.agendamentos} className="font-medium text-foreground" />{" "}
          agendamentos
        </span>
        <span>
          <NumberTicker
            value={metricas.ainda_vao_acontecer}
            className="font-medium text-foreground"
          />{" "}
          a acontecer
        </span>
      </div>
    </div>
  )
}
