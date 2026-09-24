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
    role: "Desenvolvedora Front-end",
    image: clariceImage,
  },
  {
    name: "Leandro Helias",
    role: "Desenvolvedor Back-end",
    image: leandroImage,
  },
  {
    name: "Gabriel Barbosa",
    role: "Desenvolvedor Back-end",
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

/*
  Classes repetidas guardadas em constantes.
  Os valores (cores, tamanhos, espaçamentos) são os mesmos da Home,
  assim as páginas parecem parte do mesmo site.
*/
const container = "mx-auto w-full max-w-[1224px] px-5 md:px-8";
const eyebrow = "mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c9a4ed]";
const sectionTitle = "text-[length:clamp(30px,3.6vw,46px)] font-medium leading-[1.18] tracking-[-0.04em] text-balance";
const card = "rounded-[14px] border border-[#303138] bg-[#18191e]";

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

// Seta usada no botão (mesmo SVG da Home).
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

export default function QuemSomos() {
  return (
    <div className="relative isolate overflow-hidden bg-[#101114] font-sans text-[#f5f4f7]">
      {/* Camadas do fundo espacial */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-55" style={starsBackground} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" style={nebulaBackground} />

      {/* TOPO: título centralizado, como o hero da Home */}
      <section className="pt-16 text-center md:pt-26" aria-labelledby="quem-somos-title">
        <div className={container}>
          <p className="inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#45404e] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d9cce7]">
            Another World
            <span className="text-[#c9a4ed]" aria-hidden="true">/</span>
            Quem somos
          </p>

          <h1
            id="quem-somos-title"
            className="mx-auto mt-7 max-w-235 text-[clamp(38px,5.5vw,72px)] font-semibold leading-[1.08] tracking-[-0.055em] text-balance"
          >
            Construindo soluções
            <span className="mt-2 block text-[#c9a4ed]">através da tecnologia.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-162.5 text-base leading-[1.8] text-[#b2b0bc] md:text-lg">
            Conheça a história, os princípios e as pessoas que fazem a
            Another World acontecer.
          </p>
        </div>
      </section>

      {/* NOSSA HISTÓRIA: texto à esquerda, imagem à direita */}
      <section className="py-14 md:py-22" aria-labelledby="historia-title">
        <div className={`${container} grid gap-6 lg:grid-cols-2 lg:items-stretch`}>
          <article className={`${card} p-7 sm:p-9`}>
            <p className={eyebrow}>Nossa história</p>

            <h2 id="historia-title" className="text-[clamp(26px,2.6vw,34px)] font-medium leading-tight tracking-[-0.03em] text-balance">
              Uma empresa criada para aproximar pessoas e tecnologia.
            </h2>

            <div className="mt-6 space-y-5 text-[15px] leading-[1.8] text-[#b2b0bc]">
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

          {/* Imagem decorativa feita só com Tailwind: uma "rede" conectada */}
          <div className={`${card} min-h-80 p-4`} aria-hidden="true">
            <div className="relative h-full min-h-72 overflow-hidden rounded-[10px] bg-[#101114]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgb(139_69_214/28%),transparent_40%),radial-gradient(circle_at_75%_70%,rgb(77_83_160/22%),transparent_40%)]" />
              <div className="absolute left-[12%] top-[18%] h-px w-[76%] rotate-18 bg-[#303138]" />
              <div className="absolute left-[12%] top-[52%] h-px w-[76%] -rotate-12 bg-[#303138]" />
              <div className="absolute left-[28%] top-[10%] h-[80%] w-px rotate-24 bg-[#303138]" />
              <div className="absolute right-[28%] top-[10%] h-[80%] w-px -rotate-24 bg-[#303138]" />
              <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c9a4ed]/40 bg-purple/10 shadow-[0_0_70px_rgb(139_69_214/25%)]" />
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9a4ed]" />
            </div>
          </div>
        </div>
      </section>

      {/* MISSÃO, VISÃO E VALORES: imagem à esquerda, texto à direita */}
      <section className="pb-14 md:pb-22" aria-labelledby="identidade-title">
        <div className={`${container} grid gap-6 lg:grid-cols-2`}>
          {/* order-2 no celular: o texto aparece antes da imagem */}
          <div className={`${card} order-2 min-h-80 p-4 lg:order-1`} aria-hidden="true">
            <div className="flex h-full min-h-72 items-center justify-center overflow-hidden rounded-[10px] bg-[#101114]">
              <div className="grid w-full max-w-sm grid-cols-3 gap-3 p-8 opacity-90">
                <div className="h-24 rounded border border-[#303138] bg-[#18191e]" />
                <div className="mt-6 h-24 rounded border border-[#c9a4ed]/40 bg-purple/10" />
                <div className="h-24 rounded border border-[#303138] bg-[#18191e]" />
                <div className="col-span-3 h-2 rounded-full bg-[#303138]" />
                <div className="h-16 rounded border border-[#303138] bg-[#18191e]" />
                <div className="h-16 rounded border border-[#303138] bg-[#18191e]" />
                <div className="h-16 rounded border border-[#c9a4ed]/40 bg-purple/10" />
              </div>
            </div>
          </div>

          <div className={`${card} order-1 p-7 sm:p-9 lg:order-2`}>
            <p id="identidade-title" className={eyebrow}>Nossa identidade</p>

            <div className="mt-2">
              {principles.map((item) => (
                <article
                  key={item.number}
                  className="border-t border-[#303138] py-6 first:border-t-0 first:pt-2 last:pb-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-[13px] tabular-nums text-[#c9a4ed]">
                      {item.number}
                    </span>
                    <h2 className="text-xl font-medium tracking-[-0.02em]">
                      {item.title}
                    </h2>
                  </div>
                  <p className="mt-3 text-[15px] leading-[1.8] text-[#b2b0bc]">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* EQUIPE: mesma estrutura de fotos, só com as cores da Home */}
      <section className="border-y border-[#303138] py-14 md:py-22" aria-labelledby="equipe-title">
        <div className={container}>
          <div className="mx-auto mb-10 max-w-172.5 text-center">
            <p className={eyebrow}>Nossa equipe</p>
            <h2 id="equipe-title" className={sectionTitle}>
              As pessoas por trás da Another World.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <article
                key={member.name}
                className={`${card} overflow-hidden transition-colors hover:border-[#c9a4ed]/60`}
              >
                <div className="aspect-4/5 overflow-hidden bg-[#101114]">
                  <img
                    src={member.image}
                    alt={`Foto de ${member.name}`}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-medium tracking-[-0.02em]">{member.name}</h3>
                  <p className="mt-2 text-sm text-[#c9a4ed]">{member.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRÓXIMO PASSO: painel no mesmo estilo da seção de contato da Home */}
      <section className="py-14 md:py-22" aria-labelledby="proximo-passo-title">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-[#49404f] bg-[#211c27] px-6 py-8 md:flex-row md:items-center md:p-13.5">
            <div>
              <p className={eyebrow}>Próximo passo</p>
              <h2 id="proximo-passo-title" className={sectionTitle}>
                Quer conhecer nossas soluções?
              </h2>
            </div>

            {/*
              Button é o componente do projeto. As classes com "!" no final
              têm prioridade e deixam o botão com o visual da Home
              (cantos menos arredondados, texto normal e seta).
            */}
            <Button
              as={Link}
              to="/servicos"
              variant="solid"
              className="shrink-0 gap-3.5 min-h-12.5 rounded-lg! px-5.5! py-3.5! text-sm! normal-case! tracking-normal! hover:bg-[#7735bd] hover:opacity-100!"
            >
              Conhecer serviços
              <Arrow />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
