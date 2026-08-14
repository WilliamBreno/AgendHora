import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Usuario } from "@/types"

interface FiltroProfissionalMultiSelectProps {
  profissionais: Usuario[]
  // vazio = toda a equipe (sem filtro) — mesma convenção do backend, que
  // não filtra nada quando nenhum profissional_id vem na query string.
  selecionados: number[]
  onChange: (selecionados: number[]) => void
}

// Filtro de profissional com multi-seleção (agenda e dashboard) — só faz
// sentido mostrar quando há mais de um profissional; a visibilidade em si
// (só pro dono) é decisão de quem usa este componente (ver CLAUDE.md
// "Multi-seleção de profissional": auxiliar nunca vê esse controle).
export function FiltroProfissionalMultiSelect({
  profissionais,
  selecionados,
  onChange,
}: FiltroProfissionalMultiSelectProps) {
  const todaEquipe = selecionados.length === 0

  function alternar(id: number) {
    onChange(
      selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]
    )
  }

  const label = todaEquipe
    ? "Toda a equipe"
    : selecionados.length === 1
      ? (profissionais.find((p) => p.id === selecionados[0])?.nome ?? "1 selecionado")
      : `${selecionados.length} selecionados`

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
            <ChevronDown className="size-4" />
          </Button>
        }
      />
      <PopoverContent className="w-56" align="end">
        <div className="flex flex-col gap-0.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <input
              type="checkbox"
              checked={todaEquipe}
              onChange={() => onChange([])}
              className="size-4 rounded border-input accent-primary"
            />
            Toda a equipe
          </label>
          <div className="my-1 border-t border-border" />
          {profissionais.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(p.id)}
                onChange={() => alternar(p.id)}
                className="size-4 rounded border-input accent-primary"
              />
              {p.nome}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
