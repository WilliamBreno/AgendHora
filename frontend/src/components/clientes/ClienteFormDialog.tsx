import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
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
import { TelefoneInput } from "@/components/common/TelefoneInput"
import { DataNascimentoInput } from "@/components/common/DataNascimentoInput"
import { ApiError } from "@/lib/api"
import type { Cliente, ClienteInput } from "@/types"

interface ClienteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: Cliente | null // null = cadastro novo, preenchido = edição
  onSalvar: (input: ClienteInput) => Promise<unknown>
}

const FORM_VAZIO: ClienteInput = { nome: "", telefone: "", data_nascimento: null }

export function ClienteFormDialog({ open, onOpenChange, cliente, onSalvar }: ClienteFormDialogProps) {
  const [form, setForm] = useState<ClienteInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(
      cliente
        ? { nome: cliente.nome, telefone: cliente.telefone, data_nascimento: cliente.data_nascimento }
        : FORM_VAZIO
    )
  }, [open, cliente])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.nome.trim() || !form.telefone.trim()) {
      setErro("Informe nome e telefone.")
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await onSalvar(form)
      toast.success(cliente ? "Cliente atualizado." : "Cliente cadastrado.")
      onOpenChange(false)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o cliente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              Cadastro manual — o normal é o cliente nascer sozinho a partir de um agendamento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <TelefoneInput
                id="telefone"
                value={form.telefone}
                onChange={(valor) => setForm((f) => ({ ...f, telefone: valor }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Data de nascimento (opcional)</Label>
              <DataNascimentoInput
                value={form.data_nascimento}
                onChange={(valor) => setForm((f) => ({ ...f, data_nascimento: valor }))}
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
