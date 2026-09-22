import { Link } from "react-router-dom";
import logo from "../../assets/logo.png";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-dark">
      <div className="mx-auto max-w-[1440px] px-6">

        {/* Parte principal */}
        <div className="grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-4">

          {/* Logo */}
          <div className="lg:col-span-1">
            <Link
              to="/"
              className="flex w-fit items-center gap-3"
            >
              <img
                src={logo}
                alt="Logo Another World"
                className="h-30 w-30 object-contain"
              />

              <span className="text-[17px] font-bold tracking-[0.08em] text-white">
                ANOTHER WORLD
              </span>
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-6 text-text-muted">
              Soluções em tecnologia para transformar ideias
              em projetos reais.
            </p>
          </div>

          {/* Navegação */}
          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">
              Navegação
            </h3>

            <nav className="flex flex-col gap-3">
              <Link
                to="/"
                className="text-sm text-text-muted transition-colors hover:text-white"
              >
                Home
              </Link>

              <Link
                to="/quem-somos"
                className="text-sm text-text-muted transition-colors hover:text-white"
              >
                Quem Somos
              </Link>

              <Link
                to="/servicos"
                className="text-sm text-text-muted transition-colors hover:text-white"
              >
                Serviços
              </Link>

              <Link
                to="/projetos"
                className="text-sm text-text-muted transition-colors hover:text-white"
              >
                Projetos
              </Link>

              <Link
                to="/contato"
                className="text-sm text-text-muted transition-colors hover:text-white"
              >
                Contato
              </Link>
            </nav>
          </div>

          {/* Serviços */}
          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">
              Serviços
            </h3>

            <div className="flex flex-col gap-3">
              <span className="text-sm text-text-muted">
                Hardware
              </span>

              <span className="text-sm text-text-muted">
                Redes
              </span>

              <span className="text-sm text-text-muted">
                Desenvolvimento Web
              </span>

              <span className="text-sm text-text-muted">
                Manutenção
              </span>
            </div>
          </div>

          {/* Contato */}
          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">
              Contato
            </h3>

            <div className="flex flex-col gap-3">
              <span className="text-sm text-text-muted">
                São Paulo - SP
              </span>

              <span className="break-all text-sm text-text-muted">
                contato@anotherworld.com
              </span>

              <Link
                to="/contato"
                className="mt-3 w-fit rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Falar conosco
              </Link>
            </div>
          </div>

        </div>

        {/* Rodapé inferior */}
        <div className="flex flex-col gap-4 border-t border-border py-6 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs text-text-muted">
            © 2026 Another World. Todos os direitos reservados.
          </p>

          <Link
            to="/area-cliente"
            className="text-xs text-text-muted transition-colors hover:text-purple"
          >
            Área do Cliente
          </Link>

        </div>

      </div>
    </footer>
  );
}