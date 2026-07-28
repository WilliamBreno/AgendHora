import { useDisponibilidade } from "@/hooks/useDisponibilidade"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Servico } from "@/types"

interface HorarioSelecaoProps {
  servico: Servico
  data: string
  hora: string
  onDataChange: (data: string) => void
  onHoraChange: (hora: string) => void
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function HorarioSelecao({
  servico,
  data,
  hora,
  onDataChange,
  onHoraChange,
}: HorarioSelecaoProps) {
  const { horarios, loading } = useDisponibilidade(servico.id, data)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="data-agendamento">Data</Label>
        <Input
          id="data-agendamento"
          type="date"
          min={hojeISO()}
          value={data}
          onChange={(e) => {
            onDataChange(e.target.value)
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
