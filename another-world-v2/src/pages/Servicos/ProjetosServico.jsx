import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { services, projects } from "./dados";
import {
  container,
  eyebrow,
  sectionTitle,
  badge,
  heroTitle,
  buttonHome,
  Arrow,
} from "./visual";

/*
  Tela com os projetos de UM serviço.
  Recebe o serviço escolhido (ex.: Redes) e mostra só os projetos daquela área.
*/
export default function ProjetosServico({ service }) {
  // filter: pega somente os projetos cuja "area" é igual ao slug do serviço.
  const serviceProjects = projects.filter(
    (project) => project.area === service.slug
  );

  return (
    <>
      {/* TOPO */}
      <section className="pt-12 text-center md:pt-20" aria-labelledby="projetos-title">
        <div className={container}>
          <div className="mb-10 text-left">
            <Link
              to="/servicos"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#c9a4ed] hover:underline hover:underline-offset-4"
            >
              <Arrow className="rotate-180" />
              Voltar para serviços
            </Link>
          </div>

          <p className={badge}>
            Serviços
            <span className="text-[#c9a4ed]" aria-hidden="true">/</span>
            {service.title}
          </p>

          <h1 id="projetos-title" className={heroTitle}>
            Projetos de
            <span className="mt-2 block text-[#c9a4ed]">{service.title}</span>
          </h1>

          <p className="mx-auto mt-7 max-w-162.5 text-base leading-[1.8] text-[#b2b0bc] md:text-lg">
            {service.description}
          </p>

          {/* Abas para trocar de serviço sem voltar para a lista */}
          <nav
            className="mt-12 flex flex-wrap justify-center gap-3 border-y border-[#303138] py-6"
            aria-label="Escolher serviço"
          >
            {services.map((item) => {
              const isActive = item.slug === service.slug;

              return (
                <Link
                  key={item.slug}
                  to={`/servicos?area=${item.slug}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                    isActive
                      ? "border-[#c9a4ed] bg-purple/15 text-white"
                      : "border-[#303138] text-[#b2b0bc] hover:border-[#c9a4ed]/60 hover:text-white"
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      {/* LISTA DE PROJETOS */}
      <section className="py-14 md:py-22">
        <div className={container}>
          {serviceProjects.length > 0 ? (
            <div className="grid gap-6">
              {serviceProjects.map((project) => (
                <article
                  key={project.title}
                  className="grid overflow-hidden rounded-[14px] border border-[#303138] bg-[#18191e] lg:grid-cols-[0.9fr_1.1fr]"
                >
                  <div className="aspect-video overflow-hidden bg-[#101114] lg:aspect-auto">
                    <img
                      src={project.image}
                      alt={`Capa do projeto ${project.title}`}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>

                  <div className="flex flex-col p-7 sm:p-9">
                    <p className={eyebrow}>{project.client}</p>

                    <h2 className="text-[clamp(26px,2.6vw,34px)] font-medium leading-tight tracking-[-0.03em]">
                      {project.title}
                    </h2>

                    <p className="mt-4 text-[15px] leading-[1.8] text-[#b2b0bc]">
                      {project.description}
                    </p>

                    <ul className="mt-6 grid gap-3 border-t border-[#303138] pt-6">
                      {project.highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-baseline gap-2.5 text-[13px] leading-[1.6] text-[#dedbe4]"
                        >
                          <span className="text-[#c9a4ed]" aria-hidden="true">↗</span>
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/*
                      Links externos (PDF, site, GitHub) usam <a> com
                      target="_blank" para abrir em uma nova aba do navegador.
                    */}
                    <div className="mt-8 flex flex-wrap gap-3">
                      {project.links.map((link, index) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-h-11.5 items-center gap-3 rounded-lg border px-5 py-3 text-sm font-semibold transition-colors ${
                            index === 0
                              ? "border-transparent bg-purple text-white hover:bg-[#7735bd]"
                              : "border-[#55515f] text-[#f5f4f7] hover:border-[#c9a4ed] hover:bg-[#222027]"
                          }`}
                        >
                          {link.label}
                          <Arrow />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            // Mensagem para serviços que ainda não têm projetos cadastrados.
            <div className="rounded-[14px] border border-dashed border-[#45404e] px-6 py-16 text-center">
              <p className={eyebrow}>Em breve</p>
              <h2 className="text-2xl font-medium tracking-[-0.02em]">
                Ainda não há projetos de {service.title} publicados.
              </h2>
              <p className="mx-auto mt-4 max-w-120 text-[15px] leading-[1.8] text-[#b2b0bc]">
                Enquanto isso, fale com a gente para entender como podemos
                ajudar no seu caso.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* PRÓXIMO PASSO */}
      <section className="pb-14 md:pb-22" aria-labelledby="projetos-contato-title">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-[#49404f] bg-[#211c27] px-6 py-8 md:flex-row md:items-center md:p-13.5">
            <div>
              <p className={eyebrow}>Próximo passo</p>
              <h2 id="projetos-contato-title" className={sectionTitle}>
                Precisa de algo parecido?
              </h2>
            </div>

            <Button as={Link} to="/contato" variant="solid" className={buttonHome}>
              Falar conosco
              <Arrow />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
