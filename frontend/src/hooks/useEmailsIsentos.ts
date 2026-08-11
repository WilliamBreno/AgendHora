import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { apiPlataforma, ApiError } from "@/lib/api"
import type { DuracaoIsencao, EmailIsento } from "@/types"

export function useEmailsIsentos() {
  const [emails, setEmails] = useState<EmailIsento[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await apiPlataforma.get<EmailIsento[]>("/emails-isentos")
      setEmails(dados)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar e-mails isentos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar(email: string, duracaoDias: DuracaoIsencao) {
    const criado = await apiPlataforma.post<EmailIsento>("/emails-isentos", {
      email,
      duracao_dias: duracaoDias,
    })
    setEmails((atual) => [criado, ...atual])
    return criado
  }

  async function remover(id: number) {
    await apiPlataforma.delete(`/emails-isentos/${id}`)
    setEmails((atual) => atual.filter((e) => e.id !== id))
  }

  return { emails, loading, adicionar, remover }
}
