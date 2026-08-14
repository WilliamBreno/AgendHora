import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { diasParaVencimento, formatarDataCurta } from "@/lib/formatacao"
import { cn } from "@/lib/utils"
import type { Estabelecimento } from "@/types"

interface MeuPlanoCardProps {
  estabelecimento: Estabelecimento
  onRenovar: () => Promise<Estabelecimento>
  onVerificar: () => Promise<Estabelecimento>
}

// Sempre acessível em Configurações, não só perto do vencimento — mostra
// plano, status, vencimento e o botão de renovar disponível a qualquer
// momento (renovação adiantada é permitida, ver CLAUDE.md "Renovação
// mensal"). Isento não vê vencimento nenhum, só "acesso gratuito".
export function MeuPlanoCard({ estabelecimento, onRenovar, onVerificar }: MeuPlanoCardProps) {
  const [processando, setProcessando] = useState<"renovar" | "verificar" | null>(null)

  if (estabelecimento.isento) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Meu Plano</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acesso gratuito.</p>
      </section>
    )
  }

  const dias = estabelecimento.proximo_vencimento
    ? diasParaVencimento(estabelecimento.proximo_vencimento)
    : null

  async function handleRenovar() {
    setProcessando("renovar")
    try {
      const atualizado = await onRenovar()
      if (atualizado.link_pagamento_url) {
        toast.success("Link de pagamento gerado — aberto numa nova aba.")
      } else {
        toast.error("Não foi possível gerar o link de pagamento agora.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar link de renovação")
    } finally {
      setProcessando(null)
    }
  }

  async function handleVerificar() {
    setProcessando("verificar")
    try {
      const antes = estabelecimento.proximo_vencimento
      const atualizado = await onVerificar()
      if (atualizado.proximo_vencimento !== antes) {
        toast.success("Pagamento confirmado! Vencimento atualizado.")
      } else {
        toast.info("Ainda não identificamos o pagamento. Tente de novo em instantes.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao verificar pagamento")
    } finally {
      setProcessando(null)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading font-medium">Meu Plano</h2>
      <p className="mt-1 text-sm text-muted-foreground">Plano padrão · R$ 19,90/mês</p>

      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd className={cn("font-medium", estabelecimento.ativo ? "text-primary" : "text-destructive")}>
            {estabelecimento.ativo ? "Ativo" : "Inativo"}
          </dd>
        </div>
        {estabelecimento.proximo_vencimento && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Próximo vencimento</dt>
            <dd className="font-medium">
              {formatarDataCurta(estabelecimento.proximo_vencimento)}
              {dias !== null && dias <= 3 && (
                <span className={cn("ml-1.5 font-normal", dias < 0 ? "text-destructive" : "text-amber-600")}>
                  ({dias < 0 ? "venceu" : dias === 0 ? "vence hoje" : `em ${dias} dia${dias === 1 ? "" : "s"}`})
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleRenovar} disabled={processando !== null}>
          {processando === "renovar" ? "Gerando link..." : "Renovar agora"}
        </Button>
        {estabelecimento.link_pagamento_url && (
          <Button
            type="button"
            variant="outline"
            onClick={handleVerificar}
            disabled={processando !== null}
          >
            {processando === "verificar" ? "Verificando..." : "Já paguei, verificar"}
          </Button>
        )}
      </div>
    </section>
  )
}
