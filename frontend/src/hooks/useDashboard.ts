import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"
import type { Dashboard } from "@/types"

// profissionalIds vazio = toda a equipe (sem filtro) — multi-seleção, ver
// CLAUDE.md "Multi-seleção de profissional".
export function useDashboard(profissionalIds: number[] = []) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const idsChave = profissionalIds.join(",")

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    const filtro = idsChave
      ? "?" + idsChave.split(",").map((id) => `profissional_id=${id}`).join("&")
      : ""
    apiAdmin
      .get<Dashboard>(`/dashboard${filtro}`)
      .then((dados) => {
        // defesa extra: nunca deixa um campo de lista chegar como null nos
        // componentes, mesmo que o backend um dia volte a mandar assim
        if (!cancelado) {
          setDashboard({
            ...dados,
            grafico_7_dias: dados.grafico_7_dias ?? [],
            grafico_30_dias: dados.grafico_30_dias ?? [],
            ranking_quantidade: dados.ranking_quantidade ?? [],
            ranking_faturamento: dados.ranking_faturamento ?? [],
            sugestoes: dados.sugestoes ?? [],
          })
        }
      })
      .catch((err) => {
        if (!cancelado) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar dashboard")
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [idsChave])

  return { dashboard, loading }
}
