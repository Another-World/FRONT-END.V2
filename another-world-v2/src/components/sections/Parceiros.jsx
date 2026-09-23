import parceiros from "../../data/parceiros";
import styles from "./Parceiros.module.css";

// Cada tipo recebe textos próprios.
// Assim, clientes e patrocinadores não são apresentados como a mesma coisa.
const contentByType = {
  cliente: {
    eyebrow: "Empresas atendidas",
    title: "Tecnologia aplicada a necessidades reais.",
    description:
      "Empresas que confiaram na Another World para apoiar suas operações, infraestrutura ou presença digital.",
  },

  patrocinador: {
    eyebrow: "Patrocinadores",
    title: "Quem apoia a nossa jornada.",
    description:
      "Empresas e instituições que acreditam no projeto e contribuem para o desenvolvimento da Another World.",
  },
};

export default function Parceiros({ tipo }) {
  // Mantém somente os itens do tipo solicitado.
  const listaFiltrada = parceiros.filter(
    (parceiro) => parceiro.tipo === tipo,
  );

  // Caso o tipo não exista ou a lista esteja vazia,
  // o componente não renderiza título nem espaço em branco.
  if (!contentByType[tipo] || listaFiltrada.length === 0) {
    return null;
  }

  const content = contentByType[tipo];

  return (
    <section
      className={`${styles.section} ${
        tipo === "patrocinador" ? styles.sponsorsSection : ""
      }`}
      aria-labelledby={`parceiros-${tipo}-title`}
    >
      <div className={styles.container}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{content.eyebrow}</p>

            <h2 id={`parceiros-${tipo}-title`}>{content.title}</h2>
          </div>

          <p className={styles.description}>{content.description}</p>
        </div>

        <div className={styles.grid}>
          {listaFiltrada.map((parceiro) => {
            // Se existir um logo, renderizamos uma imagem.
            // O alt usa exatamente o nome da empresa.
            const logoContent = parceiro.logo ? (
              <img
                src={parceiro.logo}
                alt={parceiro.nome}
                loading="lazy"
                decoding="async"
              />
            ) : (
              // Enquanto o logo não existir, mostramos um placeholder.
              <span className={styles.placeholder}>
                <span className={styles.placeholderLabel}>
                  Logo em breve
                </span>

                <strong>{parceiro.nome}</strong>
              </span>
            );

            // Um site externo deve usar <a>, não <Link>.
            if (parceiro.site) {
              return (
                <a
                  key={`${parceiro.tipo}-${parceiro.nome}`}
                  href={parceiro.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.logoCard} ${styles.logoLink}`}
                  aria-label={`Visitar o site de ${parceiro.nome}`}
                >
                  {logoContent}
                </a>
              );
            }

            // Se não houver site, o logo não vira botão nem link.
            return (
              <div
                key={`${parceiro.tipo}-${parceiro.nome}`}
                className={styles.logoCard}
              >
                {logoContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}