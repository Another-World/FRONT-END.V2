import { Outlet } from "react-router-dom";

import Header from "../components/sections/Header";
import Footer from "../components/sections/Footer";
import BotaoAjuda from "../components/ui/BotaoAjuda";

export default function MainLayout() {
  return (
    <div>
      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />

      <BotaoAjuda />
    </div>
  );
}