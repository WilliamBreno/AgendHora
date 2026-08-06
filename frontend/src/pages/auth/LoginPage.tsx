import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await login(email, senha)
      navigate("/admin/agenda")
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
          <CalendarDays className="size-8 text-primary" />
          <h1 className="font-heading text-2xl font-semibold">AgendHora</h1>
          <p className="text-sm text-muted-foreground">Entre na sua conta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="grid gap-1.5">
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
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/registro" className="text-primary hover:underline">
            Cadastre seu estabelecimento
          </Link>
        </p>
      </div>
    </div>
  )
}
