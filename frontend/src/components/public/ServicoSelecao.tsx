import { DynamicIcon } from "@/lib/icons"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { cn } from "@/lib/utils"
import { formatarDuracao, formatarPreco } from "@/lib/formatacao"
import type { Servico } from "@/types"

interface ServicoSelecaoProps {
  servicos: Servico[]
  onSelecionar: (servico: Servico) => void
}

export function ServicoSelecao({ servicos, onSelecionar }: ServicoSelecaoProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {servicos.map((servico) => {
        const cores = CORES_SERVICO_CLASSES[servico.cor]
        return (
          <button
            key={servico.id}
            type="button"
            onClick={() => onSelecionar(servico)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
          >
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                cores.bgSoft
              )}
            >
              <DynamicIcon name={servico.icone} className={cn("size-5", cores.text)} />
            </div>
            <div className="flex-1">
              <p className="font-heading font-semibold">{servico.nome}</p>
              {servico.descricao && (
                <p className="text-sm text-muted-foreground">{servico.descricao}</p>
              )}
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{formatarPreco(servico.preco)}</span>
                <span>·</span>
                <span>{formatarDuracao(servico.duracao_min)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
