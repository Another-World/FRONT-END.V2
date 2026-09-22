import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const values = [
  {
    number: "01",
    title: "Inovação",
    description:
      "Buscamos novas formas de aplicar a tecnologia para transformar necessidades em soluções práticas.",
  },
  {
    number: "02",
    title: "Confiabilidade",
    description:
      "Construímos soluções com foco em estabilidade, organização e segurança para o dia a dia.",
  },
  {
    number: "03",
    title: "Proximidade",
    description:
      "Entendemos cada cenário antes de propor uma solução, mantendo uma comunicação clara durante o projeto.",
  },
];

export default function QuemSomos() {
  return (
    <div className="overflow-hidden bg-bg-dark text-white">
      <section className="border-b border-border">
        <div className="mx-auto grid min-h-[560px] max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Quem somos
            </p>

            <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-[-0.05em] sm:text-6xl">
              Tecnologia com propósito, construída para ir além.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-text-muted">
              Somos uma empresa de tecnologia focada em transformar desafios
              do dia a dia em soluções simples, eficientes e preparadas para
              acompanhar a evolução de cada negócio.
            </p>
          </div>

          <div className="relative mx-auto flex h-72 w-72 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-purple/40" />
            <div className="absolute inset-8 rounded-full border border-border" />
            <div className="absolute inset-16 rounded-full bg-purple shadow-[0_0_70px_rgba(139,69,214,0.5)]" />
            <div className="absolute h-28 w-[120%] -rotate-12 rounded-[100%] border border-purple" />
            <span className="relative text-center text-xs font-semibold uppercase tracking-[0.24em]">
              Beyond<br />Technology
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Nossa história
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Uma visão voltada para o futuro da tecnologia.
            </h2>
          </div>

          <div className="space-y-5 text-base leading-8 text-text-muted">
            <p>
              A Another World nasceu com a proposta de aproximar tecnologia
              e necessidades reais, oferecendo soluções que façam sentido
              para pessoas e empresas.
            </p>
            <p>
              Atuamos em diferentes áreas da tecnologia, conectando
              infraestrutura, redes, suporte, hardware e desenvolvimento para
              criar ambientes mais organizados e preparados para crescer.
            </p>
            <p>
              Nosso objetivo é construir relações de longo prazo, combinando
              conhecimento técnico, atendimento próximo e soluções pensadas
              para cada contexto.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-bg-section">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
            O que nos guia
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            Princípios que fazem parte da nossa forma de trabalhar.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {values.map((value) => (
              <article
                key={value.number}
                className="rounded-2xl border border-border bg-bg-card p-7"
              >
                <span className="text-sm font-semibold text-purple">
                  {value.number}
                </span>
                <h3 className="mt-10 text-2xl font-semibold">{value.title}</h3>
                <p className="mt-4 text-sm leading-6 text-text-muted">
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Vamos conversar
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Conheça nossas soluções.
            </h2>
          </div>

          <Button as={Link} to="/servicos" variant="white">
            Ver serviços
          </Button>
        </div>
      </section>
    </div>
  );
}
