import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WhatsAppIntegracaoCard() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
        <MessageCircle className="size-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-medium">WhatsApp</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Em breve
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o número do seu estabelecimento pra enviar automaticamente a confirmação e o
          aviso de cancelamento pro cliente direto pelo WhatsApp — sem precisar do e-mail dele.
          Você também recebe o aviso de cada novo agendamento por lá.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled>
          Conectar WhatsApp
        </Button>
      </div>
    </div>
  )
}
