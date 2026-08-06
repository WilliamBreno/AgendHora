import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { DynamicIcon } from "@/lib/icons"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { cn } from "@/lib/utils"
import { formatarDuracao, formatarPrecoServico } from "@/lib/formatacao"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Servico } from "@/types"

interface ServicoCardProps {
  servico: Servico
  onEdit: () => void
  onDelete: () => void
}

export function ServicoCard({ servico, onEdit, onDelete }: ServicoCardProps) {
  const cores = CORES_SERVICO_CLASSES[servico.cor]

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn("w-1.5 shrink-0", cores.bg)} />
      <div className="flex flex-1 items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          {servico.foto ? (
            <img
              src={servico.foto}
              alt={servico.nome}
              className="size-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                cores.bgSoft
              )}
            >
              <DynamicIcon name={servico.icone} className={cn("size-5", cores.text)} />
            </div>
          )}
          <div>
            <h3 className="font-heading font-semibold">{servico.nome}</h3>
            {servico.descricao && (
              <p className="mt-0.5 text-sm text-muted-foreground">{servico.descricao}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-heading font-medium text-foreground">
                {formatarPrecoServico(servico.preco, servico.preco_a_partir)}
              </span>
              <span>·</span>
              <span>{formatarDuracao(servico.duracao_min)}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Ações do serviço">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
