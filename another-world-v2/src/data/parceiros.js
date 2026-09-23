// Quando os logos oficiais forem enviados, importe-os desta forma:
//
// import empresaExemplo from "../assets/logos/empresa-exemplo.svg";
//
// Depois substitua:
// logo: null
//
// por:
// logo: empresaExemplo
import samtechsolutions from "../assets/logos/logo-samtech.png";
import valve from "../assets/logos/logo-valve.png";
import vivo from "../assets/logos/logo-vivo.png";
import playstation from "../assets/logos/logo-playstation.png";
import dell from "../assets/logos/logo-dell.png";
import cisco from "../assets/logos/logo-cisco.png";
import intel from "../assets/logos/logo-intel.png"; 

const parceiros = [
  // Empresas que já receberam serviços da Another World.
  {
    nome: "Samtech Solutions",
    logo: samtechsolutions,
    site: "https://www.linkedin.com/company/samtechsolutionsbr/",
    tipo: "cliente",
  },
  {
    nome: "Valve Corporation",
    logo: valve,
    site: "https://www.valvesoftware.com/",
    tipo: "cliente",
  },
  {
    nome: "PlayStation",
    logo: playstation,
    site: "https://www.playstation.com/",
    tipo: "cliente",
  },

  // Empresas ou instituições que apoiam a Another World.
  {
    nome: "Vivo",
    logo: vivo,
    site: "https://www.vivo.com.br/",
    tipo: "patrocinador",
  },
  {
    nome: "Dell",
    logo: dell,
    site: "https://www.dell.com/",
    tipo: "patrocinador",
  },
  {
    nome: "Cisco",
    logo: cisco,
    site: "https://www.cisco.com/",
    tipo: "patrocinador",
  },
  {
    nome: "Intel",
    logo: intel,
    site: "https://www.intel.com/",
    tipo: "patrocinador",
  },
];

export default parceiros;