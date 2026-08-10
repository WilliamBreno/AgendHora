import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPublico, ApiError } from "@/lib/api"
import type { EstabelecimentoPublico } from "@/types"

export function usePublicoEstabelecimento(slug: string) {
  const [estabelecimento, setEstabelecimento] = useState<EstabelecimentoPublico | null>(null)
  const [loading, setLoading] = useState(true)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setNaoEncontrado(false)
    setIndisponivel(false)

    apiPublico(slug)
      .get<EstabelecimentoPublico>("/estabelecimento")
      .then((dados) => {
        if (!cancelado) setEstabelecimento(dados)
      })
      .catch((err) => {
        if (cancelado) return
        if (err instanceof ApiError && err.status === 404) {
          setNaoEncontrado(true)
        } else if (err instanceof ApiError && err.status === 402) {
          // estabelecimento existe, mas está com acesso pausado por
          // inadimplência (ver auth.ExigirEstabelecimentoAtivo/SlugMiddleware
          // no backend) — mensagem amigável, não um erro técnico.
          setIndisponivel(true)
        } else {
          toast.error(err instanceof ApiError ? err.message : "Erro ao carregar estabelecimento")
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug])

  return { estabelecimento, loading, naoEncontrado, indisponivel }
}
