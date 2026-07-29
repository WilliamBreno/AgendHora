import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, apiAdmin, clearToken, getToken, setToken } from "@/lib/api"
import type { Estabelecimento } from "@/types"

interface SessaoResponse {
  token: string
  estabelecimento: Estabelecimento
}

interface AuthContextValue {
  estabelecimento: Estabelecimento | null
  carregando: boolean
  autenticado: boolean
  login: (email: string, senha: string) => Promise<void>
  registro: (nomeEstabelecimento: string, email: string, senha: string) => Promise<void>
  logout: () => void
  atualizarEstabelecimento: (estabelecimento: Estabelecimento) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setCarregando(false)
      return
    }
    apiAdmin
      .get<Estabelecimento>("/estabelecimento")
      .then(setEstabelecimento)
      .catch(() => clearToken())
      .finally(() => setCarregando(false))
  }, [])

  async function login(email: string, senha: string) {
    const resposta = await api.post<SessaoResponse>("/api/auth/login", { email, senha })
    setToken(resposta.token)
    setEstabelecimento(resposta.estabelecimento)
  }

  async function registro(nomeEstabelecimento: string, email: string, senha: string) {
    const resposta = await api.post<SessaoResponse>("/api/auth/registro", {
      nome_estabelecimento: nomeEstabelecimento,
      email,
      senha,
    })
    setToken(resposta.token)
    setEstabelecimento(resposta.estabelecimento)
  }

  function logout() {
    clearToken()
    setEstabelecimento(null)
  }

  return (
    <AuthContext.Provider
      value={{
        estabelecimento,
        carregando,
        autenticado: !!estabelecimento,
        login,
        registro,
        logout,
        atualizarEstabelecimento: setEstabelecimento,
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
