import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HorarioFuncionamentoEditor } from "@/components/configuracoes/HorarioFuncionamentoEditor"
import { useMeuHorario } from "@/hooks/useMeuHorario"

interface MeuHorarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Só o profissional auxiliar usa esse diálogo — o dono já configura o
// próprio horário (com intervalo) direto em Configurações.
export function MeuHorarioDialog({ open, onOpenChange }: MeuHorarioDialogProps) {
  const { horarios, atualizar } = useMeuHorario()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meu horário de trabalho</DialogTitle>
          <DialogDescription>
            Define quando você atende e seu intervalo de descanso — só afeta a sua própria agenda.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto py-2">
          <HorarioFuncionamentoEditor horarios={horarios} onAtualizar={atualizar} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
