import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getSolicitacoesPorEmail, STATUS_INFO } from "../../services/solicitacoes";
import Button from "../../components/ui/Button";
import fundo from "../../styles/FundoEspacial.module.css";

// Deixa a data no formato brasileiro (01/10/2026).
function formatarData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AreaCliente() {
  const { user, logout, updateProfile } = useAuth();

  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    name: user.name ?? "",
    telefone: user.telefone ?? "",
    empresa: user.empresa ?? "",
  });

  // Lê direto na renderização porque o localStorage é síncrono e barato.
  // Quando virar Supabase, isso aqui vira um useEffect com fetch.
  const solicitacoes = getSolicitacoesPorEmail(user.email);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((atual) => ({ ...atual, [name]: value }));
  }

  function handleSalvar(event) {
    event.preventDefault();
    setErro("");

    if (!form.name.trim()) {
      setErro("O nome não pode ficar vazio.");
      return;
    }

    updateProfile(form);
    setEditando(false);
  }

  function handleCancelar() {
    // Descarta o que foi digitado e volta pros valores que estão salvos.
    setForm({
      name: user.name ?? "",
      telefone: user.telefone ?? "",
      empresa: user.empresa ?? "",
    });
    setErro("");
    setEditando(false);
  }

  return (
    <div className={`${fundo.fundo} min-h-screen`}>
      <div className="mx-auto max-w-[1100px] px-6 py-16">

      {/* SAUDAÇÃO */}
      <div className="mb-12 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple">
            Área do Cliente
          </p>
          <h1 className="text-3xl font-bold text-white">
            Seja Bem-Vindo, {user.name || user.email}!
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Aqui você acompanha seus dados e o andamento das suas solicitações.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition hover:border-purple hover:text-white"
        >
          Sair da conta
        </button>
      </div>

      {/* DADOS CADASTRAIS */}
      <section className="mb-12 rounded-2xl border border-border bg-bg-card p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Dados cadastrais</h2>

          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-xs font-semibold uppercase tracking-wide text-purple hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {editando ? (
          <form onSubmit={handleSalvar} className="flex flex-col gap-5">
            <Campo label="Nome" name="name" value={form.name} onChange={handleChange} />
            <Campo label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} />
            <Campo label="Empresa" name="empresa" value={form.empresa} onChange={handleChange} />

            <p className="text-xs text-text-faint">
              O e-mail ({user.email}) é o identificador da conta e não pode ser alterado.
            </p>

            {erro && (
              <p className="text-sm text-red-400" role="alert">
                {erro}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="submit" variant="solid">
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelar}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-6 sm:grid-cols-2">
            <Dado label="Nome" valor={user.name} />
            <Dado label="E-mail" valor={user.email} />
            <Dado label="Telefone" valor={user.telefone} />
            <Dado label="Empresa" valor={user.empresa} />
          </dl>
        )}
      </section>

      {/* SOLICITAÇÕES */}
      <section className="rounded-2xl border border-border bg-bg-card p-8">
        <h2 className="mb-6 text-lg font-semibold text-white">Minhas solicitações</h2>

        {solicitacoes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="mb-6 text-sm text-text-muted">
              Você ainda não fez nenhuma solicitação.
            </p>
            <Button as={Link} to="/contato" variant="solid">
              Fazer uma solicitação
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {solicitacoes.map((s) => {
              const info = STATUS_INFO[s.status];

              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-bg-card-inner p-6"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple">
                      {s.frente}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${info.classe}`}
                    >
                      {info.label}
                    </span>
                  </div>

                  <p className="mb-4 text-sm text-text-muted">{s.mensagem}</p>

                  {/* A justificativa só existe depois que alguém aceita ou nega. */}
                  {s.resposta && (
                    <p className="mb-4 border-l-2 border-purple pl-4 text-sm text-white">
                      {s.resposta}
                    </p>
                  )}

                  <p className="text-xs text-text-faint">
                    Enviada em {formatarData(s.criadaEm)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        </section>
      </div>
    </div>
  );
}

// Um dado em modo leitura. Mostra um tracinho quando está vazio, pra
// deixar claro que o campo existe mas não foi preenchido ainda.
function Dado({ label, valor }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="text-white">{valor || "—"}</dd>
    </div>
  );
}

// Um campo do formulário de edição, no mesmo estilo dos inputs do Login.
function Campo({ label, name, value, onChange }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        className="border-b border-border bg-transparent py-2 text-white outline-none focus:border-purple"
      />
    </label>
  );
}
