import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { api, ApiError } from "@/lib/api"
import type { Estabelecimento, Usuario } from "@/types"

interface ConviteInfo {
  nome_estabelecimento: string
  email: string
  telefone: string
}

interface SessaoResponse {
  token: string
  estabelecimento: Estabelecimento
  usuario: Usuario
}

export function ConvitePage() {
  const { token = "" } = useParams()
  const { entrarComSessao } = useAuth()
  const navigate = useNavigate()

  const [convite, setConvite] = useState<ConviteInfo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [invalido, setInvalido] = useState(false)

  const [nome, setNome] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api
      .get<ConviteInfo>(`/api/convites/${token}`)
      .then(setConvite)
      .catch(() => setInvalido(true))
      .finally(() => setCarregando(false))
  }, [token])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.")
      return
    }

    setEnviando(true)
    try {
      const resposta = await api.post<SessaoResponse>(`/api/convites/${token}/aceitar`, {
        nome,
        senha,
      })
      entrarComSessao(resposta)
      toast.success(`Conta criada! Você já pode acessar sua agenda em ${resposta.estabelecimento.nome}.`)
      navigate("/admin/dashboard")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao criar conta")
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Carregando convite...
      </div>
    )
  }

  if (invalido || !convite) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-semibold">Convite inválido ou expirado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peça pro dono do estabelecimento enviar um novo convite.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo.png" alt="AgendHora" className="size-12 rounded-xl" />
          <h1 className="font-heading text-2xl font-semibold">AgendHora</h1>
          <p className="text-sm text-muted-foreground">
            Você foi convidado(a) por <strong>{convite.nome_estabelecimento}</strong>. Crie sua
            senha pra acessar sua agenda.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="grid gap-1.5">
            <Label>E-mail</Label>
            <Input value={convite.email} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Seu nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Crie uma senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" disabled={enviando}>
            {enviando ? "Criando..." : "Criar minha conta"}
          </Button>
        </form>
      </div>
    </div>
  )
}
