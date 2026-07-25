import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CalendarioMensal } from "@/components/agenda/CalendarioMensal"
import { AgendamentoDetailPanel } from "@/components/agenda/AgendamentoDetailPanel"
import { NovoAgendamentoDialog } from "@/components/agenda/NovoAgendamentoDialog"
import { useAgendamentos } from "@/hooks/useAgendamentos"
import { useServicos } from "@/hooks/useServicos"
import {
  dataDeHoje,
  descricaoHojePorExtenso,
  ehMesAtual,
  formatarMesAno,
  gerarGradeMensal,
} from "@/lib/calendario"
import { ApiError } from "@/lib/api"
import type { Agendamento } from "@/types"

export function AgendaPage() {
  const hoje = dataDeHoje()
  const [ano, setAno] = useState(hoje.ano)
  const [mes, setMes] = useState(hoje.mes)
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const semanas = useMemo(() => gerarGradeMensal(ano, mes), [ano, mes])
  const inicio = semanas[0][0].data
  const fim = semanas[5][6].data

  const { agendamentos, loading, cancelar, criar } = useAgendamentos(inicio, fim)
  const { servicos } = useServicos()

  const agendamentosPorDia = useMemo(() => {
    const mapa: Record<string, Agendamento[]> = {}
    for (const ag of agendamentos) {
      ;(mapa[ag.data] ??= []).push(ag)
    }
    for (const lista of Object.values(mapa)) {
      lista.sort((a, b) => a.hora.localeCompare(b.hora))
    }
    return mapa
  }, [agendamentos])

  function irParaMesAnterior() {
    if (mes === 0) {
      setAno((a) => a - 1)
      setMes(11)
    } else {
      setMes((m) => m - 1)
    }
  }

  function irParaProximoMes() {
    if (mes === 11) {
      setAno((a) => a + 1)
      setMes(0)
    } else {
      setMes((m) => m + 1)
    }
  }

  function irParaHoje() {
    setAno(hoje.ano)
    setMes(hoje.mes)
  }

  async function handleCancelar(id: number) {
    try {
      await cancelar(id)
      toast.success("Agendamento cancelado.")
      setAgendamentoSelecionado(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao cancelar agendamento")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{formatarMesAno(ano, mes)}</h1>
          {ehMesAtual(ano, mes) && (
            <p className="text-sm text-muted-foreground">{descricaoHojePorExtenso()}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={irParaMesAnterior}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={irParaProximoMes}>
            <ChevronRight className="size-4" />
          </Button>
          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="size-4" />
            Novo agendamento
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <CalendarioMensal
          semanas={semanas}
          agendamentosPorDia={agendamentosPorDia}
          onAgendamentoClick={setAgendamentoSelecionado}
        />
      )}

      <AgendamentoDetailPanel
        agendamento={agendamentoSelecionado}
        onOpenChange={(open) => !open && setAgendamentoSelecionado(null)}
        onCancelar={handleCancelar}
      />

      <NovoAgendamentoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        servicos={servicos}
        onCriar={criar}
      />
    </div>
  )
}
