import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, apiAdmin, clearToken, getToken, setToken } from "@/lib/api"
import type { Estabelecimento, Usuario } from "@/types"

interface SessaoResponse {
  token: string
  estabelecimento: Estabelecimento
  usuario: Usuario
}

interface AuthContextValue {
  estabelecimento: Estabelecimento | null
  usuario: Usuario | null
  carregando: boolean
  autenticado: boolean
  ehDono: boolean
  login: (email: string, senha: string) => Promise<void>
  registro: (nomeEstabelecimento: string, nome: string, email: string, senha: string) => Promise<void>
  entrarComSessao: (sessao: SessaoResponse) => void
  logout: () => void
  atualizarEstabelecimento: (estabelecimento: Estabelecimento) => void
  atualizarUsuario: (usuario: Usuario) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setCarregando(false)
      return
    }
    apiAdmin
      .get<{ estabelecimento: Estabelecimento; usuario: Usuario }>("/sessao")
      .then((sessao) => {
        setEstabelecimento(sessao.estabelecimento)
        setUsuario(sessao.usuario)
      })
      .catch(() => clearToken())
      .finally(() => setCarregando(false))
  }, [])

  function entrarComSessao(resposta: SessaoResponse) {
    setToken(resposta.token)
    setEstabelecimento(resposta.estabelecimento)
    setUsuario(resposta.usuario)
  }

  async function login(email: string, senha: string) {
    const resposta = await api.post<SessaoResponse>("/api/auth/login", { email, senha })
    entrarComSessao(resposta)
  }

  async function registro(nomeEstabelecimento: string, nome: string, email: string, senha: string) {
    const resposta = await api.post<SessaoResponse>("/api/auth/registro", {
      nome_estabelecimento: nomeEstabelecimento,
      nome,
      email,
      senha,
    })
    entrarComSessao(resposta)
  }

  function logout() {
    clearToken()
    setEstabelecimento(null)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{
        estabelecimento,
        usuario,
        carregando,
        autenticado: !!estabelecimento,
        ehDono: usuario?.papel !== "auxiliar",
        login,
        registro,
        entrarComSessao,
        logout,
        atualizarEstabelecimento: setEstabelecimento,
        atualizarUsuario: setUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>")
  return ctx
}
