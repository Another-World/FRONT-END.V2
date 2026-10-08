import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { callbackError } from "../../lib/authCallback";
import { authErrorMessage, requestPasswordReset, changePassword } from "../../services/auth";
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
  const { user, loading, authError, passwordRecovery, finishRecovery, login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(callbackError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const submitting = useRef(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  const view = passwordRecovery ? "novaSenha" : mode;
  const needsPassword = view !== "esqueci";
  const needsConfirmation = view === "cadastro" || view === "novaSenha";

  // Aguarda a restauração da sessão e as operações assíncronas antes de navegar.
  if (!loading && user && !passwordRecovery && !busy && !passwordChanged && !error) {
    return <Navigate to="/area-cliente" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode) {
    if (submitting.current) return;
    setMode(nextMode);
    setError("");
    setNotice("");
    setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // O ref bloqueia dois envios até mesmo antes do próximo render.
    if (submitting.current || loading || authError) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (view !== "novaSenha" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError("Digite um e-mail válido.");
        return;
      }
      if (view === "cadastro" && !form.name.trim()) {
        setError("Digite seu nome.");
        return;
      }
      if (needsConfirmation && form.password.length < 8) {
        setError("A senha precisa ter pelo menos 8 caracteres.");
        return;
      }
      if (needsConfirmation && form.password !== form.confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }

      if (view === "cadastro") {
        const result = await register(form);
        if (result.needsConfirmation) {
          // Resposta neutra: não revela se este e-mail já possui uma conta.
          setNotice("Confira seu e-mail para concluir o cadastro. Se você já tem uma conta, entre ou recupere sua senha.");
          setMode("login");
        }
      } else if (view === "esqueci") {
        await requestPasswordReset(form.email);
        setNotice("Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também o spam.");
      } else if (view === "novaSenha") {
        if (!user || !passwordRecovery) {
          setError("Solicite um novo link de recuperação de senha.");
          return;
        }
        await changePassword(form.password);
        setPasswordChanged(true);
      } else {
        await login(form);
      }
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const titles = {
    login: "Acesse sua conta",
    cadastro: "Crie sua conta",
    esqueci: "Recupere seu acesso",
    novaSenha: "Escolha uma nova senha",
  };
  const labels = {
    login: "Entrar",
    cadastro: "Criar conta",
    esqueci: "Enviar link de recuperação",
    novaSenha: "Salvar nova senha",
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-bg-dark px-6 py-16">
      <SpaceBackground />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-bg-card/90 p-8 backdrop-blur-sm">
        {loading ? (
          <p role="status" className="text-center text-text-muted">Verificando sua sessão…</p>
        ) : passwordChanged ? (
          <div className="flex flex-col gap-5 text-text-main">
            <h1 className="text-2xl font-semibold" role="status">Senha atualizada</h1>
            <p className="text-sm text-text-muted">Use a nova senha no seu próximo acesso.</p>
            <Button type="button" variant="solid" onClick={() => {
              setPasswordChanged(false);
              finishRecovery();
            }}>Continuar</Button>
          </div>
        ) : (
          <>
            <h1 className="mb-6 text-2xl font-semibold text-text-main">{titles[view]}</h1>
            {!passwordRecovery && (view === "login" || view === "cadastro") && (
              <div className="mb-6 flex border-b border-border">
                {[ ["login", "Entrar"], ["cadastro", "Criar conta"] ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    aria-pressed={view === value}
                    onClick={() => switchMode(value)}
                    className={`flex-1 pb-3 text-sm font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 ${view === value ? "border-b-2 border-purple text-text-main" : "text-text-muted"}`}
                  >{label}</button>
                ))}
              </div>
            )}

            {authError && (
              <div className="mb-5 text-sm text-text-main">
                <p role="alert">{authError}</p>
                <button type="button" className="mt-2 text-purple underline" onClick={() => window.location.reload()}>Tentar novamente</button>
              </div>
            )}
            {notice && <p role="status" className="mb-5 rounded-lg border border-border bg-bg-card-inner p-4 text-sm text-text-main">{notice}</p>}
            {error && <p role="alert" className="mb-5 text-sm text-text-main">{error}</p>}

            <form onSubmit={handleSubmit} aria-busy={busy}>
              <fieldset disabled={busy || Boolean(authError)} className="flex min-w-0 flex-col gap-5 disabled:opacity-70">
                {view === "cadastro" && (
                  <Field label="Nome" name="name" autoComplete="name" maxLength={120} value={form.name} onChange={handleChange} />
                )}
                {view !== "novaSenha" && (
                  <Field label="E-mail" name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={handleChange} />
                )}
                {needsPassword && (
                  <Field label={view === "novaSenha" ? "Nova senha" : "Senha"} name="password" type="password" autoComplete={view === "login" ? "current-password" : "new-password"} minLength={needsConfirmation ? 8 : undefined} value={form.password} onChange={handleChange} />
                )}
                {needsConfirmation && (
                  <>
                    <Field label="Confirmar senha" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={handleChange} />
                    <p className="text-xs text-text-muted">Use pelo menos 8 caracteres. Prefira uma senha longa e exclusiva.</p>
                  </>
                )}
                {view === "login" && (
                  <button type="button" className="text-right text-xs text-purple hover:underline" onClick={() => switchMode("esqueci")}>Esqueci minha senha</button>
                )}
                <Button type="submit" variant="solid" disabled={busy || Boolean(authError)} className="disabled:cursor-wait disabled:opacity-60">
                  {busy ? "Aguarde…" : labels[view]}
                </Button>
                {view === "esqueci" && (
                  <button type="button" className="text-sm text-purple hover:underline" onClick={() => switchMode("login")}>Voltar para entrar</button>
                )}
              </fieldset>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <input required className="border-b border-border bg-transparent py-2 text-text-main outline-none focus:border-purple" {...props} />
    </label>
  );
}
