import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./Layouts/MainLayout";
import AdminLayout from "./Layouts/AdminLayout";

import Home from "./pages/Home";
import QuemSomos from "./pages/Quem-somos";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import Login from "./pages/Login";
import AreaCliente from "./pages/AreaCliente";
import Atendimento from "./pages/Atendimento";

import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosDeUso from "./pages/TermosDeUso";

import RotaProtegida from "./components/RotaProtegida";
import RotaAdmin from "./components/RotaAdmin";
import AdminPagina from "./pages/Admin";

export default function App() {
  return (
    <Routes>

      <Route element={<MainLayout />}>

        <Route path="/" element={<Home />} />

        <Route
          path="/quem-somos"
          element={<QuemSomos />}
        />

        <Route
          path="/servicos"
          element={<Servicos />}
        />

        <Route
          path="/contato"
          element={<Contato />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/politica-de-privacidade"
          element={<PoliticaPrivacidade />}
        />

        <Route
          path="/termos-de-uso"
          element={<TermosDeUso />}
        />

        <Route
          path="/area-cliente"
          element={
            <RotaProtegida>
              <AreaCliente />
            </RotaProtegida>
          }
        />

      </Route>

      <Route path="/atendimento" element={<Navigate to="/admin/solicitacoes" replace />} />

      <Route path="/admin" element={<RotaAdmin><AdminLayout /></RotaAdmin>}>
        <Route index element={<AdminPagina />} />
        <Route path="solicitacoes" element={<Atendimento />} />
        <Route path="orcamentos" element={<AdminPagina />} />
        <Route path="usuarios" element={<AdminPagina />} />
        <Route path="avaliacoes" element={<AdminPagina />} />
      </Route>

    </Routes>
  );
}
