import { useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { usePublicoEstabelecimento } from "@/hooks/usePublicoEstabelecimento"
import { useMeusAgendamentos } from "@/hooks/useMeusAgendamentos"
import { formatarDataExibicao, formatarPrecoServico } from "@/lib/formatacao"
import { CORES_SERVICO_CLASSES } from "@/lib/cores"
import { DynamicIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { Agendamento, StatusAgendamento } from "@/types"

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  pendente: "Pendente",
}

export function MeusAgendamentosPage() {
  const { slug = "" } = useParams()
  const { estabelecimento } = usePublicoEstabelecimento(slug)
  const { agendamentos, loading, erro, buscar, cancelar } = useMeusAgendamentos(slug)

  const [telefone, setTelefone] = useState("")
  const [buscou, setBuscou] = useState(false)
  const [paraCancelar, setParaCancelar] = useState<Agendamento | null>(null)
  const [cancelando, setCancelando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!telefone.trim()) return
    setBuscou(true)
    await buscar(telefone)
  }

  async function confirmarCancelamento() {
    if (!paraCancelar) return
    setCancelando(true)
    try {
      await cancelar(paraCancelar.id, telefone)
      toast.success("Agendamento cancelado.")
      setParaCancelar(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao cancelar agendamento")
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {estabelecimento?.nome ?? "Meus agendamentos"}
        </h1>
        <p className="text-sm text-muted-foreground">Consulte seus agendamentos pelo telefone.</p>
      </div>

      <Link
        to={`/${slug}`}
        className="-mb-2 flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar pro agendamento
      </Link>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="telefone-consulta">Telefone</Label>
          <Input
            id="telefone-consulta"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="O mesmo usado no agendamento"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {buscou && !loading && (
        <>
          {erro && <p className="text-center text-sm text-destructive">{erro}</p>}
          {!erro && agendamentos?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum agendamento encontrado com esse telefone.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {agendamentos?.map((ag) => {
              const cores = CORES_SERVICO_CLASSES[ag.servico.cor]
              return (
                <div
                  key={ag.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      cores.bgSoft
                    )}
                  >
                    <DynamicIcon name={ag.servico.icone} className={cn("size-5", cores.text)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-semibold">{ag.servico.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatarDataExibicao(ag.data)} às {ag.hora} ·{" "}
                      {formatarPrecoServico(ag.servico.preco, ag.servico.preco_a_partir)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-medium",
                        ag.status === "cancelado" ? "text-muted-foreground" : "text-primary"
                      )}
                    >
                      {STATUS_LABEL[ag.status]}
                    </p>
                  </div>
                  {ag.status === "confirmado" && (
                    <Button variant="outline" size="sm" onClick={() => setParaCancelar(ag)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <AlertDialog
        open={paraCancelar !== null}
        onOpenChange={(open) => !open && setParaCancelar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar "{paraCancelar?.servico.nome}" em{" "}
              {paraCancelar && formatarDataExibicao(paraCancelar.data)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarCancelamento}
              disabled={cancelando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelando ? "Cancelando..." : "Cancelar agendamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
