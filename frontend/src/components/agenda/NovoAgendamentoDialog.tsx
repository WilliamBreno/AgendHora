import { useEffect, useState, type FormEvent } from "react"
import { Check, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { DatePickerPopover } from "@/components/public/DatePickerPopover"
import { HoraInput } from "@/components/common/HoraInput"
import { ClienteAutocomplete } from "@/components/common/ClienteAutocomplete"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  duracaoEfetivaMin,
  formatarDuracao,
  formatarDuracaoServico,
  formatarPrecoTotalServicos,
  servicosCompativeis,
} from "@/lib/formatacao"
import type { AgendamentoInput, Cliente, ConflitoAgendamento, Servico, Usuario } from "@/types"

interface NovoAgendamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicos: Servico[]
  profissionais: Usuario[]
  // clientes já cadastrados — alimenta o autocompletar de nome (ver
  // ClienteAutocomplete): digitou, achou, clicou, já preenche o telefone.
  clientes: Cliente[]
  // segmento do estabelecimento (ver CLAUDE.md "Segmentos de negócio") —
  // "tatuagem" mostra sinal + link de referência já em destaque, em vez de
  // atrás de "mais opções".
  segmento: string
  onCriar: (input: AgendamentoInput) => Promise<unknown>
}

const FORM_VAZIO: AgendamentoInput = {
  cliente_nome: "",
  cliente_telefone: "",
  servico_id: 0,
  profissional_id: 0,
  data: "",
  hora: "",
  observacoes: "",
  link_referencia: "",
  valor_final: null,
  valor_sinal: null,
  sinal_pago: false,
}

export function NovoAgendamentoDialog({
  open,
  onOpenChange,
  servicos,
  profissionais,
  clientes,
  segmento,
  onCriar,
}: NovoAgendamentoDialogProps) {
  const destaqueFinanceiro = segmento === "tatuagem"
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(destaqueFinanceiro)
  const { usuario } = useAuth()
  // só mostra o seletor quando há de fato uma escolha (dono com equipe); com
  // um profissional só, o agendamento vai automaticamente pra ele.
  const exigeEscolhaProfissional = profissionais.length > 1
  const profissionalUnico = profissionais.length === 1 ? profissionais[0].id : (usuario?.id ?? 0)

  const [form, setForm] = useState<AgendamentoInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // preenchido quando a última tentativa esbarrou num horário já ocupado —
  // em vez de só bloquear, mostra com quem/o quê e oferece a opção de
  // encaixar mesmo assim ou escolher outro horário.
  const [conflito, setConflito] = useState<ConflitoAgendamento | null>(null)
  // multiServicoAtivo/adicionais (ver CLAUDE.md "Agendamento com mais de um
  // serviço") — mesmo recurso da página pública, agora também disponível
  // pra quem cria o agendamento manualmente pelo painel.
  const [multiServicoAtivo, setMultiServicoAtivo] = useState(false)
  const [adicionais, setAdicionais] = useState<Servico[]>([])

  function resetar() {
    setForm({ ...FORM_VAZIO, profissional_id: exigeEscolhaProfissional ? 0 : profissionalUnico })
    setErro(null)
    setConflito(null)
    setMaisOpcoesAberto(destaqueFinanceiro)
    setMultiServicoAtivo(false)
    setAdicionais([])
  }

  useEffect(() => {
    if (open) resetar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const servicoPrincipal = servicos.find((s) => s.id === form.servico_id) ?? null
  const todosSelecionados = servicoPrincipal ? [servicoPrincipal, ...adicionais] : adicionais
  // lista de opções pra "adicionar mais um" — só o que é compatível com o
  // que já está selecionado (mesma regra da página pública: um serviço
  // individual só combina com o catálogo geral ou com outro individual do
  // MESMO profissional).
  const adicionaisDisponiveis = servicoPrincipal
    ? servicosCompativeis(servicos, todosSelecionados).filter((s) => s.id !== servicoPrincipal.id)
    : []
  // um serviço individual no combo já define o profissional sozinho — nesse
  // caso o campo de profissional deixa de ser uma escolha livre, igual
  // acontece na página pública.
  const profissionalExigido: number | undefined = todosSelecionados.find(
    (s) => s.profissional_id !== null
  )?.profissional_id ?? undefined

  useEffect(() => {
    if (profissionalExigido !== undefined && form.profissional_id !== profissionalExigido) {
      atualizarCampo("profissional_id", profissionalExigido)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionalExigido])

  function atualizarCampo<K extends keyof AgendamentoInput>(campo: K, valor: AgendamentoInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // qualquer edição invalida a decisão de conflito anterior (pode ter sido
    // sobre outro horário/serviço)
    setConflito(null)
    setErro(null)
  }

  function selecionarPrincipal(id: number) {
    atualizarCampo("servico_id", id)
    // trocar o serviço principal pode invalidar as combinações já marcadas
    // (um individual de outro profissional, por exemplo) — mais simples e
    // previsível recomeçar a lista de adicionais do que tentar podar.
    setAdicionais([])
  }

  function alternarAdicional(servico: Servico) {
    setAdicionais((atual) =>
      atual.some((s) => s.id === servico.id)
        ? atual.filter((s) => s.id !== servico.id)
        : [...atual, servico]
    )
    setConflito(null)
    setErro(null)
  }

  function alternarModoMultiplo(ativo: boolean) {
    setMultiServicoAtivo(ativo)
    setAdicionais([])
  }

  async function submeter(forcarEncaixe: boolean) {
    setErro(null)
    setSalvando(true)
    try {
      await onCriar({
        ...form,
        servicos_adicionais_ids: adicionais.map((s) => s.id),
        encaixe: forcarEncaixe,
      })
      toast.success(forcarEncaixe ? "Agendamento encaixado." : "Agendamento criado.")
      resetar()
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const corpo = err.body as { conflito?: ConflitoAgendamento } | null
        setConflito(corpo?.conflito ?? null)
        if (!corpo?.conflito) setErro(err.message)
      } else {
        setErro(err instanceof ApiError ? err.message : "Não foi possível criar o agendamento.")
      }
    } finally {
      setSalvando(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setConflito(null)

    if (!form.cliente_nome.trim() || !form.cliente_telefone.trim()) {
      setErro("Informe o nome e o telefone do cliente.")
      return
    }
    if (!form.servico_id) {
      setErro("Selecione um serviço.")
      return
    }
    if (!form.profissional_id) {
      setErro("Selecione o profissional.")
      return
    }
    if (!form.data || !form.hora) {
      setErro("Informe a data e o horário.")
      return
    }

    setErro(null)
    submeter(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetar()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>
              Use para agendamentos feitos por telefone ou no balcão.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cliente_nome">Nome do cliente</Label>
                <ClienteAutocomplete
                  id="cliente_nome"
                  value={form.cliente_nome}
                  onChangeNome={(nome) => atualizarCampo("cliente_nome", nome)}
                  onSelecionar={(cliente) => {
                    atualizarCampo("cliente_nome", cliente.nome)
                    atualizarCampo("cliente_telefone", cliente.telefone)
                  }}
                  clientes={clientes}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cliente_telefone">Telefone</Label>
                <Input
                  id="cliente_telefone"
                  value={form.cliente_telefone}
                  onChange={(e) => atualizarCampo("cliente_telefone", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Serviço</Label>
              <Select
                value={form.servico_id ? String(form.servico_id) : ""}
                onValueChange={(value) => selecionarPrincipal(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um serviço">
                    {(value: string | null) => {
                      const servico = servicos.find((s) => String(s.id) === value)
                      return servico
                        ? `${servico.nome} · ${formatarDuracaoServico(servico.duracao_min, servico.duracao_max_min)}`
                        : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nome} · {formatarDuracaoServico(s.duracao_min, s.duracao_max_min)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {servicoPrincipal && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <label
                  htmlFor="multi-servico-admin"
                  className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                >
                  Agendar mais de um serviço nesse horário
                  <Switch
                    id="multi-servico-admin"
                    checked={multiServicoAtivo}
                    onCheckedChange={alternarModoMultiplo}
                  />
                </label>

                {multiServicoAtivo && (
                  <div className="flex flex-col gap-2">
                    {adicionaisDisponiveis.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum outro serviço combina com "{servicoPrincipal.nome}".
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {adicionaisDisponiveis.map((s) => {
                          const selecionado = adicionais.some((a) => a.id === s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => alternarAdicional(s)}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                                selecionado
                                  ? "border-primary bg-primary/[0.05]"
                                  : "border-input hover:bg-muted/50"
                              )}
                            >
                              <span>
                                {s.nome} ·{" "}
                                <span className="text-muted-foreground">
                                  {formatarDuracaoServico(s.duracao_min, s.duracao_max_min)}
                                </span>
                              </span>
                              {selecionado && <Check className="size-4 shrink-0 text-primary" />}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {adicionais.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {todosSelecionados.map((s) => s.nome).join(" + ")} ·{" "}
                        {formatarDuracao(
                          todosSelecionados.reduce((soma, s) => soma + duracaoEfetivaMin(s), 0)
                        )}{" "}
                        · {formatarPrecoTotalServicos(todosSelecionados)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {profissionalExigido !== undefined ? (
              <p className="text-sm text-muted-foreground">
                Profissional:{" "}
                <span className="font-medium text-foreground">
                  {profissionais.find((p) => p.id === profissionalExigido)?.nome ?? usuario?.nome}
                </span>
              </p>
            ) : (
              exigeEscolhaProfissional && (
                <div className="grid gap-1.5">
                  <Label>Profissional</Label>
                  <Select
                    value={form.profissional_id ? String(form.profissional_id) : ""}
                    onValueChange={(value) => atualizarCampo("profissional_id", Number(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o profissional">
                        {(value: string | null) => {
                          const profissional = profissionais.find((p) => String(p.id) === value)
                          return profissional ? profissional.nome : null
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Data</Label>
                <DatePickerPopover
                  value={form.data}
                  onChange={(valor) => atualizarCampo("data", valor)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hora">Horário</Label>
                <HoraInput
                  id="hora"
                  value={form.hora}
                  onChange={(valor) => atualizarCampo("hora", valor)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) => atualizarCampo("observacoes", e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            {/* Só existe pra segmento "tatuagem" — pra qualquer outro
                segmento, essa seção nem aparece no formulário (ver CLAUDE.md
                "Segmentos de negócio"). */}
            {destaqueFinanceiro && (
              <div className="rounded-lg border border-primary/30 bg-primary/[0.03]">
                <button
                  type="button"
                  onClick={() => setMaisOpcoesAberto((a) => !a)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
                >
                  <span>Valor final, sinal e referência</span>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", maisOpcoesAberto && "rotate-180")}
                  />
                </button>

                {maisOpcoesAberto && (
                  <div className="flex flex-col gap-3 border-t border-border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="valor_final" className="text-xs">
                          Valor final (R$)
                        </Label>
                        <Input
                          id="valor_final"
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.valor_final ?? ""}
                          placeholder="Preço do serviço"
                          onChange={(e) =>
                            atualizarCampo("valor_final", e.target.value === "" ? null : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="valor_sinal" className="text-xs">
                          Sinal (R$)
                        </Label>
                        <Input
                          id="valor_sinal"
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.valor_sinal ?? ""}
                          placeholder="0,00"
                          onChange={(e) =>
                            atualizarCampo("valor_sinal", e.target.value === "" ? null : Number(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={form.sinal_pago ?? false}
                        disabled={!form.valor_sinal}
                        onChange={(e) => atualizarCampo("sinal_pago", e.target.checked)}
                        className="size-4 rounded border-input accent-primary"
                      />
                      Sinal já foi pago
                    </label>

                    <div className="grid gap-1.5">
                      <Label htmlFor="link_referencia" className="text-xs">
                        Link de referência
                      </Label>
                      <Input
                        id="link_referencia"
                        value={form.link_referencia}
                        onChange={(e) => atualizarCampo("link_referencia", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {conflito && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <p className="text-amber-900 dark:text-amber-200">
                  Esse horário conflita com {conflito.cliente_nome} — {conflito.servico_nome},{" "}
                  {conflito.inicio}–{conflito.fim}. Confirmar mesmo assim?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConflito(null)}
                  >
                    Escolher outro horário
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={salvando}
                    onClick={() => submeter(true)}
                  >
                    {salvando ? "Encaixando..." : "Encaixar mesmo assim"}
                  </Button>
                </div>
              </div>
            )}

            {erro && !conflito && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          {!conflito && (
            <DialogFooter>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
