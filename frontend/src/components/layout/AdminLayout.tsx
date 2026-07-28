import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { CalendarDays, CalendarRange, Menu, Settings, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const NAV_ITEMS = [
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
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-64">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            <NavLinks onNavigate={() => setMenuAberto(false)} />
          </nav>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
