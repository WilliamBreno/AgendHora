import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { ApiError } from "@/lib/api"

export function CadastroPage() {
  const { registro, logout } = useAuth()
  const navigate = useNavigate()
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("")
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.")
      return
    }

    setEnviando(true)
    try {
      const resposta = await registro(nomeEstabelecimento, nome, email, senha, telefone)
      if (resposta.estabelecimento.ativo) {
        toast.success("Conta criada! Sua página de agendamento já está pronta.")
        navigate("/admin/comecando")
      } else {
        // ativo=false: a conta existe mas ainda não deve funcionar como uma
        // sessão de verdade — sem isso, o token guardado dispara o
        // redirecionamento de sessão expulsa (ExigirEstabelecimentoAtivo)
        // na próxima página que o dono visitar, até em cima do /login.
        logout()
        navigate("/cadastro/pagamento")
      }
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao criar conta")
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
          <h1 className="font-heading text-2xl font-semibold">AgendHora</h1>
          <p className="text-sm text-muted-foreground">Cadastre seu estabelecimento</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="nomeEstabelecimento">Nome do estabelecimento</Label>
            <Input
              id="nomeEstabelecimento"
              value={nomeEstabelecimento}
              onChange={(e) => setNomeEstabelecimento(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Seu nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
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
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
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
              minLength={6}
              required
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" disabled={enviando}>
            {enviando ? "Criando..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
