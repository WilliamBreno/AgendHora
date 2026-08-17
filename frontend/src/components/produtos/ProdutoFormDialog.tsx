import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUploadField } from "@/components/common/ImageUploadField"
import type { Produto, ProdutoInput } from "@/types"

interface ProdutoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto?: Produto | null
  onSubmit: (input: ProdutoInput) => Promise<void>
}

const FORM_VAZIO: ProdutoInput = {
  nome: "",
  preco: 0,
  custo_unitario: null,
  quantidade_estoque: 0,
  estoque_minimo: 0,
  descricao: "",
  foto: "",
}

export function ProdutoFormDialog({ open, onOpenChange, produto, onSubmit }: ProdutoFormDialogProps) {
  const [form, setForm] = useState<ProdutoInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(
      produto
        ? {
            nome: produto.nome,
            preco: produto.preco,
            custo_unitario: produto.custo_unitario,
            quantidade_estoque: produto.quantidade_estoque,
            estoque_minimo: produto.estoque_minimo,
            ativo: produto.ativo,
            descricao: produto.descricao,
            foto: produto.foto,
          }
        : FORM_VAZIO
    )
  }, [open, produto])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!form.nome.trim()) {
      setErro("Informe o nome do produto.")
      return
    }
    if (form.preco <= 0) {
      setErro("O preço precisa ser maior que zero.")
      return
    }
    if (form.custo_unitario !== null && form.custo_unitario < 0) {
      setErro("O custo não pode ser negativo.")
      return
    }
    if (form.quantidade_estoque < 0 || form.estoque_minimo < 0) {
      setErro("O estoque não pode ser negativo.")
      return
    }

    setSalvando(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch {
      setErro("Não foi possível salvar o produto. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              Produtos podem ser vendidos pro cliente final ou comprados internamente pela equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Shampoo profissional 300ml"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="preco">Preço de venda (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.preco || ""}
                  onChange={(e) => setForm((f) => ({ ...f, preco: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="custo">Custo unitário (R$)</Label>
                <Input
                  id="custo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.custo_unitario ?? ""}
                  placeholder="Opcional"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      custo_unitario: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Informe o custo pra acompanhar o lucro dos produtos no dashboard — é opcional.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="estoque">Quantidade em estoque</Label>
                <Input
                  id="estoque"
                  type="number"
                  min={0}
                  step="1"
                  value={form.quantidade_estoque}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantidade_estoque: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="estoque_minimo">Alertar abaixo de</Label>
                <Input
                  id="estoque_minimo"
                  type="number"
                  min={0}
                  step="1"
                  value={form.estoque_minimo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estoque_minimo: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Deixe em 0 pra não receber alerta de estoque baixo desse produto.
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Foto (opcional)</Label>
              <ImageUploadField
                value={form.foto}
                onChange={(foto) => setForm((f) => ({ ...f, foto }))}
                trocarLabel="Trocar foto"
                enviarLabel="Enviar foto"
                ajuda="Mostrada nos cards de produto."
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
