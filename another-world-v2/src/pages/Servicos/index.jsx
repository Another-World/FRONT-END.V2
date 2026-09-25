import { useEffect } from "react";
import {
  Link,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import ProjetosServico from "./ProjetosServico";
import { services, projects } from "./dados";

import {
  container,
  eyebrow,
  sectionTitle,
  badge,
  heroTitle,
  Arrow,
  SpaceBackground,
} from "./visual";

export default function Servicos() {
  /*
    useSearchParams lê a parte "?area=..." do endereço.

    /servicos
    → mostra a lista de serviços

    /servicos?area=redes
    → mostra os projetos de Redes
  */

  const location = useLocation();

  const [searchParams] = useSearchParams();
  const area = searchParams.get("area");

  // Procura o serviço escolhido.
  const selectedService = services.find(
    (service) => service.slug === area
  );

  /*
    Controle de rolagem:

    - Se existir uma âncora (#hardware, #redes etc.),
      encontra o bloco correspondente e rola até ele.

    - Se não existir âncora, volta para o topo da página.
  */
  useEffect(() => {
    const hash = location.hash;

    if (hash) {
      requestAnimationFrame(() => {
        const element = document.querySelector(hash);

        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });

      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="relative isolate overflow-hidden bg-[#101114] font-sans text-[#f5f4f7]">
      <SpaceBackground />

      {selectedService ? (
        <ProjetosServico service={selectedService} />
      ) : (
        <ListaServicos />
      )}
    </div>
  );
}


// =====================================================
// LISTA DE SERVIÇOS
// =====================================================

function ListaServicos() {
  return (
    <>
      {/* TOPO */}
      <section
        className="pt-16 text-center md:pt-26"
        aria-labelledby="servicos-title"
      >
        <div className={container}>
          <p className={badge}>
            Another World
            <span
              className="text-[#c9a4ed]"
              aria-hidden="true"
            >
              /
            </span>
            Serviços
          </p>

          <h1
            id="servicos-title"
            className={heroTitle}
          >
            Soluções de tecnologia
            <span className="mt-2 block text-[#c9a4ed]">
              para problemas reais.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-162.5 text-base leading-[1.8] text-[#b2b0bc] md:text-lg">
            Unimos conhecimento técnico e atendimento próximo
            para ajudar empresas a construir uma operação mais
            conectada, segura e preparada para evoluir.
          </p>

          {/* LINKS DOS SERVIÇOS */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-4 border-y border-[#303138] py-6 text-xs text-[#b2b0bc] md:mt-19">
            {services.map((service) => (
              <Link
                key={service.slug}
                to={`/servicos#${service.slug}`}
                className="transition-colors hover:text-[#c9a4ed]"
              >
                {service.title}
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* CARDS DOS SERVIÇOS */}
      <section
        className="py-14 md:py-22"
        aria-labelledby="lista-servicos-title"
      >
        <div className={container}>
          <div className="mx-auto mb-10 max-w-172.5 text-center">
            <p className={eyebrow}>
              O que fazemos
            </p>

            <h2
              id="lista-servicos-title"
              className={sectionTitle}
            >
              Três áreas para cuidar da sua tecnologia.
            </h2>
          </div>


          <div className="grid gap-5 md:grid-cols-3">

            {services.map((service) => {

              // Conta quantos projetos existem
              // para cada serviço.
              const total = projects.filter(
                (project) =>
                  project.area === service.slug
              ).length;


              return (
                /*
                  IMPORTANTE:

                  Este ID é o que faz:

                  #hardware
                  #redes
                  #desenvolvimento-web

                  encontrarem exatamente este bloco.
                */
                <section
                  key={service.slug}
                  id={service.slug}
                  className="scroll-mt-24"
                >

                  <Link
                    to={`/servicos?area=${service.slug}`}
                    className="group flex h-full flex-col rounded-[14px] border border-[#303138] bg-[#18191e] p-7 transition-colors hover:border-[#c9a4ed]/60 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#c9a4ed] lg:p-7.5"
                  >

                    {/* Número e quantidade de projetos */}
                    <div className="mb-9 flex items-center justify-between">

                      <span className="text-[13px] tabular-nums text-[#c9a4ed]">
                        {service.number}
                      </span>

                      <span className="text-xs text-[#b2b0bc]">
                        {total === 1
                          ? "1 projeto"
                          : `${total} projetos`}
                      </span>

                    </div>


                    {/* Título */}
                    <h3 className="mb-4 text-[23px] font-medium leading-[1.3] tracking-tight">
                      {service.title}
                    </h3>


                    {/* Descrição */}
                    <p className="mb-7 text-[15px] leading-[1.8] text-[#b2b0bc]">
                      {service.description}
                    </p>


                    {/* Link interno */}
                    <span className="mt-auto flex items-center gap-3 border-t border-[#303138] pt-5 text-sm font-semibold text-[#c9a4ed]">

                      Ver projetos

                      <Arrow className="transition-transform group-hover:translate-x-1" />

                    </span>

                  </Link>

                </section>
              );
            })}

          </div>
        </div>
      </section>
    </>
  );
}