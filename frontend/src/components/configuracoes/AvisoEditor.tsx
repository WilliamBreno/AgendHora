import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api"

interface AvisoEditorProps {
  ativo: boolean
  texto: string
  onAtualizar: (ativo: boolean, texto: string) => Promise<unknown>
}

export function AvisoEditor({ ativo, texto, onAtualizar }: AvisoEditorProps) {
  const [ativoForm, setAtivoForm] = useState(ativo)
  const [textoForm, setTextoForm] = useState(texto)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setAtivoForm(ativo)
    setTextoForm(texto)
  }, [ativo, texto])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    try {
      await onAtualizar(ativoForm, textoForm)
      toast.success("Aviso atualizado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar aviso")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={ativoForm}
          onChange={(e) => setAtivoForm(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        Mostrar aviso na página de agendamento
      </label>
      <Textarea
        value={textoForm}
        onChange={(e) => setTextoForm(e.target.value)}
        placeholder='Ex: "Promoção de aniversário: 20% de desconto em todos os serviços até domingo!"'
        rows={2}
      />
      <p className="text-xs text-muted-foreground">
        Aparece como uma faixa no topo da página do cliente — ele pode fechá-la, e ela nunca
        bloqueia o agendamento.
      </p>
      <div>
        <Button type="submit" disabled={salvando} className="mt-1">
          {salvando ? "Salvando..." : "Salvar aviso"}
        </Button>
      </div>
    </form>
  )
}
