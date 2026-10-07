import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const items = [
  { label: "Início", href: "/" },
  { label: "Quem Somos", href: "/quem-somos" },
  { label: "Serviços", href: "/servicos" },
  { label: "Contato", href: "/contato" },
];

export default function GooeyNav() {
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  return (
    <nav className="relative flex items-center justify-center">
      <div
        className="
          flex items-center gap-1
          rounded-full
          border border-[#8554b3]/30
          bg-[#cab1e3]/30
          px-2 py-2
          shadow-lg shadow-[#8554b3]/10
          backdrop-blur-md
          transition-all duration-300

          dark:border-[#a080bd]/30
          dark:bg-[#1a1420]/70
          dark:shadow-[#7843ab]/10
        "
      >
        {items.map((item) => {
          const isActive = active === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setActive(item.href)}
              className={`
                relative
                rounded-full
                px-5 py-2.5
                text-sm
                font-semibold
                whitespace-nowrap
                outline-none
                transition-all
                duration-300

                ${
                  isActive
                    ? `
                      bg-[#7843ab]
                      text-white
                      shadow-md
                      shadow-[#7843ab]/30
                    `
                    : `
                      text-[#4f3c5b]
                      hover:bg-[#cda5f2]/50
                      hover:text-[#7843ab]

                      dark:text-[#eee5f5]
                      dark:hover:bg-[#8554b3]/25
                      dark:hover:text-[#cda5f2]
                    `
                }
              `}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}