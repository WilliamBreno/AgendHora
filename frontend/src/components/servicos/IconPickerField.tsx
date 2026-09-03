import { ChevronDown } from "lucide-react"
import { DynamicIcon } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface IconPickerFieldProps {
  value: string
  onChange: (icone: string) => void
  iconesDisponiveis: string[]
}

export function IconPickerField({ value, onChange, iconesDisponiveis }: IconPickerFieldProps) {
  if (iconesDisponiveis.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum ícone disponível. Adicione ícones em Configurações.
      </p>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              {value ? (
                <>
                  <DynamicIcon name={value} className="size-4" />
                  {value}
                </>
              ) : (
                <span className="text-muted-foreground">Escolher ícone</span>
              )}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-72" align="start">
        <div className="grid grid-cols-6 gap-1">
          {iconesDisponiveis.map((nome) => (
            <button
              key={nome}
              type="button"
              title={nome}
              onClick={() => onChange(nome)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md hover:bg-muted",
                value === nome && "bg-primary/10 text-primary"
              )}
            >
              <DynamicIcon name={nome} className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
