import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { formatarPreco } from "@/lib/formatacao"
import { cn } from "@/lib/utils"
import type { RankingItem } from "@/types"

interface RankingServicosProps {
  titulo: string
  itens: RankingItem[]
  metrica: "quantidade" | "faturamento"
}

export function RankingServicos({ titulo, itens, metrica }: RankingServicosProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading font-medium">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sem dados ainda esse mês.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {itens.map((item, i) => (
            <li key={item.servico_id} className="flex items-center gap-3">
              <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
              <span
                className={cn("size-2.5 shrink-0 rounded-full", CORES_SERVICO_CLASSES[item.cor].bg)}
              />
              <span className="flex-1 truncate text-sm">{item.nome}</span>
              <span className="text-sm font-medium">
                {metrica === "quantidade" ? `${item.quantidade}x` : formatarPreco(item.faturamento)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
