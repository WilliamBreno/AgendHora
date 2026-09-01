import { useEffect, useState, type FormEvent } from "react"
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
import { ColorPicker } from "@/components/servicos/ColorPicker"
import { IconPickerField } from "@/components/servicos/IconPickerField"
import { ImageUploadField } from "@/components/common/ImageUploadField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CORES_SERVICO, type CorServico, type Servico, type ServicoInput, type Usuario } from "@/types"

interface ServicoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servico?: Servico | null
  iconesDisponiveis: string[]
  // Serviços individuais (ver CLAUDE.md) — o dono pode atribuir a qualquer
  // profissional, sem precisar de permissão; um auxiliar só pode marcar o
  // próprio serviço como individual, e só com a permissão concedida.
  ehDono: boolean
  usuarioAtual: Usuario | null
  profissionais: Usuario[]
  onSubmit: (input: ServicoInput) => Promise<void>
}

const FORM_VAZIO: ServicoInput = {
  nome: "",
  preco: null,
  preco_a_partir: false,
  duracao_min: 30,
  duracao_max_min: null,
  descricao: "",
  cor: CORES_SERVICO[0],
  icone: "",
  foto: "",
  profissional_id: null,
}

export function ServicoFormDialog({
  open,
  onOpenChange,
  servico,
  iconesDisponiveis,
  ehDono,
  usuarioAtual,
  profissionais,
  onSubmit,
}: ServicoFormDialogProps) {
  const [form, setForm] = useState<ServicoInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    setForm(
      servico
        ? {
            nome: servico.nome,
            preco: servico.preco,
            preco_a_partir: servico.preco_a_partir,
            duracao_min: servico.duracao_min,
            duracao_max_min: servico.duracao_max_min,
            descricao: servico.descricao,
            cor: servico.cor,
            icone: servico.icone,
            foto: servico.foto,
            profissional_id: servico.profissional_id,
          }
        : FORM_VAZIO
    )
  }, [open, servico])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!form.nome.trim()) {
      setErro("Informe o nome do serviço.")
      return
    }
    if (form.preco !== null && form.preco <= 0) {
      setErro("O preço precisa ser maior que zero.")
      return
    }
    if (form.duracao_min <= 0) {
      setErro("A duração precisa ser maior que zero.")
      return
    }
    if (form.duracao_max_min !== null && form.duracao_max_min <= form.duracao_min) {
      setErro("A duração máxima precisa ser maior que a duração mínima.")
      return
    }

    setSalvando(true)
    try {
      await onSubmit(form)
      onOpenChange(false)
    } catch {
      setErro("Não foi possível salvar o serviço. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{servico ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do serviço oferecido pelo estabelecimento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Corte de cabelo"
              />
            </div>

            {ehDono && profissionais.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Profissional</Label>
                <Select
                  value={form.profissional_id === null ? "todos" : String(form.profissional_id)}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      profissional_id: value === "todos" ? null : Number(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos (catálogo geral)">
                      {(value: string | null) => {
                        if (!value || value === "todos") return "Todos (catálogo geral)"
                        return profissionais.find((p) => String(p.id) === value)?.nome ?? null
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (catálogo geral)</SelectItem>
                    {profissionais.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Serviço individual: só aparece na página pública quando esse profissional é o
                  escolhido — o cliente nem precisa selecionar com quem.
                </p>
              </div>
            )}

            {!ehDono && usuarioAtual?.pode_cadastrar_servico_individual && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.profissional_id !== null}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      profissional_id: e.target.checked ? (usuarioAtual?.id ?? null) : null,
                    }))
                  }
                  className="size-4 rounded border-input accent-primary"
                />
                Serviço individual (só seu — não aparece pros outros profissionais)
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.preco ?? ""}
                  placeholder="Deixe em branco pra combinar"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      preco: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="duracao">
                  {form.duracao_max_min !== null ? "Duração mínima (min)" : "Duração (min)"}
                </Label>
                <Input
                  id="duracao"
                  type="number"
                  min={0}
                  step="5"
                  value={form.duracao_min}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duracao_min: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.duracao_max_min !== null}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    duracao_max_min: e.target.checked ? f.duracao_min + 15 : null,
                  }))
                }
                className="size-4 rounded border-input accent-primary"
              />
              Duração variável (de X a Y min)
            </label>
            {form.duracao_max_min !== null && (
              <div className="grid gap-1.5">
                <Label htmlFor="duracao_max">Duração máxima (min)</Label>
                <Input
                  id="duracao_max"
                  type="number"
                  min={0}
                  step="5"
                  value={form.duracao_max_min}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duracao_max_min: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  O cliente vê "de {form.duracao_min} a {form.duracao_max_min} min". A agenda
                  sempre reserva o tempo máximo, pra nunca dar conflito — quem atende marca
                  "Concluir agora" se terminar antes, e o resto do horário libera na hora.
                </p>
              </div>
            )}

            <label
              className={cn(
                "flex items-center gap-2 text-sm text-muted-foreground",
                form.preco === null && "opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={form.preco_a_partir}
                disabled={form.preco === null}
                onChange={(e) => setForm((f) => ({ ...f, preco_a_partir: e.target.checked }))}
                className="size-4 rounded border-input accent-primary"
              />
              Preço variável (mostrar como "a partir de")
            </label>
            {form.preco === null && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Sem preço, a página pública mostra "A combinar" pra esse serviço.
              </p>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Cor</Label>
              <ColorPicker
                value={form.cor}
                onChange={(cor: CorServico) => setForm((f) => ({ ...f, cor }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Ícone</Label>
              <IconPickerField
                value={form.icone}
                onChange={(icone) => setForm((f) => ({ ...f, icone }))}
                iconesDisponiveis={iconesDisponiveis}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Foto de exemplo (opcional)</Label>
              <ImageUploadField
                value={form.foto}
                onChange={(foto) => setForm((f) => ({ ...f, foto }))}
                trocarLabel="Trocar foto"
                enviarLabel="Enviar foto"
                ajuda="Mostrada pro cliente na página de agendamento."
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
