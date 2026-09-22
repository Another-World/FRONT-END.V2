import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

import mateusImage from "./Membros_AW/Mateus Isaque.jpg";
import clariceImage from "./Membros_AW/Clarice Brasileiro.jpg";
import leandroImage from "./Membros_AW/Leandro Helias.jpg";
import gabrielImage from "./Membros_AW/Gabriel Barbosa.jpg";

const team = [
  {
    name: "Mateus Isaque",
    role: "CEO",
    image: mateusImage,
  },
  {
    name: "Clarice Brasileiro",
    role: "Diretoria",
    image: clariceImage,
  },
  {
    name: "Leandro Helias",
    role: "Desenvolvedor Back-end",
    image: leandroImage,
  },
  {
    name: "Gabriel Barbosa",
    role: "Desenvolvedor Front-end",
    image: gabrielImage,
  },
];

const principles = [
  {
    number: "01",
    title: "Missão",
    description:
      "Desenvolver soluções de tecnologia que atendam às necessidades reais de pessoas e empresas, unindo conhecimento técnico, praticidade e proximidade.",
  },
  {
    number: "02",
    title: "Visão",
    description:
      "Ser uma empresa reconhecida pela capacidade de transformar desafios em soluções tecnológicas eficientes, modernas e preparadas para o futuro.",
  },
  {
    number: "03",
    title: "Valores",
    description:
      "Inovação, confiabilidade, colaboração e proximidade orientam nossa forma de trabalhar e de construir soluções.",
  },
];

export default function QuemSomos() {
  return (
    <div className="overflow-hidden bg-bg-dark text-white">
      <section className="relative border-b border-border bg-bg-section">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
            Another World · Quem somos
          </p>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Construindo soluções através da tecnologia.
            </h1>

          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <article className="rounded-lg border border-border bg-bg-card p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Nossa história
            </p>

            <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
              Uma empresa criada para aproximar pessoas e tecnologia.
            </h2>

            <div className="mt-6 space-y-5 text-sm leading-7 text-text-muted">
              <p>
                A Another World surgiu da união de pessoas interessadas em
                tecnologia e na criação de soluções capazes de resolver
                problemas reais.
              </p>

              <p>
                Desde o início, buscamos compreender cada necessidade antes de
                propor uma solução, unindo conhecimento técnico, criatividade e
                organização para desenvolver projetos que façam sentido para
                cada realidade.
              </p>

              <p>
                Hoje, reunimos diferentes áreas da tecnologia com o objetivo de
                evoluir continuamente e acompanhar as novas possibilidades do
                mercado.
              </p>
            </div>
          </article>

          <div className="min-h-[320px] rounded-lg border border-border bg-bg-card p-4">
            <div className="flex h-full min-h-[288px] items-center justify-center overflow-hidden rounded-md bg-bg-dark">
              <div className="relative h-full w-full overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(139,92,246,0.28),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(59,130,246,0.2),transparent_35%)]" />
                <div className="absolute left-[12%] top-[18%] h-px w-[76%] rotate-[18deg] bg-border" />
                <div className="absolute left-[12%] top-[52%] h-px w-[76%] -rotate-[12deg] bg-border" />
                <div className="absolute left-[28%] top-[10%] h-[80%] w-px rotate-[24deg] bg-border" />
                <div className="absolute right-[28%] top-[10%] h-[80%] w-px -rotate-[24deg] bg-border" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple/50 bg-purple/10 shadow-[0_0_70px_rgba(139,92,246,0.25)]" />
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 lg:pb-20">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-h-[320px] rounded-lg border border-border bg-bg-card p-4">
            <div className="flex h-full min-h-[288px] items-center justify-center overflow-hidden rounded-md bg-bg-dark">
              <div className="grid w-full max-w-sm grid-cols-3 gap-3 p-8 opacity-80">
                <div className="h-24 rounded border border-border bg-bg-section" />
                <div className="mt-6 h-24 rounded border border-purple/40 bg-purple/10" />
                <div className="h-24 rounded border border-border bg-bg-section" />
                <div className="col-span-3 h-2 rounded-full bg-border" />
                <div className="h-16 rounded border border-border bg-bg-section" />
                <div className="h-16 rounded border border-border bg-bg-section" />
                <div className="h-16 rounded border border-purple/40 bg-purple/10" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-card p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Nossa identidade
            </p>

            <div className="mt-6 space-y-7">
              {principles.map((item) => (
                <article key={item.number}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-purple">
                      {item.number}
                    </span>
                    <h2 className="text-xl font-semibold">{item.title}</h2>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-text-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-bg-section">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Nossa equipe
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              As pessoas por trás da Another World.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <article
                key={member.name}
                className="overflow-hidden rounded-2xl border border-border bg-bg-card transition hover:-translate-y-1 hover:border-purple"
              >
                <div className="aspect-[4/5] overflow-hidden bg-bg-dark">
                  <img
                    src={member.image}
                    alt={`Foto de ${member.name}`}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-semibold">{member.name}</h3>
                  <p className="mt-2 text-sm text-purple">{member.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-bg-section">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Próximo passo
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Quer conhecer nossas soluções?
            </h2>
          </div>

          <Button as={Link} to="/servicos" variant="white">
            Conhecer serviços
          </Button>
        </div>
      </section>
    </div>
  );
}
