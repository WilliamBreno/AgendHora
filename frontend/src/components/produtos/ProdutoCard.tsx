import { AlertTriangle, MoreVertical, Package, Pencil, ShoppingCart, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatarPreco } from "@/lib/formatacao"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Produto } from "@/types"

interface ProdutoCardProps {
  produto: Produto
  onEdit: () => void
  onVender: () => void
  onDelete: () => void
  onToggleAtivo: () => void
}

export function ProdutoCard({ produto, onEdit, onVender, onDelete, onToggleAtivo }: ProdutoCardProps) {
  // estoque_minimo = 0 desativa o alerta pra esse produto (ver CLAUDE.md
  // "Cadastro de produtos") — sinalização automática, mesmo espírito da
  // sinalização de "clientes sumidos".
  const estoqueBaixo = produto.estoque_minimo > 0 && produto.quantidade_estoque <= produto.estoque_minimo

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-border bg-card",
        !produto.ativo && "opacity-60"
      )}
    >
      <div className={cn("w-1.5 shrink-0", estoqueBaixo ? "bg-amber-500" : "bg-primary")} />
      <div className="flex flex-1 items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          {produto.foto ? (
            <img
              src={produto.foto}
              alt={produto.nome}
              className="size-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Package className="size-5 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold">{produto.nome}</h3>
              {!produto.ativo && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Desativado
                </span>
              )}
            </div>
            {produto.descricao && (
              <p className="mt-0.5 text-sm text-muted-foreground">{produto.descricao}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-heading font-medium text-foreground">
                {formatarPreco(produto.preco)}
              </span>
              <span>·</span>
              <span className={cn(estoqueBaixo && "font-medium text-amber-600 dark:text-amber-400")}>
                {produto.quantidade_estoque} em estoque
              </span>
              {estoqueBaixo && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  Estoque baixo
                </span>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Ações do produto">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onVender} disabled={!produto.ativo}>
              <ShoppingCart className="size-4" /> Registrar venda
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleAtivo}>
              <Package className="size-4" /> {produto.ativo ? "Desativar" : "Ativar"}
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
