import { Link } from "react-router-dom"
import { Copy, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/common/ThemeToggle"

// Dados reais de pagamento — chave Pix e contato informados pelo dono do
// projeto (ver CLAUDE.md "Cadastro e ativação de novos estabelecimentos").
// Cobrança manual/Pix por enquanto, sem checkout automático nesta v1.
const CHAVE_PIX = "fa950e1c-6246-4947-af0e-cd32d4671a33"
const CONTATO_EMAIL = "agendhora@gmail.com"
const VALOR = "R$ 19,90/mês"

function copiarChavePix() {
  navigator.clipboard.writeText(CHAVE_PIX)
  toast.success("Chave Pix copiada.")
}

export function PagamentoPendentePage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo.png" alt="AgendHora" className="size-12 rounded-xl" />
          <h1 className="font-heading text-xl font-semibold">Falta só o pagamento</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada. Assim que confirmarmos o pagamento, seu acesso é liberado.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Valor</p>
            <p className="font-heading text-lg font-semibold">{VALOR}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Chave Pix (aleatória)</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-xs">
                {CHAVE_PIX}
              </code>
              <Button type="button" variant="outline" size="icon-sm" onClick={copiarChavePix}>
                <Copy className="size-4" />
                <span className="sr-only">Copiar chave Pix</span>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Mail className="size-4" /> Depois de pagar
            </p>
            <p className="mt-1">
              Manda um e-mail pra{" "}
              <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary hover:underline">
                {CONTATO_EMAIL}
              </a>{" "}
              avisando que pagou, com o nome do seu estabelecimento. A gente libera o acesso assim
              que confirmar.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já foi liberado?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
