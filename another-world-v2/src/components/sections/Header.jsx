import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.png"


export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // useRef guarda uma referência ao elemento no DOM. Precisamos dela pra
  // saber se o clique aconteceu DENTRO ou FORA do mini menu.
  const userMenuRef = useRef(null);

  // Fecha o mini menu ao clicar fora dele ou apertar Esc.
  // Sem isso, o menu ficaria aberto pra sempre até clicar no botão de novo.
  useEffect(() => {
    // Se o menu está fechado, não precisa ficar escutando nada.
    if (!userMenuOpen) return;

    function handleClickFora(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }

    function handleEsc(event) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleEsc);

    // Esse return é a "limpeza": o React roda ele quando o menu fecha ou
    // quando o Header sai da tela. Sem remover os listeners, eles iriam se
    // acumulando a cada abertura e continuariam rodando à toa.
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [userMenuOpen]);

  function handleLogout() {
    logout();
    setUserMenuOpen(false);
    setMenuOpen(false);
    navigate("/");
  }

  // Só o primeiro nome, pra saudação não estourar a largura do header.
  // Se a pessoa não tiver nome salvo, cai no e-mail.
  const nomeExibido = user ? user.name?.split(" ")[0] || user.email : "";

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

          {/* Deslogado: convite pra entrar.
              Logado: saudação que abre o mini menu. */}
          {!user ? (
            <Link
              to="/login"
              className="rounded-full border border-purple/50 px-5 py-2.5 text-sm font-medium text-purple transition-all hover:border-purple hover:bg-purple/10"
            >
              Faça seu login
            </Link>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-purple/50 px-5 py-2.5 text-sm font-medium text-purple transition-all hover:border-purple hover:bg-purple/10"
              >
                Seja Bem-Vindo, {nomeExibido}!
                <span
                  className={`text-[10px] transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              {/* MINI MENU */}
              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl"
                >
                  <Link
                    to="/area-cliente"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-5 py-3 text-sm text-text-muted transition hover:bg-bg-card-inner hover:text-white"
                  >
                    Área do Cliente
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full border-t border-border px-5 py-3 text-left text-sm text-text-muted transition hover:bg-bg-card-inner hover:text-white"
                  >
                    Encerrar sessão
                  </button>
                </div>
              )}
            </div>
          )}

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

            {/* No mobile não faz sentido um menu dentro do menu:
                a saudação vira um título e as opções ficam soltas. */}
            {!user ? (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-full border border-purple/50 px-5 py-3 text-center text-sm font-medium text-purple transition hover:bg-purple/10"
              >
                Faça seu login
              </Link>
            ) : (
              <>
                <p className="text-sm font-semibold text-purple">
                  Seja Bem-Vindo, {nomeExibido}!
                </p>

                <Link
                  to="/area-cliente"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-purple/50 px-5 py-3 text-center text-sm font-medium text-purple transition hover:bg-purple/10"
                >
                  Área do Cliente
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-border px-5 py-3 text-center text-sm font-medium text-text-muted transition hover:border-purple hover:text-white"
                >
                  Encerrar sessão
                </button>
              </>
            )}

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
