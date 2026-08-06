import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  CalendarDays,
  CalendarRange,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Sparkles,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/common/ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus"

const NAV_ITEMS_BASE = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
]

// Equipe e Configurações são exclusivas do dono — um profissional auxiliar
// não convida outros profissionais nem mexe nas configurações gerais da
// empresa (ver CLAUDE.md).
const NAV_ITEMS_DONO = [
  { to: "/admin/equipe", label: "Equipe", icon: Users },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
]

// Marca mostra a logo do próprio estabelecimento quando o dono já subiu uma
// (personaliza o painel com a cara do negócio) — sem logo, cai no ícone e
// nome padrão do AgendHora.
function Marca() {
  const { estabelecimento } = useAuth()

  if (estabelecimento?.logo) {
    return (
      <div className="flex min-w-0 items-center gap-2 px-2">
        <img
          src={estabelecimento.logo}
          alt={estabelecimento.nome}
          className="size-7 shrink-0 rounded-md object-cover"
        />
        <span className="truncate font-heading text-lg font-semibold">
          {estabelecimento.nome}
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
      <CalendarDays className="size-5 shrink-0 text-primary" />
      <span className="truncate font-heading text-lg font-semibold">AgendHora</span>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { ehDono } = useAuth()
  const itens = ehDono ? [...NAV_ITEMS_BASE, ...NAV_ITEMS_DONO] : NAV_ITEMS_BASE
  return (
    <>
      {itens.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

function RodapeConta() {
  const { estabelecimento, logout } = useAuth()
  const { carregando, obrigatoriosCompletos } = useOnboardingStatus()
  const navigate = useNavigate()

  function sair() {
    logout()
    navigate("/login")
  }

  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
      {estabelecimento && (
        <>
          <p className="truncate px-3 text-sm font-medium">{estabelecimento.nome}</p>
          <a
            href={`/${estabelecimento.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            Ver página pública
          </a>
          {!carregando && !obrigatoriosCompletos && (
            <NavLink
              to="/admin/comecando"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Rocket className="size-4" />
              Primeiros passos
            </NavLink>
          )}
        </>
      )}
      <button
        type="button"
        onClick={sair}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" />
        Sair
      </button>
    </div>
  )
}

export function AdminLayout() {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  // fecha o drawer automaticamente ao navegar
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row">
      <header className="flex items-center justify-between border-b border-border p-3 md:hidden">
        <Marca />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon-sm" onClick={() => setMenuAberto(true)}>
            <Menu className="size-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </div>
      </header>

      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <div className="mb-4 flex items-center justify-between">
          <Marca />
          <ThemeToggle />
        </div>
        <NavLinks />
        <RodapeConta />
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="flex w-64 flex-col">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-1 flex-col gap-1 px-4">
            <NavLinks onNavigate={() => setMenuAberto(false)} />
            <RodapeConta />
          </nav>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
