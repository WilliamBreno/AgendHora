import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { RotaProtegida } from "@/components/layout/RotaProtegida"
import { DashboardPage } from "@/pages/admin/DashboardPage"
import { ComecandoPage } from "@/pages/admin/ComecandoPage"
import { AgendaPage } from "@/pages/admin/AgendaPage"
import { ServicosPage } from "@/pages/admin/ServicosPage"
import { ConfiguracoesPage } from "@/pages/admin/ConfiguracoesPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegistroPage } from "@/pages/auth/RegistroPage"
import { AgendarPage } from "@/pages/public/AgendarPage"
import { MeusAgendamentosPage } from "@/pages/public/MeusAgendamentosPage"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />

          <Route element={<RotaProtegida />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="comecando" element={<ComecandoPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="servicos" element={<ServicosPage />} />
              <Route path="configuracoes" element={<ConfiguracoesPage />} />
            </Route>
          </Route>

          <Route path="/:slug/meus-agendamentos" element={<MeusAgendamentosPage />} />
          <Route path="/:slug" element={<AgendarPage />} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
