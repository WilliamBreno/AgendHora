import { useState, type FormEvent } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api"
import type { AgendamentoInput, Servico } from "@/types"

interface NovoAgendamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicos: Servico[]
  onCriar: (input: AgendamentoInput) => Promise<unknown>
}

const FORM_VAZIO: AgendamentoInput = {
  cliente_nome: "",
  cliente_telefone: "",
  servico_id: 0,
  data: "",
  hora: "",
  observacoes: "",
}

export function NovoAgendamentoDialog({
  open,
  onOpenChange,
  servicos,
  onCriar,
}: NovoAgendamentoDialogProps) {
  const [form, setForm] = useState<AgendamentoInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // true quando a última tentativa esbarrou num horário já ocupado — em vez
  // de só bloquear, oferece a opção de encaixar mesmo assim ou escolher outro horário.
  const [conflito, setConflito] = useState(false)

  function resetar() {
    setForm(FORM_VAZIO)
    setErro(null)
    setConflito(false)
  }

  function atualizarCampo<K extends keyof AgendamentoInput>(campo: K, valor: AgendamentoInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // qualquer edição invalida a decisão de conflito anterior (pode ter sido
    // sobre outro horário/serviço)
    setConflito(false)
    setErro(null)
  }

  async function submeter(forcarEncaixe: boolean) {
    setErro(null)
    setSalvando(true)
    try {
      await onCriar({ ...form, encaixe: forcarEncaixe })
      toast.success(forcarEncaixe ? "Agendamento encaixado." : "Agendamento criado.")
      resetar()
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflito(true)
      } else {
        setErro(err instanceof ApiError ? err.message : "Não foi possível criar o agendamento.")
      }
    } finally {
      setSalvando(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setConflito(false)

    if (!form.cliente_nome.trim() || !form.cliente_telefone.trim()) {
      setErro("Informe o nome e o telefone do cliente.")
      return
    }
    if (!form.servico_id) {
      setErro("Selecione um serviço.")
      return
    }
    if (!form.data || !form.hora) {
      setErro("Informe a data e o horário.")
      return
    }

    setErro(null)
    submeter(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetar()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>
              Use para agendamentos feitos por telefone ou no balcão.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cliente_nome">Nome do cliente</Label>
                <Input
                  id="cliente_nome"
                  value={form.cliente_nome}
                  onChange={(e) => atualizarCampo("cliente_nome", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cliente_telefone">Telefone</Label>
                <Input
                  id="cliente_telefone"
                  value={form.cliente_telefone}
                  onChange={(e) => atualizarCampo("cliente_telefone", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Serviço</Label>
              <Select
                value={form.servico_id ? String(form.servico_id) : ""}
                onValueChange={(value) => atualizarCampo("servico_id", Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um serviço">
                    {(value: string | null) => {
                      const servico = servicos.find((s) => String(s.id) === value)
                      return servico ? `${servico.nome} · ${servico.duracao_min} min` : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nome} · {s.duracao_min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => atualizarCampo("data", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hora">Horário</Label>
                <Input
                  id="hora"
                  type="time"
                  value={form.hora}
                  onChange={(e) => atualizarCampo("hora", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            {conflito && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <p className="text-amber-900 dark:text-amber-200">
                  Esse horário já está ocupado por outro agendamento. Encaixar mesmo assim?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConflito(false)}
                  >
                    Escolher outro horário
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={salvando}
                    onClick={() => submeter(true)}
                  >
                    {salvando ? "Encaixando..." : "Encaixar mesmo assim"}
                  </Button>
                </div>
              </div>
            )}

            {erro && !conflito && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          {!conflito && (
            <DialogFooter>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
