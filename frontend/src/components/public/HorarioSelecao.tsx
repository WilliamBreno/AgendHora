import { DatePickerPopover } from "@/components/public/DatePickerPopover"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface HorarioSelecaoProps {
  horarios: string[]
  loading: boolean
  data: string
  hora: string
  onDataChange: (data: string) => void
  onHoraChange: (hora: string) => void
}

// Puramente apresentacional — quem usa (página pública ou reagendamento no
// admin) é quem busca os horários (fontes diferentes: pública x
// autenticada) e passa horarios/loading prontos. Assim os dois fluxos
// reaproveitam o mesmo seletor de verdade, não uma cópia parecida.
export function HorarioSelecao({
  horarios,
  loading,
  data,
  hora,
  onDataChange,
  onHoraChange,
}: HorarioSelecaoProps) {
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
