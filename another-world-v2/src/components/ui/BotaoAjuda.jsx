import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import faq from "../../data/faq";

function Chevron({ aberto }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform ${
        aberto ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="m5 7.5 5 5 5-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BotaoAjuda() {
  const [aberto, setAberto] = useState(false);
  const [perguntaAberta, setPerguntaAberta] = useState(null);
  const [footerVisivel, setFooterVisivel] = useState(false);

  const painelRef = useRef(null);
  const location = useLocation();

  // Fecha o painel quando muda de página
  useEffect(() => {
    setAberto(false);
    setPerguntaAberta(null);
  }, [location.pathname]);

  // ESC + clique fora
  useEffect(() => {
    if (!aberto) return;

    function handleEsc(event) {
      if (event.key === "Escape") {
        setAberto(false);
      }
    }

    function handleClickFora(event) {
      if (
        painelRef.current &&
        !painelRef.current.contains(event.target)
      ) {
        setAberto(false);
      }
    }

    document.addEventListener("keydown", handleEsc);
    document.addEventListener("mousedown", handleClickFora);

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, [aberto]);

  // Evita que o botão fique sobre o rodapé
  useEffect(() => {
    const footer = document.querySelector("footer");

    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setFooterVisivel(entry.isIntersecting);
      },
      {
        threshold: 0.05,
      }
    );

    observer.observe(footer);

    return () => observer.disconnect();
  }, [location.pathname]);

  if (footerVisivel) return null;

  return (
    <div
      ref={painelRef}
      className="fixed bottom-5 right-5 z-[60] md:bottom-6 md:right-6"
    >
      {/* PAINEL FAQ */}
      {aberto && (
        <section
          role="dialog"
          aria-label="Central de ajuda"
          className="mb-3 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-bg-section shadow-2xl shadow-black/40"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt=""
                className="h-9 w-9 rounded-full object-contain"
              />

              <div>
                <p className="text-sm font-semibold text-white">
                  Central de ajuda
                </p>

                <p className="text-xs text-text-muted">
                  Encontre uma resposta rápida
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar central de ajuda"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-card-inner hover:text-white"
            >
              <span
                aria-hidden="true"
                className="text-xl leading-none"
              >
                ×
              </span>
            </button>
          </div>

          {/* PERGUNTAS */}
          <div className="max-h-[min(60vh,480px)] overflow-y-auto px-4 py-3">
            <div className="space-y-2">
              {faq.map((item, index) => {
                const abertoItem = perguntaAberta === index;

                return (
                  <div
                    key={item.pergunta}
                    className="overflow-hidden rounded-xl border border-border bg-bg-card"
                  >
                    <button
                      type="button"
                      aria-expanded={abertoItem}
                      onClick={() =>
                        setPerguntaAberta(
                          abertoItem ? null : index
                        )
                      }
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-white transition hover:bg-bg-card-inner"
                    >
                      <span>{item.pergunta}</span>

                      <Chevron aberto={abertoItem} />
                    </button>

                    {abertoItem && (
                      <div className="border-t border-border px-4 pb-4 pt-3 text-sm leading-6 text-text-muted">
                        {item.resposta}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="border-t border-border bg-bg-card-inner p-4">
            <p className="mb-3 text-xs text-text-muted">
              Não encontrou o que precisava?
            </p>

            <Link
              to="/chamado"
              className="flex w-full items-center justify-center rounded-full bg-purple px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Abra um chamado
            </Link>
          </div>
        </section>
      )}

      {/* BOTÃO FLUTUANTE */}
      <button
        type="button"
        aria-expanded={aberto}
        aria-label={
          aberto
            ? "Fechar ajuda"
            : "Abrir central de ajuda"
        }
        onClick={() => setAberto((value) => !value)}
        className="group flex items-center gap-3 rounded-full border border-purple/40 bg-bg-section px-4 py-3 text-left text-white shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-purple hover:bg-bg-card"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple/15 ring-1 ring-purple/30">
          <img
            src={logo}
            alt=""
            className="h-9 w-9 object-contain"
          />
        </span>

        {/* Texto aparece somente no desktop */}
        <span className="hidden max-w-[190px] text-sm font-semibold leading-5 sm:block">
          Precisa de ajuda? Vamos conversar
        </span>

        <span
          aria-hidden="true"
          className="hidden text-lg text-purple sm:block"
        >
          ›
        </span>
      </button>
    </div>
  );
}