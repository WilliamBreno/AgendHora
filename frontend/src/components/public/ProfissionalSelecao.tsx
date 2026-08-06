import type { ProfissionalPublico } from "@/types"

interface ProfissionalSelecaoProps {
  profissionais: ProfissionalPublico[]
  onSelecionar: (profissional: ProfissionalPublico) => void
}

export function ProfissionalSelecao({ profissionais, onSelecionar }: ProfissionalSelecaoProps) {
  return (
    <div className="flex flex-col gap-2">
      {profissionais.map((profissional) => (
        <button
          key={profissional.id}
          type="button"
          onClick={() => onSelecionar(profissional)}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-semibold text-primary">
            {profissional.nome.charAt(0).toUpperCase()}
          </div>
          <p className="font-heading font-semibold">{profissional.nome}</p>
        </button>
      ))}
    </div>
  )
}
