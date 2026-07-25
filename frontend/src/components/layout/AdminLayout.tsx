import { NavLink, Outlet } from "react-router-dom"
import { CalendarDays, CalendarRange, Settings, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/admin/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
]

export function AdminLayout() {
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border p-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <CalendarDays className="size-5 text-primary" />
          <span className="font-heading text-lg font-semibold">Agendamento</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
