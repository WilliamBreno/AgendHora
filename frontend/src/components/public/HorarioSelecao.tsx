import { useDisponibilidade } from "@/hooks/useDisponibilidade"
import { DatePickerPopover } from "@/components/public/DatePickerPopover"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Servico } from "@/types"

interface HorarioSelecaoProps {
  slug: string
  servico: Servico
  profissionalId: number
  data: string
  hora: string
  onDataChange: (data: string) => void
  onHoraChange: (hora: string) => void
}

export function HorarioSelecao({
  slug,
  servico,
  profissionalId,
  data,
  hora,
  onDataChange,
  onHoraChange,
}: HorarioSelecaoProps) {
  const { horarios, loading } = useDisponibilidade(slug, servico.id, profissionalId, data)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label>Data</Label>
        <DatePickerPopover
          value={data}
          onChange={(novaData) => {
            onDataChange(novaData)
            onHoraChange("")
          }}
        />
      </div>

      {data && (
        <div>
          <Label className="mb-2 block">Horário</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando horários...</p>
          ) : horarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum horário livre nesse dia. Escolha outra data.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onHoraChange(h)}
                  className={cn(
                    "rounded-lg border border-border py-2 text-sm font-medium transition-colors hover:border-primary",
                    hora === h && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
