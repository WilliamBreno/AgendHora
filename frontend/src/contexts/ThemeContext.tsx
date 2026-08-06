import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Tema = "light" | "dark"

interface ThemeContextValue {
  tema: Tema
  alternarTema: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const CHAVE_STORAGE = "agendhora_tema"

function temaSalvo(): Tema | null {
  const valor = localStorage.getItem(CHAVE_STORAGE)
  return valor === "light" || valor === "dark" ? valor : null
}

function temaPreferidoDoSistema(): Tema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// ThemeProvider fica no topo do App — vale tanto pra área admin (dono e
// profissional auxiliar) quanto pra página pública (cliente final). A
// preferência é salva no localStorage; sem uma escolha explícita, cai no
// tema do sistema operacional do visitante.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaSalvo() ?? temaPreferidoDoSistema())

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark")
    localStorage.setItem(CHAVE_STORAGE, tema)
  }, [tema])

  function alternarTema() {
    setTema((atual) => (atual === "dark" ? "light" : "dark"))
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>")
  return ctx
}
