import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { apiAdmin, ApiError } from "@/lib/api"
import { diasParaVencimento } from "@/lib/formatacao"
import { cn } from "@/lib/utils"
import type { Estabelecimento } from "@/types"

// Banner recalculado a cada carregamento da tela (nada de estado "já
// mostrei") — aparece nos dias 3, 2, 1 e no dia do vencimento, com o texto
// mudando conforme o dia. A comparação é por data civil no fuso do Brasil,
// não por hora exata (ver diasParaVencimento) — então a mensagem só muda
// uma vez a cada 24h, na virada do dia, e continua mostrando (vencido) se
// passar do prazo sem pagar. Isento nunca vê isso (ver CLAUDE.md "Renovação
// mensal").
export function VencimentoBanner() {
  const { estabelecimento, atualizarEstabelecimento } = useAuth()
  const [renovando, setRenovando] = useState(false)

  if (!estabelecimento || estabelecimento.isento || !estabelecimento.proximo_vencimento) return null

  const dias = diasParaVencimento(estabelecimento.proximo_vencimento)
  if (dias > 3) return null

  const mensagem =
    dias < 0
      ? "Seu plano venceu — renove pra voltar a usar o sistema normalmente."
      : dias === 0
        ? "Seu plano vence hoje."
        : dias === 1
          ? "Seu plano vence amanhã."
          : `Seu plano vence em ${dias} dias.`

  async function handleRenovar() {
    setRenovando(true)
    try {
      const atualizado = await apiAdmin.post<Estabelecimento>("/estabelecimento/renovar", {})
      atualizarEstabelecimento(atualizado)
      if (atualizado.link_pagamento_url) {
        window.open(atualizado.link_pagamento_url, "_blank")
      } else {
        toast.error("Não foi possível gerar o link de pagamento agora.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar link de renovação")
    } finally {
      setRenovando(false)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium",
        dias < 0
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="size-4 shrink-0" />
        {mensagem}
      </span>
      <button
        type="button"
        onClick={handleRenovar}
        disabled={renovando}
        className="underline underline-offset-2 hover:no-underline disabled:opacity-60"
      >
        {renovando ? "Gerando link..." : "Renovar agora"}
      </button>
    </div>
  )
}
