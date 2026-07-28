import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServicoSelecao } from "@/components/public/ServicoSelecao"
import { HorarioSelecao } from "@/components/public/HorarioSelecao"
import { DadosClienteForm, type DadosCliente } from "@/components/public/DadosClienteForm"
import { ConfirmacaoAgendamento } from "@/components/public/ConfirmacaoAgendamento"
import { useServicos } from "@/hooks/useServicos"
import { useEstabelecimento } from "@/hooks/useEstabelecimento"
import { api, ApiError } from "@/lib/api"
import type { Agendamento, Servico } from "@/types"

type Etapa = "servico" | "horario" | "dados" | "confirmacao"

const ETAPAS_COM_VOLTAR: Etapa[] = ["horario", "dados"]

export function AgendarPage() {
  const { servicos, loading: carregandoServicos } = useServicos()
  const { estabelecimento } = useEstabelecimento()

  const [etapa, setEtapa] = useState<Etapa>("servico")
  const [servico, setServico] = useState<Servico | null>(null)
  const [data, setData] = useState("")
  const [hora, setHora] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null)

  function reiniciar() {
    setEtapa("servico")
    setServico(null)
    setData("")
    setHora("")
    setErro(null)
    setAgendamento(null)
  }

  function voltar() {
    if (etapa === "horario") setEtapa("servico")
    else if (etapa === "dados") setEtapa("horario")
  }

  async function handleConfirmar(dadosCliente: DadosCliente) {
    if (!servico || !data || !hora) return
    setEnviando(true)
    setErro(null)
    try {
      const criado = await api.post<Agendamento>("/api/agendamentos", {
        ...dadosCliente,
        servico_id: servico.id,
        data,
        hora,
      })
      setAgendamento(criado)
      setEtapa("confirmacao")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErro("Esse horário acabou de ser preenchido por outra pessoa. Escolha outro.")
        setEtapa("horario")
        setHora("")
      } else {
        setErro(
          err instanceof ApiError ? err.message : "Não foi possível agendar. Tente novamente."
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {estabelecimento?.nome ?? "Agendamento"}
        </h1>
        <p className="text-sm text-muted-foreground">Agende seu horário em poucos passos.</p>
      </div>

      {ETAPAS_COM_VOLTAR.includes(etapa) && (
        <Button variant="ghost" size="sm" className="-mb-2 self-start" onClick={voltar}>
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
      )}

      {etapa === "servico" &&
        (carregandoServicos ? (
          <p className="text-center text-sm text-muted-foreground">Carregando serviços...</p>
        ) : servicos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Nenhum serviço disponível no momento.
          </p>
        ) : (
          <ServicoSelecao
            servicos={servicos}
            onSelecionar={(s) => {
              setServico(s)
              setEtapa("horario")
            }}
          />
        ))}

      {etapa === "horario" && servico && (
        <div className="flex flex-col gap-4">
          <HorarioSelecao
            servico={servico}
            data={data}
            hora={hora}
            onDataChange={setData}
            onHoraChange={setHora}
          />
          <Button disabled={!data || !hora} onClick={() => setEtapa("dados")}>
            Continuar
          </Button>
        </div>
      )}

      {etapa === "dados" && (
        <DadosClienteForm enviando={enviando} erro={erro} onSubmit={handleConfirmar} />
      )}

      {etapa === "confirmacao" && agendamento && (
        <ConfirmacaoAgendamento agendamento={agendamento} onNovoAgendamento={reiniciar} />
      )}
    </div>
  )
}
