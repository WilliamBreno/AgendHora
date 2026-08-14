import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { CheckCircle2, ExternalLink, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { apiPagamento, ApiError } from "@/lib/api"
import type { PagamentoStatus } from "@/types"

const CONTATO_EMAIL = "agendhora@gmail.com"
const VALOR = "R$ 19,90/mês"

// Enquanto o dono não confirma o pagamento e volta pro checkout, essa tela
// vai repetindo a checagem sozinha — o webhook da InfinitePay pode chegar a
// qualquer momento, sem nenhuma ação do usuário (ver
// handlers.PagamentoHandler.Webhook no backend).
const INTERVALO_POLL_MS = 8000

export function PagamentoPendentePage() {
  const { slug = "" } = useParams()
  // A InfinitePay manda o cliente de volta pra cá com transaction_nsu e slug
  // (o slug DELA, da fatura — nada a ver com o :slug da rota, que é do
  // estabelecimento) na URL (ver CLAUDE.md "Redirect opcional pra melhorar
  // a UX"). Com isso o payment_check fica bem mais confiável do que só
  // handle+order_nsu, então usa pra confirmar na hora que a pessoa volta do
  // checkout, sem esperar o próximo poll.
  const [searchParams] = useSearchParams()
  const transactionNsu = searchParams.get("transaction_nsu") ?? undefined
  const invoiceSlug = searchParams.get("slug") ?? undefined

  const [status, setStatus] = useState<PagamentoStatus | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [verificando, setVerificando] = useState(false)

  const buscarStatus = useCallback(async () => {
    try {
      const dados = await apiPagamento(slug).get<PagamentoStatus>()
      setStatus(dados)
      return dados
    } catch {
      return null
    }
  }, [slug])

  const verificar = useCallback(
    async (params?: { transaction_nsu?: string; invoice_slug?: string }) => {
      const dados = await apiPagamento(slug).post<PagamentoStatus>("/verificar", params)
      setStatus(dados)
      return dados
    },
    [slug]
  )

  useEffect(() => {
    async function inicializar() {
      const dados = await buscarStatus()
      // veio direto do checkout com o comprovante da transação — tenta
      // confirmar na hora, em silêncio (sem toast se ainda não confirmou:
      // o webhook pode simplesmente chegar primeiro).
      if (dados && !dados.ativo && !dados.isento && transactionNsu) {
        await verificar({ transaction_nsu: transactionNsu, invoice_slug: invoiceSlug }).catch(() => null)
      }
      setCarregando(false)
    }
    inicializar()
    // só roda uma vez, no mount — os params do redirect não mudam depois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pago = status?.ativo || status?.isento

  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (pago) return
    intervaloRef.current = setInterval(buscarStatus, INTERVALO_POLL_MS)
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [pago, buscarStatus])

  async function handleVerificar() {
    setVerificando(true)
    try {
      const dados = await verificar()
      if (!dados.ativo) {
        toast.info("Ainda não identificamos o pagamento. Se você já pagou, aguarde alguns instantes e tente de novo.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao verificar pagamento")
    } finally {
      setVerificando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        {pago ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <div>
              <h1 className="font-heading text-xl font-semibold">Pagamento confirmado!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sua conta já está ativa. Pode entrar e começar a usar.
              </p>
            </div>
            <Button render={<Link to="/login" />} className="w-full">
              Entrar
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <img src="/logo.png" alt="AgendHora" className="size-12 rounded-xl" />
              <h1 className="font-heading text-xl font-semibold">Falta só o pagamento</h1>
              <p className="text-sm text-muted-foreground">
                Sua conta foi criada. Assim que o pagamento for confirmado, seu acesso é liberado
                automaticamente — não precisa fazer mais nada além de pagar.
              </p>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Valor</p>
                <p className="font-heading text-lg font-semibold">{VALOR}</p>
              </div>

              {status?.link_pagamento_url ? (
                <Button render={<a href={status.link_pagamento_url} target="_blank" rel="noreferrer" />}>
                  Pagar agora <ExternalLink className="size-4" />
                </Button>
              ) : (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Mail className="size-4" /> Link de pagamento indisponível
                  </p>
                  <p className="mt-1">
                    Não conseguimos gerar seu link agora. Manda um e-mail pra{" "}
                    <a href={`mailto:${CONTATO_EMAIL}`} className="text-primary hover:underline">
                      {CONTATO_EMAIL}
                    </a>{" "}
                    que a gente resolve.
                  </p>
                </div>
              )}

              <Button variant="outline" onClick={handleVerificar} disabled={verificando}>
                <RefreshCw className={verificando ? "size-4 animate-spin" : "size-4"} />
                {verificando ? "Verificando..." : "Já paguei, verificar"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Essa página se atualiza sozinha assim que o pagamento é confirmado.
              </p>
            </div>
          </>
        )}

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
