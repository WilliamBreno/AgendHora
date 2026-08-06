import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { RotaProtegida } from "@/components/layout/RotaProtegida"
import { DashboardPage } from "@/pages/admin/DashboardPage"
import { ComecandoPage } from "@/pages/admin/ComecandoPage"
import { AgendaPage } from "@/pages/admin/AgendaPage"
import { ServicosPage } from "@/pages/admin/ServicosPage"
import { ConfiguracoesPage } from "@/pages/admin/ConfiguracoesPage"
import { EquipePage } from "@/pages/admin/EquipePage"
import { RotaSomenteDono } from "@/components/layout/RotaSomenteDono"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegistroPage } from "@/pages/auth/RegistroPage"
import { ConvitePage } from "@/pages/auth/ConvitePage"
import { AgendarPage } from "@/pages/public/AgendarPage"
import { MeusAgendamentosPage } from "@/pages/public/MeusAgendamentosPage"

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegistroPage />} />
            <Route path="/convite/:token" element={<ConvitePage />} />

            <Route element={<RotaProtegida />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="comecando" element={<ComecandoPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="servicos" element={<ServicosPage />} />
                <Route element={<RotaSomenteDono />}>
                  <Route path="configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="equipe" element={<EquipePage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/:slug/meus-agendamentos" element={<MeusAgendamentosPage />} />
            <Route path="/:slug" element={<AgendarPage />} />

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
