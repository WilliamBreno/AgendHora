import { useState } from "react"
import { Megaphone, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AvisoFaixaProps {
  texto: string
  corTexto?: string
  corFundo?: string
}

// Faixa de aviso/anúncio do dono — só informativa, nunca bloqueia o
// agendamento: fica acima do fluxo e o cliente pode fechá-la a qualquer
// momento (ver CLAUDE.md, "não atrapalhe o cliente agendar"). O ícone tem
// um pulso animado (ping) pra chamar atenção com algo se movendo, sem
// precisar animar o texto todo (o que atrapalharia a leitura).
export function AvisoFaixa({ texto, corTexto, corFundo }: AvisoFaixaProps) {
  const [fechado, setFechado] = useState(false)
  if (fechado || !texto) return null

  const corCustomizada = !!(corTexto || corFundo)
  const estilo = corCustomizada
    ? { color: corTexto || undefined, backgroundColor: corFundo || undefined }
    : undefined

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        corCustomizada
          ? "border-transparent"
          : "border-primary/30 bg-primary/5 text-foreground"
      )}
      style={estilo}
    >
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
        <Megaphone className="relative size-4" />
      </span>
      <p className="flex-1">{texto}</p>
      <button
        type="button"
        onClick={() => setFechado(true)}
        className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
      >
        <X className="size-4" />
        <span className="sr-only">Fechar aviso</span>
      </button>
    </div>
  )
}
