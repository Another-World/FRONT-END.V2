import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import styles from "./Home.module.css";

// Conteúdo dos cartões de serviços.
const services = [
  {
    number: "01",
    title: "Hardware e suporte",
    description:
      "Seu computador precisa acompanhar sua rotina. Conte com ajuda para manutenção, configuração e problemas do dia a dia.",
    items: [
      "Manutenção de computadores",
      "Instalação e configuração",
      "Suporte técnico",
    ],
  },
  {
    number: "02",
    title: "Redes e infraestrutura",
    description:
      "Uma rede bem organizada faz diferença no trabalho. Planejamos a conexão entre pessoas, equipamentos e sistemas.",
    items: [
      "Configuração de redes",
      "Organização da infraestrutura",
      "Conectividade dos equipamentos",
    ],
  },
  {
    number: "03",
    title: "Desenvolvimento web",
    description:
      "Sua presença na internet precisa representar bem o seu negócio e facilitar o caminho de quem quer falar com você.",
    items: [
      "Sites institucionais",
      "Páginas responsivas",
      "Desenvolvimento de interfaces",
    ],
  },
];

const steps = [
  {
    number: "01",
    title: "Você conta o que precisa",
    description:
      "Explique o problema ou a ideia. Não precisa conhecer os termos técnicos.",
  },
  {
    number: "02",
    title: "Entendemos o cenário",
    description:
      "Conversamos sobre sua rotina e os detalhes necessários para avaliar o serviço.",
  },
  {
    number: "03",
    title: "Combinamos os próximos passos",
    description:
      "Escopo, prazo e orçamento são alinhados antes de começar o trabalho.",
  },
];

// SVG decorativo: não exige instalação de uma biblioteca de ícones.
function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
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

// Reaproveita o Button existente, renderizando um Link do React Router.
function ActionLink({ to, children, secondary = false }) {
  return (
    <Button
      as={Link}
      to={to}
      variant="solid"
      className={`${styles.button} ${
        secondary ? styles.buttonSecondary : styles.buttonPrimary
      }`}
    >
      {children}
      <Arrow />
    </Button>
  );
}

// Os três blocos principais possuem seu próprio "Saber mais".
function MoreLink({ to, subject }) {
  return (
    <Link
      to={to}
      className={styles.moreLink}
      aria-label={`Saber mais sobre ${subject}`}
    >
      Saber mais
      <Arrow />
    </Link>
  );
}

export default function Home() {
  return (
    // O layout principal já deve fornecer Header, main e Footer.
    <div className={styles.home}>
      {/* HERO: composição centralizada inspirada na referência. */}
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.container}>
          <p className={styles.badge}>
            ANOTHER WORLD
            <span aria-hidden="true">/</span>
            SOLUÇÕES EM TI
          </p>

          <h1 id="home-title">
            Tecnologia para o seu negócio
            <span>seguir em frente.</span>
          </h1>

          <p className={styles.heroDescription}>
            Computadores, redes e desenvolvimento web. Cuidamos da tecnologia
            que você usa para trabalhar, atender e apresentar sua empresa.
          </p>

          <div className={styles.actions}>
            <ActionLink to="/contato">Conversar sobre meu projeto</ActionLink>

            <ActionLink to="/servicos" secondary>
              Conhecer os serviços
            </ActionLink>
          </div>

          <div className={styles.heroFooter}>
            <span>Hardware e suporte</span>
            <span>Redes e infraestrutura</span>
            <span>Desenvolvimento web</span>
          </div>
        </div>
      </section>

      {/* SERVIÇOS: resumo da página /servicos. */}
      <section className={styles.services} aria-labelledby="services-title">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>O QUE FAZEMOS</p>

            <h2 id="services-title">
              O que está precisando
              <br />
              de atenção por aí?
            </h2>

            <p className={styles.sectionDescription}>
              Do equipamento que começou a falhar ao site que você quer
              colocar no ar. Encontre por onde começar.
            </p>
          </div>

          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article key={service.number} className={styles.serviceCard}>
                <span className={styles.cardNumber} aria-hidden="true">
                  {service.number}
                </span>

                <h3>{service.title}</h3>
                <p>{service.description}</p>

                <ul>
                  {service.items.map((item) => (
                    <li key={item}>
                      <span aria-hidden="true">↗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className={styles.sectionFooter}>
            <p>Conheça os serviços e encontre o que faz sentido para você.</p>
            <MoreLink to="/servicos" subject="nossos serviços" />
          </div>
        </div>
      </section>

      {/* QUEM SOMOS: uma seção clara cria contraste com a abertura. */}
      <section className={styles.about} aria-labelledby="about-title">
        <div className={`${styles.container} ${styles.aboutGrid}`}>
          <div className={styles.aboutIntro}>
            <p className={styles.eyebrow}>QUEM SOMOS</p>

            <h2 id="about-title">
              A tecnologia é o meio.
              <span>Seu trabalho é o ponto de partida.</span>
            </h2>

            <MoreLink to="/quem-somos" subject="a Another World" />
          </div>

          <div className={styles.aboutContent}>
            <p className={styles.aboutLead}>
              A Another World reúne soluções em hardware, redes e
              desenvolvimento web para pessoas e empresas.
            </p>

            <p>
              Antes de falar de ferramentas, queremos entender sua rotina:
              o que está funcionando, o que atrapalha e o que você gostaria
              de fazer melhor.
            </p>

            <div className={styles.principles}>
              <div>
                <h3>Conversa clara</h3>
                <p>
                  Explicar as opções de um jeito que ajude você a decidir.
                </p>
              </div>

              <div>
                <h3>Soluções com propósito</h3>
                <p>
                  Relacionar cada escolha ao que seu negócio realmente precisa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Etapas simples ajudam o visitante a entender o atendimento. */}
      <section className={styles.process} aria-labelledby="process-title">
        <div className={styles.container}>
          <div className={styles.processHeading}>
            <div>
              <p className={styles.eyebrow}>COMO COMEÇAR</p>
              <h2 id="process-title">Tudo começa com uma conversa.</h2>
            </div>

            <p>
              Você não precisa chegar com a solução pronta. Precisamos
              entender o que você quer resolver.
            </p>
          </div>

          <ol className={styles.stepGrid}>
            {steps.map((step) => (
              <li key={step.number} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {step.number}
                </span>

                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CONTATO: resumo da página /contato e acesso ao orçamento. */}
      <section className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactPanel}>
            <div className={styles.contactContent}>
              <p className={styles.eyebrow}>VAMOS CONVERSAR</p>

              <h2 id="contact-title">
                Tem algo para resolver
                <br />
                ou uma ideia para começar?
              </h2>

              <p>
                Na página de contato, você pode explicar o que precisa,
                informar seus dados e solicitar um orçamento.
              </p>

              <div className={styles.contactActions}>
                <ActionLink to="/contato">Solicitar orçamento</ActionLink>
              </div>
            </div>

            {/* Orientação útil, sem simular um atendimento ou conversa. */}
            <aside className={styles.contactAside}>
              <span className={styles.asideLabel}>PODE CONTAR DO SEU JEITO</span>

              <p>
                “Preciso melhorar a rede.”
                <br />
                “Meu computador está lento.”
                <br />
                “Quero um site para minha empresa.”
              </p>

              <span>Esses já são bons pontos de partida.</span>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}