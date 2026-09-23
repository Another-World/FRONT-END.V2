/*
  Peças visuais usadas nas duas telas de Serviços
  (lista de serviços e projetos de um serviço).
  Os valores são os mesmos da Home, para o site ficar consistente.
*/

export const container = "mx-auto w-full max-w-[1224px] px-5 md:px-8";
export const eyebrow = "mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c9a4ed]";
export const sectionTitle = "text-[length:clamp(30px,3.6vw,46px)] font-medium leading-[1.18] tracking-[-0.04em] text-balance";
export const badge = "inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#45404e] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d9cce7]";
export const heroTitle = "mx-auto mt-7 max-w-[940px] text-[length:clamp(38px,5.5vw,72px)] font-semibold leading-[1.08] tracking-[-0.055em] text-balance";

// Classes que deixam o Button do projeto com o visual dos botões da Home.
// O "!" no final dá prioridade à classe sobre as classes padrão do Button.
export const buttonHome = "shrink-0 gap-3.5 min-h-[50px] rounded-lg! px-[22px]! py-3.5! text-sm! normal-case! tracking-normal! hover:bg-[#7735bd] hover:opacity-100!";

// Seta usada nos botões e links (mesmo SVG da Home).
export function Arrow({ className = "" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
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

export function SpaceBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-55" style={starsBackground} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" style={nebulaBackground} />
    </>
  );
}
