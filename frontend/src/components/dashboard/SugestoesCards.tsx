import { Lightbulb, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Sugestao } from "@/types"

interface SugestoesCardsProps {
  sugestoes: Sugestao[]
}

export function SugestoesCards({ sugestoes }: SugestoesCardsProps) {
  if (sugestoes.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sugestoes.map((s, i) => {
        const alerta = s.tipo === "alerta"
        return (
          <div
            key={i}
            className={cn(
              "flex gap-3 rounded-xl border p-4",
              alerta
                ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                : "border-servico-teal/30 bg-servico-teal/5"
            )}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                alerta
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  : "bg-servico-teal/15 text-servico-teal"
              )}
            >
              {alerta ? <TrendingDown className="size-4" /> : <Lightbulb className="size-4" />}
            </div>
            <div>
              <p className="font-heading text-sm font-semibold">{s.titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.descricao}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
