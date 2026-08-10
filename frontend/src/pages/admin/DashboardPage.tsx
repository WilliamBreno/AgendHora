import { useEffect, useRef, useState } from "react"
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react"
import gsap from "gsap"
import { toast } from "sonner"
import { useDashboard } from "@/hooks/useDashboard"
import { MetricaCard } from "@/components/dashboard/MetricaCard"
import { GraficoFaturamento } from "@/components/dashboard/GraficoFaturamento"
import { RankingServicos } from "@/components/dashboard/RankingServicos"
import { SugestoesCards } from "@/components/dashboard/SugestoesCards"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { baixarArquivoAdmin, ApiError } from "@/lib/api"

type Periodo = "hoje" | "semana" | "mes"
type FormatoExportacao = "csv" | "xlsx" | "pdf"

const PERIODO_LABEL: Record<Periodo, string> = {
  hoje: "Hoje",
  semana: "Essa semana",
  mes: "Esse mês",
}

const FORMATO_CONFIG: Record<FormatoExportacao, { label: string; icone: typeof Download }> = {
  csv: { label: "CSV", icone: Download },
  xlsx: { label: "Planilha (XLSX)", icone: FileSpreadsheet },
  pdf: { label: "PDF", icone: FileText },
}

export function DashboardPage() {
  const { dashboard, loading } = useDashboard()
  const containerRef = useRef<HTMLDivElement>(null)
  const [periodoExportar, setPeriodoExportar] = useState<Periodo>("mes")
  const [exportando, setExportando] = useState(false)

  async function handleExportar(formato: FormatoExportacao) {
    setExportando(true)
    try {
      await baixarArquivoAdmin(
        `/dashboard/${formato}?periodo=${periodoExportar}`,
        `agendamentos-${periodoExportar}.${formato}`
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao exportar relatório")
    } finally {
      setExportando(false)
    }
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu estabelecimento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodoExportar} onValueChange={(v) => setPeriodoExportar(v as Periodo)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Esse mês">
                {(value: string | null) => PERIODO_LABEL[(value as Periodo) ?? "mes"]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIODO_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" disabled={exportando}>
                  <Download className="size-4" />
                  {exportando ? "Exportando..." : "Exportar"}
                  <ChevronDown className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {(Object.keys(FORMATO_CONFIG) as FormatoExportacao[]).map((formato) => {
                const { label, icone: Icone } = FORMATO_CONFIG[formato]
                return (
                  <DropdownMenuItem key={formato} onClick={() => handleExportar(formato)}>
                    <Icone className="size-4" /> {label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
