import { useEffect, useState } from "react"
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
import { HorarioSelecao } from "@/components/public/HorarioSelecao"
import { useDisponibilidadeAdmin } from "@/hooks/useDisponibilidadeAdmin"
import { ApiError } from "@/lib/api"
import type { Agendamento } from "@/types"

interface ReagendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agendamento: Agendamento | null
  onReagendar: (id: number, data: string, hora: string, encaixe?: boolean) => Promise<unknown>
}

// Reaproveita o mesmo seletor de data/horário da página pública
// (components/public/HorarioSelecao) — só troca de onde vêm os horários
// (aqui, via useDisponibilidadeAdmin, autenticado).
export function ReagendarDialog({
  open,
  onOpenChange,
  agendamento,
  onReagendar,
}: ReagendarDialogProps) {
  const [data, setData] = useState("")
  const [hora, setHora] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conflito, setConflito] = useState(false)

  const { horarios, loading } = useDisponibilidadeAdmin(
    agendamento?.servico_id ?? null,
    agendamento?.profissional_id ?? null,
    data
  )

  useEffect(() => {
    if (open) {
      setData("")
      setHora("")
      setErro(null)
      setConflito(false)
    }
  }, [open, agendamento?.id])

  async function submeter(forcarEncaixe: boolean) {
    if (!agendamento) return
    setErro(null)
    setSalvando(true)
    try {
      await onReagendar(agendamento.id, data, hora, forcarEncaixe)
      toast.success(forcarEncaixe ? "Agendamento reagendado com encaixe." : "Agendamento reagendado.")
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflito(true)
      } else {
        setErro(err instanceof ApiError ? err.message : "Não foi possível reagendar.")
      }
    } finally {
      setSalvando(false)
    }
  }

  if (!agendamento) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar</DialogTitle>
          <DialogDescription>
            {agendamento.cliente_nome} · {agendamento.servico.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <HorarioSelecao
            horarios={horarios}
            loading={loading}
            data={data}
            hora={hora}
            onDataChange={setData}
            onHoraChange={(novaHora) => {
              setHora(novaHora)
              setConflito(false)
              setErro(null)
            }}
          />

          {conflito && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="text-amber-900 dark:text-amber-200">
                Esse horário já está ocupado por outro agendamento. Encaixar mesmo assim?
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConflito(false)}>
                  Escolher outro horário
                </Button>
                <Button type="button" size="sm" disabled={salvando} onClick={() => submeter(true)}>
                  {salvando ? "Encaixando..." : "Encaixar mesmo assim"}
                </Button>
              </div>
            </div>
          )}

          {erro && !conflito && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        {!conflito && (
          <DialogFooter>
            <Button
              onClick={() => submeter(false)}
              disabled={!data || !hora || salvando}
            >
              {salvando ? "Reagendando..." : "Confirmar novo horário"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
