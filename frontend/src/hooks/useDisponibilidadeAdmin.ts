import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiAdmin, ApiError } from "@/lib/api"

// Mesma ideia de useDisponibilidade, mas pra área admin (usa apiAdmin,
// autenticado) — usado no reagendamento, que reaproveita o motor de
// disponibilidade já existente. servicoIds pode ter mais de um item quando
// o agendamento original tem mais de um serviço (ver CLAUDE.md "Agendamento
// com mais de um serviço").
export function useDisponibilidadeAdmin(
  servicoIds: number[],
  profissionalId: number | null,
  data: string
) {
  const [horarios, setHorarios] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const chaveServicos = servicoIds.join(",")

  useEffect(() => {
    if (servicoIds.length === 0 || !profissionalId || !data) {
      setHorarios([])
      return
    }

    let cancelado = false
    setLoading(true)

    const query = servicoIds.map((id) => `servico_id=${id}`).join("&")

    apiAdmin
      .get<{ horarios: string[] }>(
        `/disponibilidade?${query}&profissional_id=${profissionalId}&data=${data}`
      )
      .then((res) => {
        if (!cancelado) setHorarios(res.horarios)
      })
      .catch((err) => {
        if (!cancelado) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar horários")
          setHorarios([])
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveServicos, profissionalId, data])

  return { horarios, loading }
}
