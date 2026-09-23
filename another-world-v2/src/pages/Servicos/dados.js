/*
  Dados da página Serviços.
  Separar os dados do visual deixa o código mais fácil de manter:
  para adicionar um projeto novo, basta acrescentar um objeto no array "projects".
  (No futuro, esses dados podem vir do backend em Node.js.)
*/

import anotherWorldPdf from "./projetos/another-world-redes.pdf";
import anotherWorldCapa from "./projetos/another-world-capa.jpg";
import samtechCapa from "./projetos/samtech-capa.jpg";

// "slug" é o nome usado no endereço: /servicos?area=redes
export const services = [
  {
    number: "01",
    slug: "hardware",
    title: "Hardware",
    description:
      "Montagem, manutenção e suporte para computadores, notebooks e outros equipamentos de tecnologia.",
  },
  {
    number: "02",
    slug: "redes",
    title: "Redes",
    description:
      "Configuração e manutenção de redes para conectar equipes, equipamentos e sistemas com mais estabilidade.",
  },
  {
    number: "03",
    slug: "desenvolvimento-web",
    title: "Desenvolvimento web",
    description:
      "Criação de sites e aplicações web responsivas, modernas e alinhadas aos objetivos de cada projeto.",
  },
];

// Cada projeto informa a qual serviço pertence pelo campo "area" (igual ao slug).
export const projects = [
  {
    area: "redes",
    title: "Another World",
    client: "Proposta para a PlayStation do Brasil",
    image: anotherWorldCapa,
    description:
      "Projeto de infraestrutura de rede corporativa: planejamento do layout, cabeamento estruturado, rack, servidores e contrato de suporte e manutenção.",
    highlights: [
      "1.230 m de cabeamento CAT6 em 2 andares",
      "Rack 20U, switch Cisco 24 portas e patch panel",
      "2 servidores Dell PowerEdge com RAID",
      "Active Directory, DNS, DHCP, File Server e firewall",
      "Contrato de 60 meses com atendimento em até 4 horas",
    ],
    links: [
      { label: "Abrir apresentação (PDF)", href: anotherWorldPdf },
    ],
  },
  {
    area: "desenvolvimento-web",
    title: "Samtech Solutions",
    client: "Site institucional",
    image: samtechCapa,
    description:
      "Site para apresentar a Samtech Solutions, suas soluções, serviços, verticais de atuação e projetos, com layout responsivo e cards interativos.",
    highlights: [
      "HTML5, CSS3 e JavaScript",
      "Páginas: Home, Soluções, Serviços, Verticais, Projetos, Sobre e Contato",
      "Layout responsivo com menu para celular",
      "Publicado na Vercel e versionado no GitHub",
    ],
    links: [
      { label: "Ver site publicado", href: "https://samtechsolutions.vercel.app" },
      {
        label: "Ver código no GitHub",
        href: "https://github.com/gabrielvarela707-hub/samtechsolutions",
      },
    ],
  },
];
