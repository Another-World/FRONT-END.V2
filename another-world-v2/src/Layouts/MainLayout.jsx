import { Outlet } from "react-router-dom";

import Header from "../components/sections/Header";
import Footer from "../components/sections/Footer";
import MouseGlow from "../components/ui/MouseGlow";

export default function MainLayout() {
  return (
    <div>
      <MouseGlow />

      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}