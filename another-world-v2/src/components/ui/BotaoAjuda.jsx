import { useEffect, useRef, useState } from "react";

import { useLocation } from "react-router-dom";

import logo from "../../assets/logo.png";

import faq from "../../data/faq";

export default function BotaoAjuda() {
  const [aberto, setAberto] = useState(false);

  const [faqAberto, setFaqAberto] = useState(null);

  const location = useLocation();

  const painelRef = useRef(null);

  const botaoRef = useRef(null);

  useEffect(() => {
    function handleClickFora(event) {
      if (
        painelRef.current &&
        !painelRef.current.contains(event.target) &&
        botaoRef.current &&
        !botaoRef.current.contains(event.target)
      ) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", handleClickFora);

    return () => {
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, []);

  useEffect(() => {
    setAberto(false);
    setFaqAberto(null);
  }, [location.pathname]);

  function alternarFaq(index) {
    setFaqAberto((atual) =>
      atual === index ? null : index,
    );
  }

  return (
    <>
      {/* =====================================================
          PAINEL DE AJUDA
          ===================================================== */}

      {aberto && (
        <div
          ref={painelRef}
          className="
            fixed
            bottom-24
            right-6
            z-[9998]
            w-[380px]
            max-w-[calc(100vw-32px)]
            overflow-hidden
            rounded-2xl
            border
            border-purple/30
            bg-bg-section
            shadow-2xl
            shadow-black/30
            transition-all
            duration-300
          "
        >
          {/* CABEÇALHO */}

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-border
              px-5
              py-4
            "
          >
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Another World"
                className="
                  h-10
                  w-10
                  object-contain
                  drop-shadow-[0_0_8px_rgba(133,84,179,0.25)]
                "
              />

              <div>
                <p className="text-sm font-semibold text-text-main">
                  Central de ajuda
                </p>

                <p className="text-xs text-text-muted">
                  Encontre uma resposta rápida
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setFaqAberto(null);
              }}
              aria-label="Fechar central de ajuda"
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-full
                text-text-muted
                transition
                hover:bg-bg-card-inner
                hover:text-text-main
              "
            >
              ×
            </button>
          </div>

          {/* PERGUNTAS */}

          <div className="max-h-[460px] overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              {faq.map((item, index) => {
                const estaAberto = faqAberto === index;

                return (
                  <div
                    key={index}
                    className="
                      overflow-hidden
                      rounded-xl
                      border
                      border-border
                      bg-bg-card
                      transition-colors
                      duration-300
                    "
                  >
                    <button
                      type="button"
                      onClick={() => alternarFaq(index)}
                      className="
                        flex
                        w-full
                        items-center
                        justify-between
                        gap-4
                        px-4
                        py-3.5
                        text-left
                        text-sm
                        font-medium
                        text-text-main
                        transition
                        hover:bg-bg-card-inner
                      "
                    >
                      <span>{item.pergunta}</span>

                      <span
                        className={`
                          shrink-0
                          text-sm
                          text-text-muted
                          transition-transform
                          duration-200
                          ${estaAberto ? "rotate-180" : ""}
                        `}
                      >
                        ↓
                      </span>
                    </button>

                    {estaAberto && (
                      <div
                        className="
                          border-t
                          border-border
                          px-4
                          py-3.5
                          text-sm
                          leading-6
                          text-text-muted
                        "
                      >
                        {item.resposta}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          BOTÃO FLUTUANTE
          ===================================================== */}

      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-label={
          aberto
            ? "Fechar central de ajuda"
            : "Abrir central de ajuda"
        }
        className="
          helpButton
          fixed
          bottom-6
          right-6
          z-[9999]
          group
          flex
          items-center
          gap-3
          rounded-full
          border
          border-[#8554b3]/40
          bg-[#7843ab]
          px-4
          py-3
          text-left
          !text-white
          shadow-xl
          shadow-black/30
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:border-[#8554b3]
          hover:bg-[#8554b3]
        "
      >
        {/* LOGO */}

        <span
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-white/10
            ring-1
            ring-white/20
          "
        >
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 object-contain"
          />
        </span>

        {/* TEXTO DO BOTÃO */}

        <span className="min-w-0">
          <span
            className="
              block
              text-sm
              font-semibold
              !text-white
            "
          >
            Precisa de ajuda?
          </span>

          <span
            className="
              block
              text-sm
              font-semibold
              !text-white
            "
          >
            Vamos conversar
          </span>
        </span>

        {/* SETA */}

        <span
          aria-hidden="true"
          className="
            hidden
            text-lg
            font-semibold
            !text-white
            transition-transform
            group-hover:translate-x-0.5
            sm:block
          "
        >
          ›
        </span>
      </button>
    </>
  );
}