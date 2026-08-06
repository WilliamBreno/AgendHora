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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
]

function Marca() {
  return (
    <div className="flex items-center gap-2 px-2">
      <CalendarDays className="size-5 text-primary" />
      <span className="font-heading text-lg font-semibold">AgendHora</span>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
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
          <NavLink
            to="/admin/comecando"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Rocket className="size-4" />
            Primeiros passos
          </NavLink>
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
        <Button variant="ghost" size="icon-sm" onClick={() => setMenuAberto(true)}>
          <Menu className="size-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </header>

      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <div className="mb-4">
          <Marca />
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
