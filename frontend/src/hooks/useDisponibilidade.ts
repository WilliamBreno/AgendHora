import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPublico, ApiError } from "@/lib/api"

// servicoIds pode ter mais de um item quando o cliente está agendando um
// combo (ver CLAUDE.md "Agendamento com mais de um serviço") — a query
// repete o parâmetro servico_id, o backend soma a duração de todos.
export function useDisponibilidade(
  slug: string,
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

    apiPublico(slug)
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
  }, [slug, chaveServicos, profissionalId, data])

  return { horarios, loading }
}
