import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Trash2 } from "lucide-react"
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
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { useEmailsIsentos } from "@/hooks/useEmailsIsentos"
import { getTokenPlataforma, clearTokenPlataforma, ApiError } from "@/lib/api"
import type { DuracaoIsencao } from "@/types"

const DURACAO_LABEL: Record<string, string> = {
  sempre: "Sempre",
  "7": "7 dias",
  "15": "15 dias",
  "30": "30 dias",
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR")
}

export function PlataformaIsencoesPage() {
  const navigate = useNavigate()
  const { emails, loading, adicionar, remover } = useEmailsIsentos()
  const [email, setEmail] = useState("")
  const [duracao, setDuracao] = useState("sempre")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [removendoId, setRemovendoId] = useState<number | null>(null)

  useEffect(() => {
    if (!getTokenPlataforma()) navigate("/plataforma/login", { replace: true })
  }, [navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const duracaoDias = (duracao === "sempre" ? null : Number(duracao)) as DuracaoIsencao
      await adicionar(email, duracaoDias)
      setEmail("")
      setDuracao("sempre")
      toast.success("E-mail adicionado à lista de isenção.")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao adicionar e-mail")
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id: number) {
    setRemovendoId(id)
    try {
      await remover(id)
      toast.success("E-mail removido da lista.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover e-mail")
    } finally {
      setRemovendoId(null)
    }
  }

  function handleLogout() {
    clearTokenPlataforma()
    navigate("/plataforma/login", { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Isenção de pagamento</h1>
          <p className="text-sm text-muted-foreground">
            E-mails aqui nascem já ativos ao se cadastrar, sem passar pela cobrança.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-xl border border-border bg-card p-5"
      >
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Duração</Label>
          <Select value={duracao} onValueChange={(v) => setDuracao(v ?? "sempre")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sempre">
                {(v: string | null) => DURACAO_LABEL[v ?? "sempre"]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DURACAO_LABEL).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>
      {erro && <p className="-mt-4 text-sm text-destructive">{erro}</p>}

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum e-mail isento cadastrado.</p>
        ) : (
          emails.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex-1">
                <p className="font-medium">{e.email}</p>
                <p className="text-sm text-muted-foreground">
                  {e.estabelecimento_id ? `Usado por ${e.estabelecimento_nome}` : "Ainda não usado"}
                  {" · "}
                  {!e.duracao_dias ? (
                    "Sempre"
                  ) : e.isento_ate ? (
                    new Date(e.isento_ate) < new Date() ? (
                      <span className="text-destructive">
                        Isenção expirada em {formatarData(e.isento_ate)}
                      </span>
                    ) : (
                      `Isento até ${formatarData(e.isento_ate)}`
                    )
                  ) : (
                    `${e.duracao_dias} dias (a partir do cadastro)`
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={removendoId === e.id}
                onClick={() => handleRemover(e.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Remover</span>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
