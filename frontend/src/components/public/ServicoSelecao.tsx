import { DynamicIcon } from "@/lib/icons"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { cn } from "@/lib/utils"
import { formatarDuracao, formatarPrecoServico } from "@/lib/formatacao"
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
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md"
          >
            {servico.foto && (
              <img
                src={servico.foto}
                alt={servico.nome}
                className="h-32 w-full object-cover"
              />
            )}
            <div className="flex flex-1 items-center gap-3 p-4">
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
                  <span className="font-medium text-foreground">
                    {formatarPrecoServico(servico.preco, servico.preco_a_partir)}
                  </span>
                  <span>·</span>
                  <span>{formatarDuracao(servico.duracao_min)}</span>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
