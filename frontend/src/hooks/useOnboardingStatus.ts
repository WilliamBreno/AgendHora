import { useEffect, useState } from "react"
import { apiAdmin } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { Servico } from "@/types"

function temHorarioAberto(estabelecimento: ReturnType<typeof useAuth>["estabelecimento"]) {
  if (!estabelecimento) return false
  return Object.values(estabelecimento.horario_funcionamento).some(
    (dia) => dia && !dia.fechado && dia.abre && dia.fecha
  )
}

// Estado dos "primeiros passos": serviços e horário são obrigatórios pra
// considerar o cadastro pronto (é o mínimo pra página pública funcionar);
// logo continua opcional e nunca bloqueia a conclusão.
export function useOnboardingStatus() {
  const { estabelecimento, carregando: carregandoAuth } = useAuth()
  const [totalServicos, setTotalServicos] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    apiAdmin
      .get<Servico[]>("/servicos")
      .then((lista) => {
        if (!cancelado) setTotalServicos(lista.length)
      })
      .catch(() => {
        if (!cancelado) setTotalServicos(0)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const carregando = carregandoAuth || totalServicos === null

  const temServicos = (totalServicos ?? 0) > 0
  const temHorario = temHorarioAberto(estabelecimento)
  const temLogo = !!estabelecimento?.logo

  return {
    carregando,
    temServicos,
    temHorario,
    temLogo,
    obrigatoriosCompletos: temServicos && temHorario,
  }
}
