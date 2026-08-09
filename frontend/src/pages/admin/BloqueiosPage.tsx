import { useState, type FormEvent } from "react"
import { Ban, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBloqueios } from "@/hooks/useBloqueios"
import { useEquipe } from "@/hooks/useEquipe"
import { formatarDataExibicao } from "@/lib/formatacao"
import { ApiError } from "@/lib/api"
import type { BloqueioInput } from "@/types"

const FORM_VAZIO: BloqueioInput = {
  data: "",
  hora_inicio: "",
  hora_fim: "",
  motivo: "",
  profissional_id: null,
}

export function BloqueiosPage() {
  const { bloqueios, loading, criar, remover } = useBloqueios()
  const { equipe } = useEquipe()
  const profissionais = equipe?.profissionais ?? []

  const [form, setForm] = useState<BloqueioInput>(FORM_VAZIO)
  const [diaInteiro, setDiaInteiro] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [removendoId, setRemovendoId] = useState<number | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!form.data) {
      setErro("Escolha uma data.")
      return
    }
    if (!diaInteiro && (!form.hora_inicio || !form.hora_fim)) {
      setErro("Informe início e fim do intervalo, ou marque 'dia inteiro'.")
      return
    }

    setSalvando(true)
    try {
      await criar({
        ...form,
        hora_inicio: diaInteiro ? "" : form.hora_inicio,
        hora_fim: diaInteiro ? "" : form.hora_fim,
      })
      toast.success("Bloqueio criado.")
      setForm(FORM_VAZIO)
      setDiaInteiro(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao criar bloqueio")
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id: number) {
    setRemovendoId(id)
    try {
      await remover(id)
      toast.success("Bloqueio removido.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover bloqueio")
    } finally {
      setRemovendoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Bloqueios</h1>
        <p className="text-sm text-muted-foreground">
          Marque períodos indisponíveis pra agendar — folga, almoço, feriado, férias. Entra no
          mesmo cálculo de horários livres da página pública.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Novo bloqueio</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>

            {profissionais.length > 1 && (
              <div className="grid gap-1.5">
                <Label>Quem fica indisponível</Label>
                <Select
                  value={form.profissional_id ? String(form.profissional_id) : "todos"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, profissional_id: v === "todos" ? null : Number(v) }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todo o estabelecimento">
                      {(value: string | null) => {
                        if (!value || value === "todos") return "Todo o estabelecimento"
                        return profissionais.find((p) => String(p.id) === value)?.nome ?? null
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo o estabelecimento</SelectItem>
                    {profissionais.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => setDiaInteiro(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Dia inteiro
          </label>

          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="hora_inicio">Início</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hora_fim">Fim</Label>
                <Input
                  id="hora_fim"
                  type="time"
                  value={form.hora_fim}
                  onChange={(e) => setForm((f) => ({ ...f, hora_fim: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input
              id="motivo"
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              placeholder="Ex: Almoço, feriado, férias..."
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div>
            <Button type="submit" disabled={salvando}>
              <Ban className="size-4" />
              {salvando ? "Salvando..." : "Criar bloqueio"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Bloqueios cadastrados</h2>
        <div className="mt-4 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : bloqueios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
          ) : (
            bloqueios.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {formatarDataExibicao(b.data)}
                    {" · "}
                    {b.hora_inicio && b.hora_fim ? `${b.hora_inicio} às ${b.hora_fim}` : "Dia inteiro"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {b.profissional_nome || "Todo o estabelecimento"}
                    {b.motivo && ` · ${b.motivo}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={removendoId === b.id}
                  onClick={() => handleRemover(b.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remover</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
