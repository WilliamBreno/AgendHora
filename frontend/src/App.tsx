import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { AgendaPage } from "@/pages/admin/AgendaPage"
import { ServicosPage } from "@/pages/admin/ServicosPage"
import { ConfiguracoesPage } from "@/pages/admin/ConfiguracoesPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/agenda" replace />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="agenda" replace />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
