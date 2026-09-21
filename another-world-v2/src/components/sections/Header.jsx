// src/components/sections/Header.jsx
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-dark/95 backdrop-blur">
      <div className="mx-auto flex h-[82px] max-w-[1440px] items-center justify-between px-6">
        <Link to="/" className="text-[18px] font-bold text-white">
          ANOTHER WORLD
        </Link>
      </div>
    </header>
  );
}