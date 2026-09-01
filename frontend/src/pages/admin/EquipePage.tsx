import { useState, type FormEvent } from "react"
import {
  CalendarPlus,
  CalendarX,
  Copy,
  DollarSign,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEquipe } from "@/hooks/useEquipe"
import { useAtividades } from "@/hooks/useAtividades"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"
import type { AcaoAtividade, Usuario } from "@/types"

function copiarLink(link: string) {
  navigator.clipboard.writeText(link)
  toast.success("Link copiado — pode mandar por WhatsApp, SMS, onde preferir.")
}

const ICONE_ATIVIDADE: Record<AcaoAtividade, typeof CalendarPlus> = {
  servico_criado: Sparkles,
  agendamento_criado: CalendarPlus,
  agendamento_cancelado: CalendarX,
  agendamento_pago: DollarSign,
}

function formatarDataHoraAtividade(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function EquipePage() {
  const { usuario } = useAuth()
  const { equipe, loading, convidar, atualizarPapel, atualizarPermissoes } = useEquipe()
  const { atividades, loading: carregandoAtividades } = useAtividades()
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [alterandoId, setAlterandoId] = useState<number | null>(null)

  async function handleAlternarPapel(membro: Usuario) {
    const novoPapel = membro.papel === "dono" ? "auxiliar" : "dono"
    setAlterandoId(membro.id)
    try {
      await atualizarPapel(membro.id, novoPapel)
      toast.success(
        novoPapel === "dono"
          ? `${membro.nome} agora tem acesso total, igual ao dono. Peça pra essa pessoa sair e entrar de novo pra a mudança valer.`
          : `${membro.nome} voltou a ser auxiliar. Peça pra essa pessoa sair e entrar de novo pra a mudança valer.`
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao alterar permissão")
    } finally {
      setAlterandoId(null)
    }
  }

  async function handleAlternarServicoIndividual(membro: Usuario, valor: boolean) {
    setAlterandoId(membro.id)
    try {
      await atualizarPermissoes(membro.id, valor)
      toast.success(
        valor
          ? `${membro.nome} agora pode cadastrar um serviço individual.`
          : `${membro.nome} não pode mais cadastrar serviço individual.`
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao alterar permissão")
    } finally {
      setAlterandoId(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await convidar(email, telefone)
      toast.success(
        "Convite criado. Enviamos por e-mail — se não chegar, copie o link na lista abaixo e mande você mesmo."
      )
      setEmail("")
      setTelefone("")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao enviar convite")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Convide profissionais auxiliares pra terem acesso à própria agenda, vinculada ao seu
          estabelecimento.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Convidar profissional</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A pessoa recebe um e-mail com um link pra criar a própria senha (se o e-mail não
          chegar, você pode copiar o link na lista abaixo e mandar direto). Ela terá acesso ao
          Dashboard, Serviços e à própria Agenda — sem acesso a Configurações nem a convidar
          outros profissionais.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="email">E-mail do profissional</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <Button type="submit" disabled={enviando}>
            <UserPlus className="size-4" />
            {enviando ? "Enviando..." : "Convidar"}
          </Button>
        </form>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Sua equipe</h2>
        <div className="mt-4 flex flex-col gap-2">
          {loading || !equipe ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {equipe.profissionais.map((p) => {
                const ehVoceMesmo = p.id === usuario?.id
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {p.nome} {ehVoceMesmo && <span className="text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">{p.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!ehVoceMesmo && p.papel === "auxiliar" && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={p.pode_cadastrar_servico_individual}
                            disabled={alterandoId === p.id}
                            onChange={(e) => handleAlternarServicoIndividual(p, e.target.checked)}
                            className="size-3.5 rounded border-input accent-primary"
                          />
                          Pode cadastrar serviço individual
                        </label>
                      )}
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {p.papel === "dono" ? "Dono" : "Auxiliar"}
                      </span>
                      {!ehVoceMesmo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={alterandoId === p.id}
                          onClick={() => handleAlternarPapel(p)}
                        >
                          <ShieldCheck className="size-4" />
                          {p.papel === "dono" ? "Rebaixar a auxiliar" : "Promover a dono"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              {equipe.convites_pendentes.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Convites pendentes</p>
                  {equipe.convites_pendentes.map((convite) => (
                    <div
                      key={convite.id}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                      <Mail className="size-4 shrink-0" />
                      <span className="truncate">{convite.email}</span>
                      <span className="ml-auto shrink-0 text-xs">Aguardando aceite</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copiarLink(convite.link)}
                      >
                        <Copy className="size-4" />
                        Copiar link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-medium">Atividades recentes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem cadastrou serviço, criou agendamento pelo painel, cancelou ou marcou como pago.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {carregandoAtividades ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : atividades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
          ) : (
            atividades.map((atividade) => {
              const Icone = ICONE_ATIVIDADE[atividade.acao]
              return (
                <div key={atividade.id} className="flex items-start gap-3 rounded-lg px-2 py-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icone className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{atividade.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {atividade.usuario?.nome ?? "Alguém"} · {formatarDataHoraAtividade(atividade.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
