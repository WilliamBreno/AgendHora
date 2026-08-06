import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPublico, ApiError } from "@/lib/api"
import type { ProfissionalPublico } from "@/types"

export function usePublicoProfissionais(slug: string) {
  const [profissionais, setProfissionais] = useState<ProfissionalPublico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)

    apiPublico(slug)
      .get<ProfissionalPublico[]>("/profissionais")
      .then((dados) => {
        if (!cancelado) setProfissionais(dados)
      })
      .catch((err) => {
        if (!cancelado) {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar profissionais")
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug])

  return { profissionais, loading }
}
