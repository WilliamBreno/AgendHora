import { useState, type FormEvent } from "react"
import { Mail, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEquipe } from "@/hooks/useEquipe"
import { ApiError } from "@/lib/api"

export function EquipePage() {
  const { equipe, loading, convidar } = useEquipe()
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await convidar(email, telefone)
      toast.success("Convite enviado. Assim que a pessoa aceitar, ela aparece na sua equipe.")
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
          A pessoa recebe um e-mail com um link pra criar a própria senha. Ela terá acesso ao
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
              {equipe.profissionais.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-sm text-muted-foreground">{p.email}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {p.papel === "dono" ? "Dono" : "Auxiliar"}
                  </span>
                </div>
              ))}

              {equipe.convites_pendentes.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Convites pendentes</p>
                  {equipe.convites_pendentes.map((convite) => (
                    <div
                      key={convite.id}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                      <Mail className="size-4 shrink-0" />
                      <span>{convite.email}</span>
                      <span className="ml-auto text-xs">Aguardando aceite</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
