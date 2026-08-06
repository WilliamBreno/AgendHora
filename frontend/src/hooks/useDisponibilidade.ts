import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPublico, ApiError } from "@/lib/api"

export function useDisponibilidade(
  slug: string,
  servicoId: number | null,
  profissionalId: number | null,
  data: string
) {
  const [horarios, setHorarios] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!servicoId || !profissionalId || !data) {
      setHorarios([])
      return
    }

    let cancelado = false
    setLoading(true)

    apiPublico(slug)
      .get<{ horarios: string[] }>(
        `/disponibilidade?servico_id=${servicoId}&profissional_id=${profissionalId}&data=${data}`
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
  }, [slug, servicoId, profissionalId, data])

  return { horarios, loading }
}
