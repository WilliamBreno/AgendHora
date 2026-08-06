import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import type { DiaSemana, HorarioDia, HorarioFuncionamento } from "@/types"

const DIAS_ORDEM_EXIBICAO: DiaSemana[] = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
]

const DIA_LABEL: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
}

const DIA_PADRAO: HorarioDia = { abre: "09:00", fecha: "18:00", fechado: true }

type FormHorario = Record<DiaSemana, HorarioDia>

function normalizar(horarios: HorarioFuncionamento): FormHorario {
  const resultado = {} as FormHorario
  for (const dia of DIAS_ORDEM_EXIBICAO) {
    resultado[dia] = horarios[dia] ?? DIA_PADRAO
  }
  return resultado
}

interface HorarioFuncionamentoEditorProps {
  horarios: HorarioFuncionamento
  onAtualizar: (horarios: HorarioFuncionamento) => Promise<HorarioFuncionamento>
}

export function HorarioFuncionamentoEditor({
  horarios,
  onAtualizar,
}: HorarioFuncionamentoEditorProps) {
  const [form, setForm] = useState<FormHorario>(() => normalizar(horarios))
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setForm(normalizar(horarios))
  }, [horarios])

  function atualizarDia(dia: DiaSemana, campo: keyof HorarioDia, valor: string | boolean) {
    setForm((atual) => ({ ...atual, [dia]: { ...atual[dia], [campo]: valor } }))
  }

  function alternarIntervalo(dia: DiaSemana, temIntervalo: boolean) {
    setForm((atual) => ({
      ...atual,
      [dia]: {
        ...atual[dia],
        intervalo_inicio: temIntervalo ? "12:00" : "",
        intervalo_fim: temIntervalo ? "13:00" : "",
      },
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    try {
      await onAtualizar(form)
      toast.success("Horário de funcionamento atualizado.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar horário")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {DIAS_ORDEM_EXIBICAO.map((dia) => {
        const horario = form[dia]
        const temIntervalo = !!(horario.intervalo_inicio && horario.intervalo_fim)
        return (
          <div key={dia} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-medium">{DIA_LABEL[dia]}</span>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={horario.fechado}
                  onChange={(e) => atualizarDia(dia, "fechado", e.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                Fechado
              </label>
              <Input
                type="time"
                value={horario.abre}
                disabled={horario.fechado}
                onChange={(e) => atualizarDia(dia, "abre", e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="time"
                value={horario.fecha}
                disabled={horario.fechado}
                onChange={(e) => atualizarDia(dia, "fecha", e.target.value)}
                className="w-28"
              />
            </div>
            {!horario.fechado && (
              <div className="flex flex-wrap items-center gap-3 pl-[76px]">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={temIntervalo}
                    onChange={(e) => alternarIntervalo(dia, e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  Intervalo de descanso
                </label>
                {temIntervalo && (
                  <>
                    <Input
                      type="time"
                      value={horario.intervalo_inicio}
                      onChange={(e) => atualizarDia(dia, "intervalo_inicio", e.target.value)}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={horario.intervalo_fim}
                      onChange={(e) => atualizarDia(dia, "intervalo_fim", e.target.value)}
                      className="w-28"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
      <div>
        <Button type="submit" disabled={salvando} className="mt-2">
          {salvando ? "Salvando..." : "Salvar horário"}
        </Button>
      </div>
    </form>
  )
}
