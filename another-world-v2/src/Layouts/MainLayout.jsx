import { Outlet } from "react-router-dom";
import Header from "../components/sections/Header";
import Footer from "../components/sections/Footer";

export default function MainLayout() {
  return (
    <div>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}