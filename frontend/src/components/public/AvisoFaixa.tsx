import { useState } from "react"
import { Megaphone, X } from "lucide-react"

interface AvisoFaixaProps {
  texto: string
}

// Faixa de aviso/anúncio do dono — só informativa, nunca bloqueia o
// agendamento: fica acima do fluxo e o cliente pode fechá-la a qualquer
// momento (ver CLAUDE.md, "não atrapalhe o cliente agendar").
export function AvisoFaixa({ texto }: AvisoFaixaProps) {
  const [fechado, setFechado] = useState(false)
  if (fechado || !texto) return null

  return (
    <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="flex-1 text-foreground">{texto}</p>
      <button
        type="button"
        onClick={() => setFechado(true)}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
        <span className="sr-only">Fechar aviso</span>
      </button>
    </div>
  )
}
