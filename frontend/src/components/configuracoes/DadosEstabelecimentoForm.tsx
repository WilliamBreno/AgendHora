import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import type { Estabelecimento, EstabelecimentoDadosInput } from "@/types"

interface DadosEstabelecimentoFormProps {
  estabelecimento: Estabelecimento
  onAtualizar: (dados: EstabelecimentoDadosInput) => Promise<Estabelecimento>
}

export function DadosEstabelecimentoForm({
  estabelecimento,
  onAtualizar,
}: DadosEstabelecimentoFormProps) {
  const [form, setForm] = useState<EstabelecimentoDadosInput>({
    nome: estabelecimento.nome,
    telefone: estabelecimento.telefone,
    endereco: estabelecimento.endereco,
    email: estabelecimento.email,
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setForm({
      nome: estabelecimento.nome,
      telefone: estabelecimento.telefone,
      endereco: estabelecimento.endereco,
      email: estabelecimento.email,
    })
  }, [estabelecimento])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    try {
      await onAtualizar(form)
      toast.success("Dados atualizados.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar dados")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="nome-estabelecimento">Nome do estabelecimento</Label>
        <Input
          id="nome-estabelecimento"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="telefone-estabelecimento">Telefone</Label>
          <Input
            id="telefone-estabelecimento"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email-estabelecimento">E-mail para notificações</Label>
          <Input
            id="email-estabelecimento"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="voce@exemplo.com"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="endereco-estabelecimento">Endereço</Label>
        <Input
          id="endereco-estabelecimento"
          value={form.endereco}
          onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
          placeholder="Opcional"
        />
      </div>

      <div>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
