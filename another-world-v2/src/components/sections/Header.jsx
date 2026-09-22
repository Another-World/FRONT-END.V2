import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../../assets/logo.png"


export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { label: "Home", to: "/" },
    { label: "Quem Somos", to: "/quem-somos" },
    { label: "Serviços", to: "/servicos" },
    { label: "Projetos", to: "/projetos" },
    { label: "Contato", to: "/contato" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-dark/95 backdrop-blur">
      <div className="mx-auto flex h-[82px] max-w-[1440px] items-center justify-between px-6">
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3"
        >
          <img
            src={logo}
            alt="Logo Another World"
            className="h-25 w-25 object-contain"
          />

          <span className="text-[18px] font-bold tracking-[0.08em] text-white">
            ANOTHER WORLD
          </span>
        </Link>

        {/* MENU DESKTOP */}
        <nav className="hidden items-center gap-8 lg:flex">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive
                  ? "text-white"
                  : "text-text-muted hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* AÇÕES DESKTOP */}
        <div className="hidden items-center gap-3 lg:flex">

          {/* ÁREA DO CLIENTE */}
          <Link
            to="/area-cliente"
            className="rounded-full border border-purple/50 px-5 py-2.5 text-sm font-medium text-purple transition-all hover:border-purple hover:bg-purple/10"
          >
            Área do Cliente
          </Link>

          {/* FALAR CONOSCO */}
          <Link
            to="/contato"
            className="rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            Falar conosco
          </Link>

        </div>

        {/* BOTÃO HAMBÚRGUER */}
        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-white transition hover:bg-bg-section lg:hidden"
        >
          <span className="sr-only">Menu</span>

          <div className="flex flex-col gap-1.5">
            <span
              className={`block h-0.5 w-5 bg-white transition-transform ${menuOpen ? "translate-y-2 rotate-45" : ""
                }`}
            />
            <span
              className={`block h-0.5 w-5 bg-white transition-opacity ${menuOpen ? "opacity-0" : "opacity-100"
                }`}
            />
            <span
              className={`block h-0.5 w-5 bg-white transition-transform ${menuOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
            />
          </div>
        </button>
      </div>

      {/* MENU MOBILE */}
      {menuOpen && (
        <div className="border-t border-border bg-bg-dark px-6 py-6 lg:hidden">
          <nav className="flex flex-col gap-5">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `text-base font-medium transition-colors ${isActive
                    ? "text-white"
                    : "text-text-muted hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="my-1 h-px bg-border" />

            {/* ÁREA DO CLIENTE MOBILE */}
            <Link
              to="/area-cliente"
              onClick={() => setMenuOpen(false)}
              className="rounded-full border border-purple/50 px-5 py-3 text-center text-sm font-medium text-purple transition hover:bg-purple/10"
            >
              Área do Cliente
            </Link>

            {/* FALAR CONOSCO MOBILE */}
            <Link
              to="/contato"
              onClick={() => setMenuOpen(false)}
              className="rounded-full bg-purple px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
            >
              Falar conosco
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}