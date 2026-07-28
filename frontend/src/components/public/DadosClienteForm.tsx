import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface DadosCliente {
  cliente_nome: string
  cliente_telefone: string
  cliente_email: string
  observacoes: string
}

interface DadosClienteFormProps {
  enviando: boolean
  erro: string | null
  onSubmit: (dados: DadosCliente) => void
}

const FORM_VAZIO: DadosCliente = {
  cliente_nome: "",
  cliente_telefone: "",
  cliente_email: "",
  observacoes: "",
}

export function DadosClienteForm({ enviando, erro, onSubmit }: DadosClienteFormProps) {
  const [form, setForm] = useState<DadosCliente>(FORM_VAZIO)
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.cliente_nome.trim() || !form.cliente_telefone.trim()) {
      setErroLocal("Informe seu nome e telefone.")
      return
    }
    setErroLocal(null)
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="cliente_nome_publico">Nome</Label>
        <Input
          id="cliente_nome_publico"
          value={form.cliente_nome}
          onChange={(e) => setForm((f) => ({ ...f, cliente_nome: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cliente_telefone_publico">Telefone</Label>
        <Input
          id="cliente_telefone_publico"
          value={form.cliente_telefone}
          onChange={(e) => setForm((f) => ({ ...f, cliente_telefone: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cliente_email_publico">E-mail (opcional)</Label>
        <Input
          id="cliente_email_publico"
          type="email"
          value={form.cliente_email}
          onChange={(e) => setForm((f) => ({ ...f, cliente_email: e.target.value }))}
          placeholder="Para receber a confirmação por e-mail"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="observacoes_publico">Observações (opcional)</Label>
        <Textarea
          id="observacoes_publico"
          value={form.observacoes}
          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          rows={2}
        />
      </div>
      {(erroLocal || erro) && <p className="text-sm text-destructive">{erroLocal ?? erro}</p>}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Agendando..." : "Confirmar agendamento"}
      </Button>
    </form>
  )
}
