import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { RotaProtegida } from "@/components/layout/RotaProtegida"
import { DashboardPage } from "@/pages/admin/DashboardPage"
import { ComecandoPage } from "@/pages/admin/ComecandoPage"
import { AgendaPage } from "@/pages/admin/AgendaPage"
import { ClientesPage } from "@/pages/admin/ClientesPage"
import { ServicosPage } from "@/pages/admin/ServicosPage"
import { ConfiguracoesPage } from "@/pages/admin/ConfiguracoesPage"
import { EquipePage } from "@/pages/admin/EquipePage"
import { BloqueiosPage } from "@/pages/admin/BloqueiosPage"
import { RotaSomenteDono } from "@/components/layout/RotaSomenteDono"
import { LoginPage } from "@/pages/auth/LoginPage"
import { CadastroPage } from "@/pages/auth/CadastroPage"
import { PagamentoPendentePage } from "@/pages/auth/PagamentoPendentePage"
import { ConvitePage } from "@/pages/auth/ConvitePage"
import { ContaInativaPage } from "@/pages/auth/ContaInativaPage"
import { MarketingPage } from "@/pages/marketing/MarketingPage"
import { PlataformaLoginPage } from "@/pages/plataforma/PlataformaLoginPage"
import { PlataformaIsencoesPage } from "@/pages/plataforma/PlataformaIsencoesPage"
import { AgendarPage } from "@/pages/public/AgendarPage"
import { MeusAgendamentosPage } from "@/pages/public/MeusAgendamentosPage"

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<CadastroPage />} />
            <Route path="/cadastro/pagamento/:slug" element={<PagamentoPendentePage />} />
            {/* /registro é o link antigo — mantido redirecionando pra não quebrar quem já tinha salvo */}
            <Route path="/registro" element={<Navigate to="/cadastro" replace />} />
            <Route path="/convite/:token" element={<ConvitePage />} />
            <Route path="/conta-inativa" element={<ContaInativaPage />} />

            {/* uso pessoal do dono do projeto — sem link em lugar nenhum da UI normal */}
            <Route path="/plataforma/login" element={<PlataformaLoginPage />} />
            <Route path="/plataforma/isencoes" element={<PlataformaIsencoesPage />} />

            <Route element={<RotaProtegida />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="comecando" element={<ComecandoPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="servicos" element={<ServicosPage />} />
                <Route element={<RotaSomenteDono />}>
                  <Route path="configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="equipe" element={<EquipePage />} />
                  <Route path="bloqueios" element={<BloqueiosPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/:slug/meus-agendamentos" element={<MeusAgendamentosPage />} />
            <Route path="/:slug" element={<AgendarPage />} />

            <Route path="/" element={<MarketingPage />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
