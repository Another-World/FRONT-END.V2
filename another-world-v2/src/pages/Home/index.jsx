import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const pages = [
  {
    number: "01",
    title: "Quem somos",
    description:
      "Conheça a Another World, nossa visão e como transformamos desafios em soluções tecnológicas.",
    to: "/quem-somos",
  },
  {
    number: "02",
    title: "Serviços",
    description:
      "Infraestrutura, redes, hardware, suporte e desenvolvimento web para empresas que querem evoluir.",
    to: "/servicos",
  },
  {
    number: "03",
    title: "Contato",
    description:
      "Conte o que sua empresa precisa e solicite um orçamento para o seu próximo projeto.",
    to: "/contato",
  },
];

export default function Home() {
  return (
    <div className="overflow-hidden bg-bg-dark text-white">
      <section className="border-b border-border">
        <div className="mx-auto grid min-h-[600px] max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Another World · Soluções em tecnologia
            </p>

            <h1 className="mt-6 text-5xl font-bold tracking-[-0.05em] sm:text-6xl">
              Tecnologia para levar seu negócio além do óbvio.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-text-muted">
              Criamos soluções em infraestrutura, redes, suporte e
              desenvolvimento para empresas mais conectadas e preparadas para
              crescer.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button as={Link} to="/servicos" variant="solid">
                Conhecer serviços
              </Button>

              <Button as={Link} to="/contato" variant="outline">
                Falar conosco
              </Button>
            </div>
          </div>

          <div className="relative mx-auto flex h-72 w-72 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-purple/40" />
            <div className="absolute inset-8 rounded-full border border-border" />
            <div className="absolute inset-16 rounded-full bg-purple shadow-[0_0_70px_rgba(139,69,214,0.5)]" />
            <div className="absolute h-28 w-[120%] -rotate-12 rounded-[100%] border border-purple" />

            <span className="relative text-center text-xs font-semibold uppercase tracking-[0.24em]">
              Another<br />World
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
          Explore a Another World
        </p>

        <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
          Encontre a solução ideal para seu momento.
        </h2>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pages.map((page) => (
            <article
              key={page.to}
              className="rounded-2xl border border-border bg-bg-card p-7 transition hover:-translate-y-1 hover:border-purple"
            >
              <span className="text-sm font-semibold text-purple">
                {page.number}
              </span>

              <h3 className="mt-10 text-2xl font-semibold">{page.title}</h3>

              <p className="mt-4 min-h-24 text-sm leading-6 text-text-muted">
                {page.description}
              </p>

              <Link
                to={page.to}
                className="mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:text-purple"
              >
                Saber mais <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-bg-section">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Próximo passo
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Vamos construir algo novo?
            </h2>
          </div>

          <Button as={Link} to="/contato" variant="white">
            Solicitar orçamento
          </Button>
        </div>
      </section>
    </div>
  );
}