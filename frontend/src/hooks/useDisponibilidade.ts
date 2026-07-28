import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"

export function useDisponibilidade(servicoId: number | null, data: string) {
  const [horarios, setHorarios] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!servicoId || !data) {
      setHorarios([])
      return
    }

    let cancelado = false
    setLoading(true)

    api
      .get<{ horarios: string[] }>(`/api/disponibilidade?servico_id=${servicoId}&data=${data}`)
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
  }, [servicoId, data])

  return { horarios, loading }
}
