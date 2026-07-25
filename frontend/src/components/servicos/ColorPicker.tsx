import { Check } from "lucide-react"
import { CORES_SERVICO, type CorServico } from "@/types"
import { CORES_SERVICO_CLASSES, CORES_SERVICO_LABEL } from "@/lib/cores"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  value: CorServico
  onChange: (cor: CorServico) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CORES_SERVICO.map((cor) => {
        const cores = CORES_SERVICO_CLASSES[cor]
        const selecionada = cor === value
        return (
          <button
            key={cor}
            type="button"
            onClick={() => onChange(cor)}
            title={CORES_SERVICO_LABEL[cor]}
            className={cn(
              "flex size-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-shadow",
              cores.bg,
              selecionada ? "ring-foreground" : "ring-transparent"
            )}
          >
            {selecionada && <Check className="size-4 text-white" />}
            <span className="sr-only">{CORES_SERVICO_LABEL[cor]}</span>
          </button>
        )
      })}
    </div>
  )
}
