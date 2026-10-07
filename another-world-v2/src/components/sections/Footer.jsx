import { Link } from "react-router-dom";

import logo from "../../assets/logo.png";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-footer">
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

              <span
                className="
                  text-[17px]
                  font-bold
                  tracking-[0.08em]
                  text-text-main
                "
              >
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
            <h3 className="mb-5 text-sm font-semibold text-text-main">
              Navegação
            </h3>

            <nav className="flex flex-col gap-3">

              <Link
                to="/"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Home
              </Link>

              <Link
                to="/quem-somos"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Quem Somos
              </Link>

              <Link
                to="/servicos"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Serviços
              </Link>

              <Link
                to="/contato"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Contato
              </Link>

            </nav>
          </div>

          {/* Serviços */}
          <div>
            <h3 className="mb-5 text-sm font-semibold text-text-main">
              Serviços
            </h3>

            <nav className="flex flex-col gap-3">

              <Link
                to="/servicos"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Hardware
              </Link>

              <Link
                to="/servicos"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Redes
              </Link>

              <Link
                to="/servicos"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Desenvolvimento Web
              </Link>

              <Link
                to="/contato"
                className="
                  text-sm
                  text-text-muted
                  transition-colors
                  hover:text-purple
                "
              >
                Manutenção
              </Link>

            </nav>
          </div>

          {/* Contato */}
          <div>
            <h3 className="mb-5 text-sm font-semibold text-text-main">
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
                className="
                  mt-3
                  w-fit
                  rounded-full
                  bg-purple
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  transition-opacity
                  hover:opacity-90
                "
              >
                Falar conosco
              </Link>

            </div>
          </div>

        </div>

        {/* Rodapé inferior */}
        <div
          className="
            flex
            flex-col
            gap-4
            border-t
            border-border
            py-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <p className="text-xs text-text-muted">
            © 2026 Another World. Todos os direitos reservados.
          </p>

          <div className="flex flex-wrap items-center gap-5">

            <Link
              to="/politica-de-privacidade"
              className="
                text-xs
                text-text-muted
                transition-colors
                hover:text-purple
              "
            >
              Política de Privacidade
            </Link>

            <Link
              to="/termos-de-uso"
              className="
                text-xs
                text-text-muted
                transition-colors
                hover:text-purple
              "
            >
              Termos de Uso
            </Link>

            <Link
              to="/area-cliente"
              className="
                text-xs
                text-text-muted
                transition-colors
                hover:text-purple
              "
            >
              Área do Cliente
            </Link>

          </div>

        </div>

      </div>
    </footer>
  );
}