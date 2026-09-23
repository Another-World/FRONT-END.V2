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

/*
  Classes repetidas guardadas em constantes.
  Os valores (cores, tamanhos, espaçamentos) são os mesmos da Home,
  assim as páginas parecem parte do mesmo site.
*/
const container = "mx-auto w-full max-w-[1224px] px-5 md:px-8";
const eyebrow = "mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c9a4ed]";
const sectionTitle = "text-[length:clamp(30px,3.6vw,46px)] font-medium leading-[1.18] tracking-[-0.04em] text-balance";

/*
  Fundo espacial igual ao da Home: estrelas pequenas + nebulosas roxas.
  Fica atrás do conteúdo (-z-10) e não bloqueia cliques (pointer-events-none).
*/
const starsBackground = {
  backgroundImage: `
    radial-gradient(1px 1px at 24px 38px, rgb(255 255 255 / 65%) 95%, transparent),
    radial-gradient(1px 1px at 116px 154px, rgb(219 208 245 / 50%) 95%, transparent),
    radial-gradient(1.5px 1.5px at 78px 92px, rgb(255 255 255 / 70%) 95%, transparent),
    radial-gradient(1px 1px at 192px 67px, rgb(255 255 255 / 35%) 95%, transparent),
    radial-gradient(2px 2px at 245px 218px, rgb(201 164 237 / 60%) 65%, transparent)
  `,
  backgroundSize: "211px 239px, 307px 313px, 433px 397px, 509px 467px, 683px 619px",
};

const nebulaBackground = {
  backgroundImage: `
    radial-gradient(ellipse 65% 580px at 50% 0%, rgb(139 69 214 / 18%), transparent 75%),
    radial-gradient(ellipse 45% 700px at 100% 38%, rgb(77 83 160 / 11%), transparent 75%),
    radial-gradient(ellipse 55% 600px at 0% 85%, rgb(139 69 214 / 10%), transparent 75%)
  `,
};

// Seta usada nos botões e cards (mesmo SVG da Home).
function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Servicos() {
  return (
    <div className="relative isolate overflow-hidden bg-[#101114] font-sans text-[#f5f4f7]">
      {/* Camadas do fundo espacial */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-55" style={starsBackground} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" style={nebulaBackground} />

      {/* TOPO: título centralizado, como o hero da Home */}
      <section className="pt-16 text-center md:pt-26" aria-labelledby="servicos-title">
        <div className={container}>
          <p className="inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#45404e] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d9cce7]">
            Another World
            <span className="text-[#c9a4ed]" aria-hidden="true">/</span>
            Serviços
          </p>

          <h1
            id="servicos-title"
            className="mx-auto mt-7 max-w-235 text-[clamp(38px,5.5vw,72px)] font-semibold leading-[1.08] tracking-[-0.055em] text-balance"
          >
            Soluções de tecnologia
            <span className="mt-2 block text-[#c9a4ed]">para problemas reais.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-162.5 text-base leading-[1.8] text-[#b2b0bc] md:text-lg">
            Unimos conhecimento técnico e atendimento próximo para ajudar
            empresas a construir uma operação mais conectada, segura e
            preparada para evoluir.
          </p>

          {/* Faixa com os nomes dos serviços, igual ao rodapé do hero da Home */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-4 border-y border-[#303138] py-6 text-xs text-[#b2b0bc] md:mt-19">
            {services.map((service) => (
              <span key={service.number}>{service.title}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CARDS DOS SERVIÇOS */}
      <section className="py-14 md:py-22" aria-labelledby="lista-servicos-title">
        <div className={container}>
          <div className="mx-auto mb-10 max-w-172.5 text-center">
            <p className={eyebrow}>O que fazemos</p>
            <h2 id="lista-servicos-title" className={sectionTitle}>
              Três áreas para cuidar da sua tecnologia.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.number}
                className="group flex flex-col rounded-[14px] border border-[#303138] bg-[#18191e] p-7 transition-colors hover:border-[#c9a4ed]/60 lg:p-7.5"
              >
                <div className="mb-9 flex items-center justify-between">
                  <span className="text-[13px] tabular-nums text-[#c9a4ed]">
                    {service.number}
                  </span>
                  <span className="text-[#b2b0bc] transition-colors group-hover:text-[#c9a4ed]" aria-hidden="true">
                    ↗
                  </span>
                </div>

                <h3 className="mb-4 text-[23px] font-medium leading-[1.3] tracking-tight">
                  {service.title}
                </h3>
                <p className="text-[15px] leading-[1.8] text-[#b2b0bc]">
                  {service.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRÓXIMO PASSO: painel no mesmo estilo da seção de contato da Home */}
      <section className="pb-14 md:pb-22" aria-labelledby="proximo-passo-title">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-[#49404f] bg-[#211c27] px-6 py-8 md:flex-row md:items-center md:p-13.5">
            <div>
              <p className={eyebrow}>Próximo passo</p>
              <h2 id="proximo-passo-title" className={sectionTitle}>
                Tem um desafio de tecnologia?
              </h2>
              <p className="mt-5 max-w-132.5 text-base leading-[1.8] text-[#c1bbc9]">
                Conte o que você precisa e vamos entender juntos qual é o
                melhor caminho.
              </p>
            </div>

            {/*
              Button é o componente do projeto. As classes com "!" no final
              têm prioridade e deixam o botão com o visual da Home
              (cantos menos arredondados, texto normal e seta).
            */}
            <Button
              as={Link}
              to="/contato"
              variant="solid"
              className="shrink-0 gap-3.5 min-h-12.5 rounded-lg! px-5.5! py-3.5! text-sm! normal-case! tracking-normal! hover:bg-[#7735bd] hover:opacity-100!"
            >
              Falar conosco
              <Arrow />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
