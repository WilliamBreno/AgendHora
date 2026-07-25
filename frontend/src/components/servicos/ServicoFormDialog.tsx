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
import { ColorPicker } from "@/components/servicos/ColorPicker"
import { IconPickerField } from "@/components/servicos/IconPickerField"
import { CORES_SERVICO, type CorServico, type Servico, type ServicoInput } from "@/types"

interface ServicoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servico?: Servico | null
  iconesDisponiveis: string[]
  onSubmit: (input: ServicoInput) => Promise<void>
}

const FORM_VAZIO: ServicoInput = {
  nome: "",
  preco: 0,
  duracao_min: 30,
  descricao: "",
  cor: CORES_SERVICO[0],
  icone: "",
}

export function ServicoFormDialog({
  open,
  onOpenChange,
  servico,
  iconesDisponiveis,
  onSubmit,
}: ServicoFormDialogProps) {
  const [form, setForm] = useState<ServicoInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(
      servico
        ? {
            nome: servico.nome,
            preco: servico.preco,
            duracao_min: servico.duracao_min,
            descricao: servico.descricao,
            cor: servico.cor,
            icone: servico.icone,
          }
        : FORM_VAZIO
    )
  }, [open, servico])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!form.nome.trim()) {
      setErro("Informe o nome do serviço.")
      return
    }
    if (form.preco <= 0) {
      setErro("O preço precisa ser maior que zero.")
      return
    }
    if (form.duracao_min <= 0) {
      setErro("A duração precisa ser maior que zero.")
      return
    }

    setSalvando(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch {
      setErro("Não foi possível salvar o serviço. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{servico ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do serviço oferecido pelo estabelecimento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Corte de cabelo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.preco}
                  onChange={(e) => setForm((f) => ({ ...f, preco: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="duracao">Duração (min)</Label>
                <Input
                  id="duracao"
                  type="number"
                  min={0}
                  step="5"
                  value={form.duracao_min}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duracao_min: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

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
              <Label>Cor</Label>
              <ColorPicker
                value={form.cor}
                onChange={(cor: CorServico) => setForm((f) => ({ ...f, cor }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Ícone</Label>
              <IconPickerField
                value={form.icone}
                onChange={(icone) => setForm((f) => ({ ...f, icone }))}
                iconesDisponiveis={iconesDisponiveis}
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
