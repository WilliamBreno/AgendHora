import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"

interface DiasReagendamentoEditorProps {
  dias: number | null
  onAtualizar: (dias: number | null) => Promise<unknown>
}

export function DiasReagendamentoEditor({ dias, onAtualizar }: DiasReagendamentoEditorProps) {
  const [ativo, setAtivo] = useState(dias !== null)
  const [valor, setValor] = useState(dias !== null ? String(dias) : "")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setAtivo(dias !== null)
    setValor(dias !== null ? String(dias) : "")
  }, [dias])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const novoValor = ativo ? Number(valor) : null
    if (ativo && (!Number.isFinite(novoValor) || novoValor === null || novoValor <= 0)) {
      toast.error("Informe um número de dias maior que zero.")
      return
    }
    setSalvando(true)
    try {
      await onAtualizar(novoValor)
      toast.success("Aviso de reagendamento atualizado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        Avisar clientes inativos por e-mail
      </label>

      {ativo && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Depois de</span>
          <Input
            type="number"
            min={1}
            step="1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">dias sem agendar</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Manda um e-mail automático pro cliente sugerindo um novo agendamento — quando o mesmo dia
        da semana e horário do último atendimento dele continuar livre, o e-mail já vem com esse
        horário pré-selecionado (o cliente só confirma); senão, cai num link normal de agendar.
        Só alcança quem tem e-mail cadastrado.
      </p>

      <div>
        <Button type="submit" disabled={salvando} className="mt-1">
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
