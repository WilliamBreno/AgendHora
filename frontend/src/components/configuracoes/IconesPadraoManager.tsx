import { useMemo, useState } from "react"
import { icons } from "lucide-react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { DynamicIcon } from "@/lib/icons"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ApiError } from "@/lib/api"

interface IconesPadraoManagerProps {
  icones: string[]
  onAtualizar: (icones: string[]) => Promise<string[]>
}

const TODOS_ICONES = Object.keys(icons)

export function IconesPadraoManager({ icones, onAtualizar }: IconesPadraoManagerProps) {
  const [busca, setBusca] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [popoverAberto, setPopoverAberto] = useState(false)

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return []
    return TODOS_ICONES.filter(
      (nome) => nome.toLowerCase().includes(termo) && !icones.includes(nome)
    ).slice(0, 48)
  }, [busca, icones])

  async function adicionar(nome: string) {
    setSalvando(true)
    try {
      await onAtualizar([...icones, nome])
      setBusca("")
      setPopoverAberto(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar ícone")
    } finally {
      setSalvando(false)
    }
  }

  async function remover(nome: string) {
    setSalvando(true)
    try {
      await onAtualizar(icones.filter((i) => i !== nome))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover ícone")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {icones.map((nome) => (
          <div
            key={nome}
            className="group relative flex size-12 items-center justify-center rounded-lg border border-border bg-card"
            title={nome}
          >
            <DynamicIcon name={nome} className="size-5" />
            <button
              type="button"
              onClick={() => remover(nome)}
              disabled={salvando}
              className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex size-12 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="size-5" />
              </button>
            }
          />
          <PopoverContent className="w-80" align="start">
            <Input
              autoFocus
              placeholder="Buscar ícone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca.trim() && (
              <div className="mt-2 grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
                {resultados.length === 0 ? (
                  <p className="col-span-6 py-4 text-center text-sm text-muted-foreground">
                    Nenhum ícone encontrado.
                  </p>
                ) : (
                  resultados.map((nome) => (
                    <button
                      key={nome}
                      type="button"
                      title={nome}
                      onClick={() => adicionar(nome)}
                      disabled={salvando}
                      className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
                    >
                      <DynamicIcon name={nome} className="size-4" />
                    </button>
                  ))
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {icones.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum ícone disponível ainda. Adicione ícones para usá-los no cadastro de serviços.
        </p>
      )}
    </div>
  )
}
