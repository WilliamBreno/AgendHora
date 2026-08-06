import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

// Bloqueia acesso direto por URL a rotas exclusivas do dono (Configurações,
// Equipe) — um profissional auxiliar autenticado é mandado de volta pro
// Dashboard, mesmo que digite o endereço na mão.
export function RotaSomenteDono() {
  const { ehDono } = useAuth()

  if (!ehDono) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Outlet />
}
