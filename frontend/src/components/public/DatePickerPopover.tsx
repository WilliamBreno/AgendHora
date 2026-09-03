import { useState } from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DIAS_SEMANA_PT, MESES_PT, dataDeHoje, gerarGradeMensal } from "@/lib/calendario"

interface DatePickerPopoverProps {
  value: string // "YYYY-MM-DD"
  onChange: (data: string) => void
}

// dd/mm/yyyy direto das partes do ISO (sem Date/locale) — formato mais
// compacto, ocupa menos espaço no botão em telas estreitas do que o "seg.,
// 09 de ago." por extenso de antes.
function formatarExibicao(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-")
  return `${dia}/${mes}/${ano}`
}

export function DatePickerPopover({ value, onChange }: DatePickerPopoverProps) {
  const hoje = dataDeHoje()
  const hojeISO = `${hoje.ano}-${String(hoje.mes + 1).padStart(2, "0")}-${String(hoje.dia).padStart(2, "0")}`

  const [aberto, setAberto] = useState(false)
  const [ano, setAno] = useState(hoje.ano)
  const [mes, setMes] = useState(hoje.mes)

  const semanas = gerarGradeMensal(ano, mes)

  function irParaMesAnterior() {
    if (mes === 0) {
      setAno((a) => a - 1)
      setMes(11)
    } else {
      setMes((m) => m - 1)
    }
  }

  function irParaProximoMes() {
    if (mes === 11) {
      setAno((a) => a + 1)
      setMes(0)
    } else {
      setMes((m) => m + 1)
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            <CalendarIcon className="size-4" />
            {value ? (
              formatarExibicao(value)
            ) : (
              <span className="text-muted-foreground">Escolher data</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-80" align="start">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-medium">
            {MESES_PT[mes]} de {ano}
          </span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon-sm" onClick={irParaMesAnterior}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={irParaProximoMes}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {DIAS_SEMANA_PT.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {semanas.flat().map((dia) => {
            const passado = dia.data < hojeISO
            const desabilitado = passado || !dia.noMesAtual
            const selecionado = dia.data === value

            return (
              <button
                key={dia.data}
                type="button"
                disabled={desabilitado}
                onClick={() => {
                  onChange(dia.data)
                  setAberto(false)
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-sm transition-colors",
                  desabilitado && "text-muted-foreground/30",
                  !desabilitado && "hover:bg-muted",
                  dia.hoje && !selecionado && "font-semibold text-primary",
                  selecionado && "bg-primary text-primary-foreground hover:bg-primary"
                )}
              >
                {dia.dia}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
