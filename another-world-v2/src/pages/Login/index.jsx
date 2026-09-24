import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import fundo from "../../styles/FundoEspacial.module.css";

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
        session = login({ email: form.email, password: form.password });
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
      <div
        className={`${fundo.fundo} ${fundo.semEstrelas} min-h-screen flex items-center justify-center px-6 text-center`}
      >
        <div>
          <p className="text-purple text-xs font-semibold uppercase tracking-widest mb-4">
            Tudo certo
          </p>
          <h1 className="text-white text-3xl font-bold">
            Seja bem-vindo, {welcomeName}!
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${fundo.fundo} ${fundo.semEstrelas} min-h-screen flex items-center justify-center px-6 py-16`}
    >
      <div className="w-full max-w-md bg-bg-card border border-border rounded-2xl p-8">

        {/* Abas Login / Cadastro */}
        <div className="flex mb-8 border-b border-border">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              mode === "login" ? "text-white border-b-2 border-purple" : "text-text-muted"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => switchMode("cadastro")}
            className={`flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              mode === "cadastro" ? "text-white border-b-2 border-purple" : "text-text-muted"
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
                className="bg-transparent border-b border-border py-2 text-white outline-none focus:border-purple"
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
              className="bg-transparent border-b border-border py-2 text-white outline-none focus:border-purple"
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
              className="bg-transparent border-b border-border py-2 text-white outline-none focus:border-purple"
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
                className="bg-transparent border-b border-border py-2 text-white outline-none focus:border-purple"
              />
            </label>
          )}

          {mode === "login" && (
            <button
              type="button"
              className="text-xs text-purple text-right hover:underline"
              onClick={() => alert("Recuperação de senha ainda não implementada.")}
            >
              Esqueci minha senha
            </button>
          )}

          {error && (
            <p className="text-red-400 text-sm" role="alert">
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