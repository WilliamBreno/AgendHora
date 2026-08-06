import { useEffect, useRef } from "react"
import { CheckCircle2 } from "lucide-react"
import gsap from "gsap"
import { Button } from "@/components/ui/button"
import { formatarDataExibicao, formatarPrecoServico } from "@/lib/formatacao"
import type { Agendamento } from "@/types"

interface ConfirmacaoAgendamentoProps {
  agendamento: Agendamento
  onNovoAgendamento: () => void
}

export function ConfirmacaoAgendamento({
  agendamento,
  onNovoAgendamento,
}: ConfirmacaoAgendamentoProps) {
  const iconeRef = useRef<HTMLDivElement>(null)
  const anelRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // pequeno destaque animado no momento da confirmação — ícone "estoura" com
  // um leve overshoot e um anel se expande e desaparece atrás dele
  useEffect(() => {
    const tl = gsap.timeline()
    tl.fromTo(
      iconeRef.current,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.2)" }
    )
    tl.fromTo(
      anelRef.current,
      { scale: 0.6, opacity: 0.5 },
      { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" },
      "-=0.4"
    )
    tl.fromTo(
      cardRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35 },
      "-=0.2"
    )
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="relative flex items-center justify-center">
        <div ref={anelRef} className="absolute size-12 rounded-full bg-primary/30" />
        <div ref={iconeRef}>
          <CheckCircle2 className="size-12 text-primary" />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold">Agendamento confirmado!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {agendamento.cliente_email
            ? "Enviamos os detalhes para o seu e-mail."
            : "Guarde os detalhes abaixo."}
        </p>
      </div>

      <div
        ref={cardRef}
        className="w-full max-w-xs rounded-xl border border-border bg-card p-4 text-left text-sm"
      >
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Serviço</span>
          <span className="font-medium">{agendamento.servico.nome}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Data</span>
          <span className="font-medium">{formatarDataExibicao(agendamento.data)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Horário</span>
          <span className="font-medium">{agendamento.hora}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-medium">
            {formatarPrecoServico(agendamento.servico.preco, agendamento.servico.preco_a_partir)}
          </span>
        </div>
      </div>

      <Button variant="outline" onClick={onNovoAgendamento}>
        Fazer outro agendamento
      </Button>
    </div>
  )
}
