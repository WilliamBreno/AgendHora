import { useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import gsap from "gsap"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ServicoSelecao } from "@/components/public/ServicoSelecao"
import { ProfissionalSelecao } from "@/components/public/ProfissionalSelecao"
import { HorarioSelecao } from "@/components/public/HorarioSelecao"
import { DadosClienteForm, type DadosCliente } from "@/components/public/DadosClienteForm"
import { ConfirmacaoAgendamento } from "@/components/public/ConfirmacaoAgendamento"
import { AvisoFaixa } from "@/components/public/AvisoFaixa"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { usePublicoServicos } from "@/hooks/usePublicoServicos"
import { usePublicoEstabelecimento } from "@/hooks/usePublicoEstabelecimento"
import { usePublicoProfissionais } from "@/hooks/usePublicoProfissionais"
import { useDisponibilidade } from "@/hooks/useDisponibilidade"
import { apiPublico, ApiError } from "@/lib/api"
import {
  duracaoEfetivaMin,
  formatarDataExibicao,
  formatarDuracao,
  formatarPrecoTotalServicos,
  servicosCompativeis,
} from "@/lib/formatacao"
import type { Agendamento, ProfissionalPublico, Servico } from "@/types"

type Etapa = "servico" | "profissional" | "horario" | "dados" | "confirmacao"

const ETAPAS_COM_VOLTAR: Etapa[] = ["profissional", "horario", "dados"]

// título de cada passo do fluxo — a etapa "confirmacao" não entra aqui
// porque ConfirmacaoAgendamento já tem o próprio título ("Agendamento
// confirmado!"), não precisa de um de cima duplicando.
const TITULO_ETAPA: Partial<Record<Etapa, string>> = {
  servico: "Escolha o serviço",
  profissional: "Escolha o profissional",
  horario: "Escolha a data e o horário",
  dados: "Seus dados",
}

export function AgendarPage() {
  const { slug = "" } = useParams()
  const [searchParams] = useSearchParams()
  const { estabelecimento, loading: carregandoEstabelecimento, naoEncontrado, indisponivel } =
    usePublicoEstabelecimento(slug)
  const { servicos, loading: carregandoServicos } = usePublicoServicos(slug)
  const { profissionais, loading: carregandoProfissionais } = usePublicoProfissionais(slug)

  const [etapa, setEtapa] = useState<Etapa>("servico")
  // primeiro item = serviço principal — ver CLAUDE.md "Agendamento com mais
  // de um serviço". No fluxo padrão (toggle desligado) sempre tem 0 ou 1 item.
  const [servicosSelecionados, setServicosSelecionados] = useState<Servico[]>([])
  const [multiServicoAtivo, setMultiServicoAtivo] = useState(false)
  const [profissional, setProfissional] = useState<ProfissionalPublico | null>(null)
  const [data, setData] = useState("")
  const [hora, setHora] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null)
  // true quando chegou pelo link do e-mail automático de reagendamento com
  // um horário sugerido (ver CLAUDE.md "Reagendamento automático") — só
  // controla o aviso mostrado na etapa "dados", o agendamento em si sempre
  // exige o clique em "Confirmar agendamento" normalmente.
  const [viaSugestaoReagendamento, setViaSugestaoReagendamento] = useState(false)
  const prefillAplicado = useRef(false)

  // pré-seleciona serviço(s)/profissional/data/horário quando o link vem
  // com esses parâmetros (e-mail de reagendamento automático) — o cliente
  // só confirma, sem precisar escolher tudo de novo. servico_id pode
  // repetir na query string quando o último agendamento tinha mais de um
  // serviço. Roda uma única vez, assim que serviços e profissionais
  // terminarem de carregar.
  useEffect(() => {
    if (prefillAplicado.current) return
    if (carregandoServicos || carregandoProfissionais) return
    if (servicos.length === 0) return
    prefillAplicado.current = true

    const servicoIdsParam = searchParams.getAll("servico_id")
    if (servicoIdsParam.length === 0) return
    const encontrados = servicoIdsParam
      .map((id) => servicos.find((s) => String(s.id) === id))
      .filter((s): s is Servico => s !== undefined)
    if (encontrados.length === 0) return

    setServicosSelecionados(encontrados)

    const profissionalIdParam = searchParams.get("profissional_id")
    const dataParam = searchParams.get("data")
    const horaParam = searchParams.get("hora")
    const profissionalEncontrado = profissionalIdParam
      ? (profissionais.find((p) => String(p.id) === profissionalIdParam) ?? null)
      : null

    if (profissionalEncontrado && dataParam && horaParam) {
      setProfissional(profissionalEncontrado)
      setData(dataParam)
      setHora(horaParam)
      setViaSugestaoReagendamento(true)
      setEtapa("dados")
    } else if (profissionais.length > 1) {
      setEtapa("profissional")
    } else {
      setProfissional(profissionais[0] ?? null)
      setEtapa("horario")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoServicos, carregandoProfissionais, servicos, profissionais])

  const { horarios, loading: carregandoHorarios } = useDisponibilidade(
    slug,
    servicosSelecionados.map((s) => s.id),
    profissional?.id ?? null,
    data
  )

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
    setServicosSelecionados([])
    setMultiServicoAtivo(false)
    setProfissional(null)
    setData("")
    setHora("")
    setErro(null)
    setAgendamento(null)
    setViaSugestaoReagendamento(false)
  }

  // avancarComServicos decide o próximo passo a partir da seleção final: um
  // serviço individual (ver CLAUDE.md "Serviços individuais") já define o
  // profissional sozinho, então pula direto pro horário — o cliente nem
  // sabe que existem outros profissionais. Sem isso, só pergunta quando há
  // de fato mais de um profissional na equipe.
  function avancarComServicos(selecionados: Servico[]) {
    if (selecionados.length === 0) return
    setServicosSelecionados(selecionados)
    const profissionalExigido = selecionados.find((s) => s.profissional_id !== null)?.profissional_id
    if (profissionalExigido !== undefined) {
      setProfissional(profissionais.find((p) => p.id === profissionalExigido) ?? null)
      setEtapa("horario")
    } else if (profissionais.length > 1) {
      setEtapa("profissional")
    } else {
      setProfissional(profissionais[0] ?? null)
      setEtapa("horario")
    }
  }

  // clique num serviço com o toggle de múltiplos serviços desligado —
  // avança na hora, igual sempre funcionou.
  function selecionarServico(s: Servico) {
    avancarComServicos([s])
  }

  function alternarServicoMultiplo(s: Servico) {
    setServicosSelecionados((atual) =>
      atual.some((sel) => sel.id === s.id) ? atual.filter((sel) => sel.id !== s.id) : [...atual, s]
    )
  }

  function alternarModoMultiplo(ativo: boolean) {
    setMultiServicoAtivo(ativo)
    setServicosSelecionados([])
  }

  function voltar() {
    const somenteGerais = servicosSelecionados.every((s) => s.profissional_id === null)
    const exigiaEscolhaProfissional = somenteGerais && profissionais.length > 1
    if (etapa === "profissional") setEtapa("servico")
    else if (etapa === "horario") setEtapa(exigiaEscolhaProfissional ? "profissional" : "servico")
    else if (etapa === "dados") {
      setViaSugestaoReagendamento(false)
      setEtapa("horario")
    }
  }

  async function handleConfirmar(dadosCliente: DadosCliente) {
    const [principal, ...adicionais] = servicosSelecionados
    if (!principal || !profissional || !data || !hora) return
    setEnviando(true)
    setErro(null)
    try {
      const criado = await apiPublico(slug).post<Agendamento>("/agendamentos", {
        ...dadosCliente,
        servico_id: principal.id,
        servicos_adicionais_ids: adicionais.map((s) => s.id),
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

  if (indisponivel) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-semibold">Agendamento indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esse estabelecimento está temporariamente indisponível pra novos agendamentos. Tente
            novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  const listaCompativel = servicosCompativeis(servicos, servicosSelecionados)
  const duracaoTotalSelecionada = servicosSelecionados.reduce(
    (soma, s) => soma + duracaoEfetivaMin(s),
    0
  )

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

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
        <AvisoFaixa
          texto={estabelecimento.aviso_texto}
          corTexto={estabelecimento.aviso_cor_texto}
          corFundo={estabelecimento.aviso_cor_fundo}
        />
      )}

      {ETAPAS_COM_VOLTAR.includes(etapa) && (
        <Button variant="ghost" size="sm" className="-mb-2 self-start" onClick={voltar}>
          <ChevronLeft className="size-4" />
          Voltar
        </Button>
      )}

      <div ref={conteudoRef}>
        {TITULO_ETAPA[etapa] && (
          <h2 className="mb-3 font-heading text-lg font-semibold">{TITULO_ETAPA[etapa]}</h2>
        )}

        {etapa === "servico" &&
          (carregandoServicos || carregandoProfissionais ? (
            <p className="text-center text-sm text-muted-foreground">Carregando serviços...</p>
          ) : servicos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum serviço disponível no momento.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <label
                htmlFor="multi-servico"
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm text-muted-foreground"
              >
                Quero agendar mais de um serviço nesse horário
                <Switch
                  id="multi-servico"
                  checked={multiServicoAtivo}
                  onCheckedChange={alternarModoMultiplo}
                />
              </label>

              <ServicoSelecao
                servicos={listaCompativel}
                onSelecionar={selecionarServico}
                multiplo={multiServicoAtivo}
                selecionados={servicosSelecionados}
                onToggle={alternarServicoMultiplo}
              />

              {multiServicoAtivo && servicosSelecionados.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/[0.03] p-3 text-sm">
                  <p className="text-muted-foreground">
                    {servicosSelecionados.map((s) => s.nome).join(" + ")} ·{" "}
                    {formatarDuracao(duracaoTotalSelecionada)} ·{" "}
                    {formatarPrecoTotalServicos(servicosSelecionados)}
                  </p>
                  <Button type="button" onClick={() => avancarComServicos(servicosSelecionados)}>
                    Continuar
                  </Button>
                </div>
              )}
            </div>
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

        {etapa === "horario" && servicosSelecionados.length > 0 && profissional && (
          <div className="flex flex-col gap-4">
            <HorarioSelecao
              horarios={horarios}
              loading={carregandoHorarios}
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
          <div className="flex flex-col gap-4">
            {viaSugestaoReagendamento && data && hora && (
              <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3 text-sm text-muted-foreground">
                Esse é o mesmo horário do seu último agendamento:{" "}
                <strong className="text-foreground">
                  {formatarDataExibicao(data)} às {hora}
                </strong>
                . Não é esse horário? Toque em "Voltar" pra escolher outro.
              </div>
            )}
            <DadosClienteForm
              enviando={enviando}
              erro={erro}
              mostrarLinkReferencia={estabelecimento?.segmento === "tatuagem"}
              nomeInicial={searchParams.get("nome") ?? undefined}
              telefoneInicial={searchParams.get("telefone") ?? undefined}
              onSubmit={handleConfirmar}
            />
          </div>
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
