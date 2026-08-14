import { useEffect, useState, type FormEvent } from "react"
import { ChevronDown } from "lucide-react"
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
import { DatePickerPopover } from "@/components/public/DatePickerPopover"
import { HoraInput } from "@/components/common/HoraInput"
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
import type { AgendamentoInput, ConflitoAgendamento, Servico, Usuario } from "@/types"

interface NovoAgendamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicos: Servico[]
  profissionais: Usuario[]
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

  function resetar() {
    setForm({ ...FORM_VAZIO, profissional_id: exigeEscolhaProfissional ? 0 : profissionalUnico })
    setErro(null)
    setConflito(null)
    setMaisOpcoesAberto(destaqueFinanceiro)
  }

  useEffect(() => {
    if (open) resetar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function atualizarCampo<K extends keyof AgendamentoInput>(campo: K, valor: AgendamentoInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // qualquer edição invalida a decisão de conflito anterior (pode ter sido
    // sobre outro horário/serviço)
    setConflito(null)
    setErro(null)
  }

  async function submeter(forcarEncaixe: boolean) {
    setErro(null)
    setSalvando(true)
    try {
      await onCriar({ ...form, encaixe: forcarEncaixe })
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
                <Input
                  id="cliente_nome"
                  value={form.cliente_nome}
                  onChange={(e) => atualizarCampo("cliente_nome", e.target.value)}
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
                onValueChange={(value) => atualizarCampo("servico_id", Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um serviço">
                    {(value: string | null) => {
                      const servico = servicos.find((s) => String(s.id) === value)
                      return servico ? `${servico.nome} · ${servico.duracao_min} min` : null
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nome} · {s.duracao_min} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {exigeEscolhaProfissional && (
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

            <div className={cn("rounded-lg border border-border", destaqueFinanceiro && "border-primary/30 bg-primary/[0.03]")}>
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
