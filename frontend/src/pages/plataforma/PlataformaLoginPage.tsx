import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { apiPlataforma, setTokenPlataforma, ApiError } from "@/lib/api"

export function PlataformaLoginPage() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const resposta = await apiPlataforma.post<{ token: string }>("/login", { senha })
      setTokenPlataforma(resposta.token)
      navigate("/plataforma/isencoes")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao entrar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo.png" alt="AgendHora" className="size-12 rounded-xl" />
          <h1 className="font-heading text-xl font-semibold">Plataforma</h1>
          <p className="text-sm text-muted-foreground">Acesso interno — só o dono do projeto</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoFocus
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
