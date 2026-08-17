import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"

interface DescontoProfissionalEditorProps {
  percentual: number | null
  onAtualizar: (percentual: number | null) => Promise<unknown>
}

export function DescontoProfissionalEditor({
  percentual,
  onAtualizar,
}: DescontoProfissionalEditorProps) {
  const [ativo, setAtivo] = useState(percentual !== null)
  const [valor, setValor] = useState(percentual !== null ? String(percentual) : "")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setAtivo(percentual !== null)
    setValor(percentual !== null ? String(percentual) : "")
  }, [percentual])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const novoPercentual = ativo ? Number(valor) : null
    if (ativo && (Number.isNaN(novoPercentual) || novoPercentual! < 0 || novoPercentual! > 100)) {
      toast.error("O desconto precisa estar entre 0 e 100.")
      return
    }
    setSalvando(true)
    try {
      await onAtualizar(novoPercentual)
      toast.success("Desconto padrão atualizado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar desconto")
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
        Aplicar desconto automático nas compras internas da equipe
      </label>

      {ativo && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step="1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pré-preenche o desconto sempre que um profissional (dono ou auxiliar) comprar um produto
        internamente — continua editável em cada venda.
      </p>

      <div>
        <Button type="submit" disabled={salvando} className="mt-1">
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
