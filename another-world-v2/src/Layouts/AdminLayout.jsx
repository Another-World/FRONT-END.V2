import { useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { label: "Dashboard", path: "/admin", icon: "▦" },
  {
    label: "Solicitações",
    path: "/admin/solicitacoes",
    icon: "▤",
  },
  {
    label: "Orçamentos",
    path: "/admin/orcamentos",
    icon: "◈",
  },
  {
    label: "Usuários",
    path: "/admin/usuarios",
    icon: "♙",
  },
  {
    label: "Avaliações",
    path: "/admin/avaliacoes",
    icon: "☆",
  },
];

export default function AdminLayout() {
  const [menuAberto, setMenuAberto] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#160b20] text-white">
      {/* Cabeçalho para celular */}
      <header className="flex items-center justify-between border-b border-[#43265b] p-4 lg:hidden">
        <span className="font-bold tracking-widest">
          ANOTHER WORLD
        </span>

        <button
          type="button"
          onClick={() => setMenuAberto(!menuAberto)}
          className="rounded-lg border border-[#43265b] px-4 py-2"
          aria-label="Abrir ou fechar menu"
          aria-expanded={menuAberto}
        >
          {menuAberto ? "Fechar" : "Menu"}
        </button>
      </header>

      <div className="flex min-h-screen">
        {/* Menu lateral */}
        <aside
          className={`${
            menuAberto ? "block" : "hidden"
          } w-64 shrink-0 border-r border-[#43265b] bg-[#100817] p-5 lg:flex lg:flex-col`}
        >
          <div className="mb-10 hidden lg:block">
            <h1 className="text-xl font-bold tracking-widest">
              ANOTHER WORLD
            </h1>
            <p className="mt-2 text-sm text-[#cda5f2]">
              Painel administrativo
            </p>
          </div>

          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === "/admin"}
                onClick={() => setMenuAberto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                    isActive
                      ? "bg-[#7843ab] text-white"
                      : "text-[#c9bfd2] hover:bg-[#281d3b] hover:text-white"
                  }`
                }
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 border-t border-[#43265b] pt-5">
            <NavLink
              to="/"
              className="rounded-lg px-3 py-2 text-sm text-[#cda5f2] hover:bg-[#281d3b]"
            >
              ← Voltar ao site
            </NavLink>

            <div className="px-3">
              <p className="truncate text-sm font-medium">
                {user?.name || "Administrador"}
              </p>
              <p className="text-xs text-[#b9a9c7]">
                Administrador
              </p>
            </div>

            <button
              type="button"
              onClick={sair}
              className="rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-950/40"
            >
              ↪ Sair da conta
            </button>
          </div>
        </aside>

        {/* Conteúdo das páginas */}
        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}