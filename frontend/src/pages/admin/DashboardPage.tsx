import { useEffect, useRef } from "react"
import gsap from "gsap"
import { useDashboard } from "@/hooks/useDashboard"
import { MetricaCard } from "@/components/dashboard/MetricaCard"
import { GraficoFaturamento } from "@/components/dashboard/GraficoFaturamento"
import { RankingServicos } from "@/components/dashboard/RankingServicos"
import { SugestoesCards } from "@/components/dashboard/SugestoesCards"

export function DashboardPage() {
  const { dashboard, loading } = useDashboard()
  const containerRef = useRef<HTMLDivElement>(null)

  // stagger na entrada dos cards de sugestão e do gráfico ao carregar
  useEffect(() => {
    if (loading || !dashboard || !containerRef.current) return
    const blocos = containerRef.current.querySelectorAll("[data-stagger]")
    gsap.fromTo(
      blocos,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.08 }
    )
  }, [loading, dashboard])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu estabelecimento.</p>
      </div>

      {loading || !dashboard ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div ref={containerRef} className="flex flex-col gap-6">
          {dashboard.sugestoes.length > 0 && (
            <div data-stagger>
              <SugestoesCards sugestoes={dashboard.sugestoes} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div data-stagger>
              <MetricaCard titulo="Hoje" metricas={dashboard.hoje} />
            </div>
            <div data-stagger>
              <MetricaCard titulo="Essa semana" metricas={dashboard.semana} />
            </div>
            <div data-stagger>
              <MetricaCard titulo="Esse mês" metricas={dashboard.mes} />
            </div>
          </div>

          <div data-stagger>
            <GraficoFaturamento dados7={dashboard.grafico_7_dias} dados30={dashboard.grafico_30_dias} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-stagger>
            <RankingServicos
              titulo="Mais agendados esse mês"
              itens={dashboard.ranking_quantidade}
              metrica="quantidade"
            />
            <RankingServicos
              titulo="Maior faturamento esse mês"
              itens={dashboard.ranking_faturamento}
              metrica="faturamento"
            />
          </div>
        </div>
      )}
    </div>
  )
}
