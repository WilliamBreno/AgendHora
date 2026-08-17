import { formatarPreco } from "@/lib/formatacao"
import type { ProdutoRankingItem } from "@/types"

interface RankingProdutosProps {
  itens: ProdutoRankingItem[]
}

export function RankingProdutos({ itens }: RankingProdutosProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading font-medium">Produtos mais vendidos esse mês</h2>
      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sem vendas de produto ainda esse mês.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {itens.map((item, i) => (
            <li key={item.produto_id} className="flex items-center gap-3">
              <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate text-sm">{item.nome}</span>
              <span className="text-sm text-muted-foreground">{item.quantidade}x</span>
              <span className="text-sm font-medium">{formatarPreco(item.faturamento)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
