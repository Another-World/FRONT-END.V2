import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const services = [
  
  {
    number: "01",
    title: "Hardware",
    description:
      "Montagem, manutenção e suporte para computadores, notebooks e outros equipamentos de tecnologia.",
  },
  
  {
    number: "02",
    title: "Redes",
    description:
      "Configuração e manutenção de redes para conectar equipes, equipamentos e sistemas com mais estabilidade.",
  },
  
  {
    number: "03",
    title: "Desenvolvimento web",
    description:
      "Criação de sites e aplicações web responsivas, modernas e alinhadas aos objetivos de cada projeto.",
  },
  
];

export default function Servicos() {
  return (
    <div className="overflow-hidden bg-bg-dark text-white">
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple">
              Serviços
          </p>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <h1 className="text-5xl font-bold tracking-[-0.05em] sm:text-6xl">
              Soluções de tecnologia para problemas reais.
            </h1>

            <p className="max-w-xl text-lg leading-8 text-text-muted">
              Unimos conhecimento técnico e atendimento próximo para ajudar
              empresas a construir uma operação mais conectada, segura e
              preparada para evoluir.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-5 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.number}
              className="group rounded-2xl border border-border bg-bg-card p-7 transition hover:-translate-y-1 hover:border-purple"
            >
              <div className="flex items-start justify-between gap-6">
                <span className="text-sm font-semibold text-purple">
                  {service.number}
                </span>
                <span className="text-xl text-text-faint transition group-hover:text-purple" aria-hidden="true">
                  ↗
                </span>
              </div>

              <h2 className="mt-12 text-2xl font-semibold">{service.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-text-muted">
                {service.description}
              </p>
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
              Tem um desafio de tecnologia?
            </h2>
          </div>

          <Button as={Link} to="/contato" variant="white">
            Falar conosco
          </Button>
        </div>
      </section>
    </div>
  );
}
