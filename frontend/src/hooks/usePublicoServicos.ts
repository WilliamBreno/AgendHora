import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPublico, ApiError } from "@/lib/api"
import type { Servico } from "@/types"

export function usePublicoServicos(slug: string) {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)

    apiPublico(slug)
      .get<Servico[]>("/servicos")
      .then((dados) => {
        if (!cancelado) setServicos(dados)
      })
      .catch((err) => {
        if (!cancelado) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar serviços")
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug])

  return { servicos, loading }
}
