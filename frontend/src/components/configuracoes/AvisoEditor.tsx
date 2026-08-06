import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AvisoFaixa } from "@/components/public/AvisoFaixa"
import { ApiError } from "@/lib/api"

interface AvisoEditorProps {
  ativo: boolean
  texto: string
  corTexto: string
  corFundo: string
  onAtualizar: (ativo: boolean, texto: string, corTexto: string, corFundo: string) => Promise<unknown>
}

const COR_TEXTO_PADRAO = "#1c1917"
const COR_FUNDO_PADRAO = "#0c7c71"

export function AvisoEditor({ ativo, texto, corTexto, corFundo, onAtualizar }: AvisoEditorProps) {
  const [ativoForm, setAtivoForm] = useState(ativo)
  const [textoForm, setTextoForm] = useState(texto)
  const [corTextoForm, setCorTextoForm] = useState(corTexto)
  const [corFundoForm, setCorFundoForm] = useState(corFundo)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setAtivoForm(ativo)
    setTextoForm(texto)
    setCorTextoForm(corTexto)
    setCorFundoForm(corFundo)
  }, [ativo, texto, corTexto, corFundo])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    try {
      await onAtualizar(ativoForm, textoForm, corTextoForm, corFundoForm)
      toast.success("Aviso atualizado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar aviso")
    } finally {
      setSalvando(false)
    }
  }

  function restaurarCoresPadrao() {
    setCorTextoForm("")
    setCorFundoForm("")
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

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="color"
            value={corTextoForm || COR_TEXTO_PADRAO}
            onChange={(e) => setCorTextoForm(e.target.value)}
            className="size-8 cursor-pointer rounded border border-input p-0.5"
          />
          Cor do texto
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="color"
            value={corFundoForm || COR_FUNDO_PADRAO}
            onChange={(e) => setCorFundoForm(e.target.value)}
            className="size-8 cursor-pointer rounded border border-input p-0.5"
          />
          Cor de fundo
        </label>
        {(corTextoForm || corFundoForm) && (
          <Button type="button" variant="ghost" size="sm" onClick={restaurarCoresPadrao}>
            Restaurar padrão
          </Button>
        )}
      </div>

      {textoForm && (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Pré-visualização</p>
          <AvisoFaixa texto={textoForm} corTexto={corTextoForm} corFundo={corFundoForm} />
        </div>
      )}

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
