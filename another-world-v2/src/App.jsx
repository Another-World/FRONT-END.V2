import { Routes, Route } from "react-router-dom";

import MainLayout from "./Layouts/MainLayout";

import Home from "./pages/Home";
import QuemSomos from "./pages/Quem-somos";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import Login from "./pages/Login";
import AreaCliente from "./pages/AreaCliente";

import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosDeUso from "./pages/TermosDeUso";

import RotaProtegida from "./components/RotaProtegida";

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

    </Routes>
  );
}