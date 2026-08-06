import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import gsap from "gsap"
import { Button } from "@/components/ui/button"
import { ServicoSelecao } from "@/components/public/ServicoSelecao"
import { ProfissionalSelecao } from "@/components/public/ProfissionalSelecao"
import { HorarioSelecao } from "@/components/public/HorarioSelecao"
import { DadosClienteForm, type DadosCliente } from "@/components/public/DadosClienteForm"
import { ConfirmacaoAgendamento } from "@/components/public/ConfirmacaoAgendamento"
import { AvisoFaixa } from "@/components/public/AvisoFaixa"
import { usePublicoServicos } from "@/hooks/usePublicoServicos"
import { usePublicoEstabelecimento } from "@/hooks/usePublicoEstabelecimento"
import { usePublicoProfissionais } from "@/hooks/usePublicoProfissionais"
import { apiPublico, ApiError } from "@/lib/api"
import type { Agendamento, ProfissionalPublico, Servico } from "@/types"

type Etapa = "servico" | "profissional" | "horario" | "dados" | "confirmacao"

const ETAPAS_COM_VOLTAR: Etapa[] = ["profissional", "horario", "dados"]

export function AgendarPage() {
  const { slug = "" } = useParams()
  const { estabelecimento, loading: carregandoEstabelecimento, naoEncontrado } =
    usePublicoEstabelecimento(slug)
  const { servicos, loading: carregandoServicos } = usePublicoServicos(slug)
  const { profissionais, loading: carregandoProfissionais } = usePublicoProfissionais(slug)

  const [etapa, setEtapa] = useState<Etapa>("servico")
  const [servico, setServico] = useState<Servico | null>(null)
  const [profissional, setProfissional] = useState<ProfissionalPublico | null>(null)
  const [data, setData] = useState("")
  const [hora, setHora] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null)

  const conteudoRef = useRef<HTMLDivElement>(null)

  // transição suave a cada troca de etapa do fluxo de agendamento
  useEffect(() => {
    if (!conteudoRef.current) return
    gsap.fromTo(
      conteudoRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
    )
  }, [etapa])

  function reiniciar() {
    setEtapa("servico")
    setServico(null)
    setProfissional(null)
    setData("")
    setHora("")
    setErro(null)
    setAgendamento(null)
  }

  // com só um profissional (o caso comum), pula direto pro horário — o
  // passo de escolha só aparece quando existe de fato uma escolha a fazer.
  function selecionarServico(s: Servico) {
    setServico(s)
    if (profissionais.length > 1) {
      setEtapa("profissional")
    } else {
      setProfissional(profissionais[0] ?? null)
      setEtapa("horario")
    }
  }

  function voltar() {
    if (etapa === "profissional") setEtapa("servico")
    else if (etapa === "horario") setEtapa(profissionais.length > 1 ? "profissional" : "servico")
    else if (etapa === "dados") setEtapa("horario")
  }

  async function handleConfirmar(dadosCliente: DadosCliente) {
    if (!servico || !profissional || !data || !hora) return
    setEnviando(true)
    setErro(null)
    try {
      const criado = await apiPublico(slug).post<Agendamento>("/agendamentos", {
        ...dadosCliente,
        servico_id: servico.id,
        profissional_id: profissional.id,
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

  if (naoEncontrado) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-semibold">Página não encontrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira o link com o estabelecimento e tente de novo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        {estabelecimento?.logo && (
          <img
            src={estabelecimento.logo}
            alt={estabelecimento.nome}
            className="size-16 rounded-xl border border-border object-cover"
          />
        )}
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {estabelecimento?.nome ?? (carregandoEstabelecimento ? "Carregando..." : "Agendamento")}
          </h1>
          <p className="text-sm text-muted-foreground">Agende seu horário em poucos passos.</p>
        </div>
      </div>

      {estabelecimento?.aviso_ativo && etapa !== "confirmacao" && (
        <AvisoFaixa texto={estabelecimento.aviso_texto} />
      )}

      {ETAPAS_COM_VOLTAR.includes(etapa) && (
        <Button variant="ghost" size="sm" className="-mb-2 self-start" onClick={voltar}>
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
      )}

      <div ref={conteudoRef}>
        {etapa === "servico" &&
          (carregandoServicos || carregandoProfissionais ? (
            <p className="text-center text-sm text-muted-foreground">Carregando serviços...</p>
          ) : servicos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum serviço disponível no momento.
            </p>
          ) : (
            <ServicoSelecao servicos={servicos} onSelecionar={selecionarServico} />
          ))}

        {etapa === "profissional" && (
          <ProfissionalSelecao
            profissionais={profissionais}
            onSelecionar={(p) => {
              setProfissional(p)
              setEtapa("horario")
            }}
          />
        )}

        {etapa === "horario" && servico && profissional && (
          <div className="flex flex-col gap-4">
            <HorarioSelecao
              slug={slug}
              servico={servico}
              profissionalId={profissional.id}
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

      {etapa !== "confirmacao" && (
        <p className="text-center text-xs text-muted-foreground">
          Já agendou?{" "}
          <Link to={`/${slug}/meus-agendamentos`} className="text-primary hover:underline">
            Ver meus agendamentos
          </Link>
        </p>
      )}
    </div>
  )
}
