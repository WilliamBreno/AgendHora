import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FiltroProfissionalMultiSelect } from "@/components/common/FiltroProfissionalMultiSelect"
import { CalendarioMensal } from "@/components/agenda/CalendarioMensal"
import { AgendaSemanal } from "@/components/agenda/AgendaSemanal"
import { AgendaDiaria } from "@/components/agenda/AgendaDiaria"
import { AgendamentoDetailPanel } from "@/components/agenda/AgendamentoDetailPanel"
import { NovoAgendamentoDialog } from "@/components/agenda/NovoAgendamentoDialog"
import { MeuHorarioDialog } from "@/components/agenda/MeuHorarioDialog"
import { ReagendarDialog } from "@/components/agenda/ReagendarDialog"
import { useAgendamentos } from "@/hooks/useAgendamentos"
import { useServicos } from "@/hooks/useServicos"
import { useEquipe } from "@/hooks/useEquipe"
import { useProdutos } from "@/hooks/useProdutos"
import { useVendasProdutos } from "@/hooks/useVendasProdutos"
import { useClientes } from "@/hooks/useClientes"
import { useAuth } from "@/contexts/AuthContext"
import {
  dataDeHoje,
  descricaoHojePorExtenso,
  ehMesAtual,
  formatarDataPorExtenso,
  formatarIntervaloSemana,
  formatarMesAno,
  gerarGradeMensal,
  gerarSemana,
  paraISODate,
  somarDias,
} from "@/lib/calendario"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import type { Agendamento } from "@/types"
import type { FinanceiroInput } from "@/components/agenda/AgendamentoFinanceiroSection"

type Visao = "mensal" | "semanal" | "diaria"

const VISOES: { valor: Visao; label: string }[] = [
  { valor: "mensal", label: "Mês" },
  { valor: "semanal", label: "Semana" },
  { valor: "diaria", label: "Dia" },
]

export function AgendaPage() {
  const { ehDono, estabelecimento, usuario } = useAuth()
  const segmento = estabelecimento?.segmento ?? "geral"
  const hoje = dataDeHoje()
  const hojeISO = paraISODate(hoje.ano, hoje.mes, hoje.dia)

  const [visao, setVisao] = useState<Visao>("mensal")
  const [ano, setAno] = useState(hoje.ano)
  const [mes, setMes] = useState(hoje.mes)
  // âncora usada só pelas visões semanal/diária — independente de ano/mes,
  // que continuam exclusivos da visão mensal (não mexe nela).
  const [dataReferencia, setDataReferencia] = useState(hojeISO)

  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [meuHorarioAberto, setMeuHorarioAberto] = useState(false)
  const [reagendarAberto, setReagendarAberto] = useState(false)
  // vazio = toda a equipe (sem filtro) — multi-seleção, ver CLAUDE.md
  // "Multi-seleção de profissional".
  const [profissionalFiltro, setProfissionalFiltro] = useState<number[]>([])

  const semanas = useMemo(() => gerarGradeMensal(ano, mes), [ano, mes])
  const diasSemana = useMemo(() => gerarSemana(dataReferencia), [dataReferencia])

  const { inicio, fim } = useMemo(() => {
    if (visao === "mensal") return { inicio: semanas[0][0].data, fim: semanas[5][6].data }
    if (visao === "semanal") return { inicio: diasSemana[0].data, fim: diasSemana[6].data }
    return { inicio: dataReferencia, fim: dataReferencia }
  }, [visao, semanas, diasSemana, dataReferencia])

  const { equipe } = useEquipe(ehDono)
  const {
    agendamentos,
    loading,
    cancelar,
    criar,
    atualizarPago,
    reagendar,
    atualizarFinanceiro,
    concluir,
  } = useAgendamentos(inicio, fim, profissionalFiltro)
  const { servicos } = useServicos()
  const { produtos } = useProdutos()
  const { registrar: registrarVendaProduto } = useVendasProdutos()
  const { clientes } = useClientes()
  const profissionais = equipe?.profissionais ?? []

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

  const agendamentosDoDia = agendamentosPorDia[dataReferencia] ?? []

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

  function irParaAnterior() {
    if (visao === "mensal") irParaMesAnterior()
    else if (visao === "semanal") setDataReferencia((d) => somarDias(d, -7))
    else setDataReferencia((d) => somarDias(d, -1))
  }

  function irParaProximo() {
    if (visao === "mensal") irParaProximoMes()
    else if (visao === "semanal") setDataReferencia((d) => somarDias(d, 7))
    else setDataReferencia((d) => somarDias(d, 1))
  }

  function irParaHoje() {
    setAno(hoje.ano)
    setMes(hoje.mes)
    setDataReferencia(hojeISO)
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

  async function handleAtualizarPago(id: number, pago: boolean) {
    try {
      const atualizado = await atualizarPago(id, pago)
      setAgendamentoSelecionado(atualizado)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar pagamento")
    }
  }

  // erro tratado dentro do próprio AgendamentoFinanceiroSection (mostra o
  // toast e mantém o painel aberto pra tentar de novo) — aqui só propaga e
  // sincroniza o painel de detalhe com a resposta.
  async function handleAtualizarFinanceiro(id: number, dados: FinanceiroInput) {
    const atualizado = await atualizarFinanceiro(id, dados)
    setAgendamentoSelecionado(atualizado)
    return atualizado
  }

  // erros (incl. 409 de conflito) são tratados dentro do próprio
  // ReagendarDialog — aqui só propaga e atualiza o painel de detalhe com o
  // novo horário quando dá certo.
  async function handleReagendar(id: number, data: string, hora: string, encaixe?: boolean) {
    const atualizado = await reagendar(id, data, hora, encaixe)
    setAgendamentoSelecionado(atualizado)
    return atualizado
  }

  async function handleConcluir(id: number) {
    try {
      const atualizado = await concluir(id)
      setAgendamentoSelecionado(atualizado)
      toast.success("Agendamento concluído.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao concluir agendamento")
    }
  }

  const titulo =
    visao === "mensal"
      ? formatarMesAno(ano, mes)
      : visao === "semanal"
        ? formatarIntervaloSemana(diasSemana)
        : formatarDataPorExtenso(dataReferencia)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{titulo}</h1>
          {visao === "mensal" && ehMesAtual(ano, mes) && (
            <p className="text-sm text-muted-foreground">{descricaoHojePorExtenso()}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {VISOES.map((v) => (
              <button
                key={v.valor}
                type="button"
                onClick={() => setVisao(v.valor)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  visao === v.valor
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {ehDono && profissionais.length > 1 && (
            <FiltroProfissionalMultiSelect
              profissionais={profissionais}
              selecionados={profissionalFiltro}
              onChange={setProfissionalFiltro}
            />
          )}
          {!ehDono && (
            <Button variant="outline" size="sm" onClick={() => setMeuHorarioAberto(true)}>
              <Clock className="size-4" />
              Meu horário
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={irParaAnterior}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Período anterior</span>
          </Button>
          <Button variant="outline" size="icon-sm" onClick={irParaProximo}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Próximo período</span>
          </Button>
          <Button onClick={() => setNovoAberto(true)} className="ml-auto sm:ml-0">
            <Plus className="size-4" />
            Novo agendamento
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : visao === "mensal" ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <CalendarioMensal
            semanas={semanas}
            agendamentosPorDia={agendamentosPorDia}
            onAgendamentoClick={setAgendamentoSelecionado}
          />
        </div>
      ) : visao === "semanal" ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <AgendaSemanal
            dias={diasSemana}
            agendamentosPorDia={agendamentosPorDia}
            onAgendamentoClick={setAgendamentoSelecionado}
          />
        </div>
      ) : (
        <AgendaDiaria agendamentos={agendamentosDoDia} onAgendamentoClick={setAgendamentoSelecionado} />
      )}

      <AgendamentoDetailPanel
        agendamento={agendamentoSelecionado}
        segmento={segmento}
        onOpenChange={(open) => !open && setAgendamentoSelecionado(null)}
        onCancelar={handleCancelar}
        onAtualizarPago={handleAtualizarPago}
        onAtualizarFinanceiro={handleAtualizarFinanceiro}
        onConcluir={handleConcluir}
        onReagendarClick={() => setReagendarAberto(true)}
        produtos={produtos}
        profissionais={profissionais}
        usuarioAtualId={usuario?.id ?? 0}
        descontoPadrao={estabelecimento?.desconto_profissional_percentual ?? null}
        onRegistrarVendaProduto={async (input) => {
          await registrarVendaProduto(input)
        }}
      />

      <ReagendarDialog
        open={reagendarAberto}
        onOpenChange={setReagendarAberto}
        agendamento={agendamentoSelecionado}
        onReagendar={handleReagendar}
      />

      <NovoAgendamentoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        servicos={servicos}
        profissionais={profissionais}
        clientes={clientes}
        segmento={segmento}
        onCriar={criar}
      />

      {!ehDono && (
        <MeuHorarioDialog open={meuHorarioAberto} onOpenChange={setMeuHorarioAberto} />
      )}
    </div>
  )
}
