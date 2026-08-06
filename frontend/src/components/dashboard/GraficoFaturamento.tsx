import { useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { formatarPreco } from "@/lib/formatacao"
import type { PontoGrafico } from "@/types"

interface GraficoFaturamentoProps {
  dados7: PontoGrafico[]
  dados30: PontoGrafico[]
}

function formatarDataCurta(data: string) {
  const [, mes, dia] = data.split("-")
  return `${dia}/${mes}`
}

export function GraficoFaturamento({ dados7, dados30 }: GraficoFaturamentoProps) {
  const [periodo, setPeriodo] = useState<"7" | "30">("7")
  const dados = (periodo === "7" ? dados7 : dados30).map((p) => ({
    ...p,
    label: formatarDataCurta(p.data),
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-medium">Faturamento</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={periodo === "7" ? "secondary" : "ghost"}
            onClick={() => setPeriodo("7")}
          >
            7 dias
          </Button>
          <Button
            type="button"
            size="sm"
            variant={periodo === "30" ? "secondary" : "ghost"}
            onClick={() => setPeriodo("30")}
          >
            30 dias
          </Button>
        </div>
      </div>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="corFaturamento" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              interval={periodo === "30" ? 4 : 0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v: number) => `R$${v}`}
              width={56}
            />
            <Tooltip
              formatter={(value) => formatarPreco(Number(value))}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Area
              type="monotone"
              dataKey="valor"
              stroke="var(--color-primary)"
              fill="url(#corFaturamento)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
