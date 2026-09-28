import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";

function SpaceBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(1px 1px at 24px 38px, rgb(255 255 255 / 65%) 95%, transparent), radial-gradient(1px 1px at 116px 154px, rgb(219 208 245 / 50%) 95%, transparent), radial-gradient(1.5px 1.5px at 78px 92px, rgb(255 255 255 / 70%) 95%, transparent), radial-gradient(1px 1px at 192px 67px, rgb(255 255 255 / 35%) 95%, transparent), radial-gradient(2px 2px at 245px 218px, rgb(201 164 237 / 60%) 65%, transparent)`,
          backgroundSize: "211px 239px, 307px 313px, 433px 397px, 509px 467px, 683px 619px",
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 65% 580px at 50% 0%, rgb(139 69 214 / 18%), transparent 75%), radial-gradient(ellipse 45% 700px at 100% 38%, rgb(77 83 160 / 11%), transparent 75%), radial-gradient(ellipse 55% 600px at 0% 85%, rgb(139 69 214 / 10%), transparent 75%)`,
        }}
      />
    </>
  );
}

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" ou "cadastro"
  const [error, setError] = useState("");
  const [welcomeName, setWelcomeName] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Se a pessoa já está logada e cair aqui de novo (ex: digitou /login na URL),
  // manda ela direto pra Área do Cliente em vez de mostrar o formulário.
  //
  // O "!welcomeName" é essencial: logo depois de entrar, o register/login já
  // preencheu o user, então sem essa checagem este return dispararia primeiro
  // e a tela de boas-vindas nunca chegaria a aparecer.
  if (user && !welcomeName) {
    return <Navigate to="/area-cliente" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError("");
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!validateEmail(form.email)) {
      setError("Digite um e-mail válido.");
      return;
    }

    try {
      let session;

      if (mode === "cadastro") {
        if (form.password.length < 6) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
          return;
        }

        if (form.password !== form.confirmPassword) {
          setError("As senhas não coincidem.");
          return;
        }

        session = register({
          name: form.name,
          email: form.email,
          password: form.password,
        });
      } else {
        session = login({
          email: form.email,
          password: form.password,
        });
      }

      // Mostra a mensagem de boas-vindas por um instante antes de redirecionar.
      // Usa o nome que veio da sessão, não do formulário: no modo login o campo
      // "nome" nem aparece, então form.name está vazio e cairia no e-mail.
      setWelcomeName(session.name || session.email);
      setTimeout(() => navigate("/area-cliente"), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  // Tela de sucesso — aparece por 1.2s antes do redirecionamento.
  if (welcomeName) {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#101114] px-6 text-center">
        <SpaceBackground />

        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-purple">
            Tudo certo
          </p>

          <h1 className="text-3xl font-bold text-white">
            Seja bem-vindo, {welcomeName}!
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#101114] px-6 py-16">
      <SpaceBackground />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-bg-card/90 p-8 backdrop-blur-sm">
        {/* Abas Login / Cadastro */}
        <div className="mb-8 flex border-b border-border">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              mode === "login"
                ? "border-b-2 border-purple text-white"
                : "text-text-muted"
            }`}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => switchMode("cadastro")}
            className={`flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              mode === "cadastro"
                ? "border-b-2 border-purple text-white"
                : "text-text-muted"
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {mode === "cadastro" && (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Nome
              </span>

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="border-b border-border bg-transparent py-2 text-white outline-none focus:border-purple"
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              E-mail
            </span>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="border-b border-border bg-transparent py-2 text-white outline-none focus:border-purple"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Senha
            </span>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="border-b border-border bg-transparent py-2 text-white outline-none focus:border-purple"
            />
          </label>

          {mode === "cadastro" && (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Confirmar senha
              </span>

              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="border-b border-border bg-transparent py-2 text-white outline-none focus:border-purple"
              />
            </label>
          )}

          {mode === "login" && (
            <button
              type="button"
              className="text-right text-xs text-purple hover:underline"
              onClick={() =>
                alert("Recuperação de senha ainda não implementada.")
              }
            >
              Esqueci minha senha
            </button>
          )}

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="solid">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
      </div>
    </div>
  );
}
