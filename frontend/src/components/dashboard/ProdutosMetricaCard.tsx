import { NumberTicker } from "@/components/ui/number-ticker"
import { formatarPreco } from "@/lib/formatacao"
import type { ProdutosMetricas } from "@/types"

interface ProdutosMetricaCardProps {
  titulo: string
  metricas: ProdutosMetricas
}

// Só existe pro dono (ver CLAUDE.md "Cadastro de produtos") — vendas de
// produto pro cliente final não têm profissional atribuído, então não dá
// pra escopar corretamente pra um auxiliar específico.
export function ProdutosMetricaCard({ titulo, metricas }: ProdutosMetricaCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      <p className="font-heading text-2xl font-semibold text-foreground">
        R$ <NumberTicker value={metricas.faturamento} decimalPlaces={2} />
      </p>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <NumberTicker value={metricas.quantidade} className="font-medium text-foreground" />{" "}
          vendidos
        </span>
        {metricas.lucro > 0 && (
          <span>
            <span className="font-medium text-servico-verde-salvia">
              {formatarPreco(metricas.lucro)}
            </span>{" "}
            de lucro
          </span>
        )}
      </div>
    </div>
  )
}
