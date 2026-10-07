import { Outlet } from "react-router-dom";

import Header from "../components/sections/Header";
import Footer from "../components/sections/Footer";
import MouseGlow from "../components/ui/MouseGlow";
import ScrollToTop from "../components/ScrollToTop";
import BotaoAjuda from "../components/ui/BotaoAjuda";

export default function MainLayout() {
  return (
    <div>
      <ScrollToTop />

      <MouseGlow />

      <Header />

      <main>
        <Outlet />
      </main>

      <BotaoAjuda />

      <Footer />
    </div>
  );
}