import { Routes, Route } from "react-router-dom";
import MainLayout from "./Layouts/MainLayout";
import Home from "./pages/Home";
import QuemSomos from "./pages/Quem-somos";
import Servicos from "./pages/Servicos";
import Contato from "./pages/Contato";
import Login from "./pages/Login";
import AreaCliente from "./pages/AreaCliente";
import RotaProtegida from "./components/RotaProtegida";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/quem-somos" element={<QuemSomos />} />
        <Route path="/servicos" element={<Servicos />} />
        <Route path="/contato" element={<Contato />} />
        <Route path="/login" element={<Login />} />

        {/* Só entra quem está logado — senão o RotaProtegida manda pro /login. */}
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