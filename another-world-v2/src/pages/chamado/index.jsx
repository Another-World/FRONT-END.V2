import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { criarChamado } from "../../services/chamados";

const initialForm = {
  nome: "",
  email: "",
  telefone: "",
  empresa: "",
  frente: "",
  urgencia: "",
  equipamento: "",
  descricao: "",
  tentou: "",
  desdeQuando: "",
};

const frentes = [
  "Hardware",
  "Redes",
  "Infraestrutura",
  "Dev Web",
  "Suporte",
];

const urgencias = [
  "Baixa",
  "Média",
  "Alta",
];

export default function Chamado() {
  const { user } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);

  // Preenche dados do usuário logado
  useEffect(() => {
    if (!user) return;

    setForm((previous) => ({
      ...previous,

      nome: previous.nome || user.name || "",
      email: previous.email || user.email || "",
      telefone: previous.telefone || user.telefone || "",
      empresa: previous.empresa || user.empresa || "",
    }));
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  }

  function validateForm() {
    const newErrors = {};

    if (!form.nome.trim()) {
      newErrors.nome = "Informe seu nome.";
    }

    if (!form.email.trim()) {
      newErrors.email = "Informe seu e-mail.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email
      )
    ) {
      newErrors.email = "Digite um e-mail válido.";
    }

    if (!form.telefone.trim()) {
      newErrors.telefone = "Informe seu telefone.";
    }

    if (!form.frente) {
      newErrors.frente =
        "Selecione a frente do problema.";
    }

    if (!form.urgencia) {
      newErrors.urgencia =
        "Selecione a urgência.";
    }

    if (!form.equipamento.trim()) {
      newErrors.equipamento =
        "Informe o equipamento ou sistema afetado.";
    }

    if (!form.descricao.trim()) {
      newErrors.descricao =
        "Descreva o problema.";
    }

    if (!form.tentou.trim()) {
      newErrors.tentou =
        "Informe o que você já tentou fazer.";
    }

    if (!form.desdeQuando.trim()) {
      newErrors.desdeQuando =
        "Informe desde quando o problema acontece.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();

    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    const chamado = criarChamado(form);

    setSuccess(chamado);

    setForm({
      ...initialForm,

      // Mantém os dados do usuário logado
      nome: user?.name || "",
      email: user?.email || "",
      telefone: user?.telefone || "",
      empresa: user?.empresa || "",
    });

    setErrors({});

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-bg-section px-4 py-3 text-sm text-white outline-none transition focus:border-purple placeholder:text-text-muted";

  function ErrorMessage({ name }) {
    if (!errors[name]) {
      return null;
    }

    return (
      <p className="mt-1.5 text-xs text-red-400">
        {errors[name]}
      </p>
    );
  }

  // Tela de sucesso
  if (success) {
    return (
      <main className="min-h-screen bg-bg-dark">
        <section className="mx-auto flex min-h-[70vh] max-w-[800px] items-center px-6 py-20">
          <div className="w-full rounded-2xl border border-border bg-bg-section p-8 text-center md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl text-emerald-400">
              ✓
            </div>

            <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-purple">
              Chamado enviado
            </p>

            <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
              Recebemos sua solicitação!
            </h1>

            <p className="mx-auto mt-5 max-w-xl leading-7 text-text-muted">
              Seu chamado foi registrado com sucesso.
              Nossa equipe vai analisar as informações
              e responder assim que possível.
            </p>

            <div className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-text-muted">
                Número do protocolo
              </p>

              <p className="mt-2 text-xl font-bold text-white">
                {success.protocolo}
              </p>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-white transition hover:bg-bg-card"
              >
                Voltar para o início
              </Link>

              <Link
                to="/area-cliente"
                className="rounded-full bg-purple px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Área do Cliente
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-dark">
      {/* Cabeçalho */}
      <section className="mx-auto max-w-[1200px] px-6 pb-12 pt-20">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-purple">
          Atendimento
        </p>

        <h1 className="max-w-3xl text-4xl font-bold text-white md:text-5xl">
          Abra um chamado
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted">
          Conte para nossa equipe o que está acontecendo.
          Quanto mais detalhes você fornecer, mais fácil será
          entender e encaminhar o problema.
        </p>
      </section>

      {/* Conteúdo */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          {/* Formulário */}
          <div className="rounded-2xl border border-border bg-bg-section p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">
                Dados do chamado
              </h2>

              <p className="mt-2 text-sm text-text-muted">
                Campos marcados com * são obrigatórios.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Nome */}
              <div>
                <label
                  htmlFor="nome"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Nome *
                </label>

                <input
                  id="nome"
                  name="nome"
                  type="text"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  className={inputClass}
                />

                <ErrorMessage name="nome" />
              </div>

              {/* E-mail */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  E-mail *
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="seuemail@email.com"
                  className={inputClass}
                />

                <ErrorMessage name="email" />
              </div>

              {/* Telefone + Empresa */}
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="telefone"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Telefone *
                  </label>

                  <input
                    id="telefone"
                    name="telefone"
                    type="tel"
                    value={form.telefone}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    className={inputClass}
                  />

                  <ErrorMessage name="telefone" />
                </div>

                <div>
                  <label
                    htmlFor="empresa"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Empresa
                  </label>

                  <input
                    id="empresa"
                    name="empresa"
                    type="text"
                    value={form.empresa}
                    onChange={handleChange}
                    placeholder="Nome da empresa"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Frente + Urgência */}
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="frente"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Frente do problema *
                  </label>

                  <select
                    id="frente"
                    name="frente"
                    value={form.frente}
                    onChange={handleChange}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">
                      Selecione uma opção
                    </option>

                    {frentes.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>

                  <ErrorMessage name="frente" />
                </div>

                <div>
                  <label
                    htmlFor="urgencia"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Urgência *
                  </label>

                  <select
                    id="urgencia"
                    name="urgencia"
                    value={form.urgencia}
                    onChange={handleChange}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">
                      Selecione uma opção
                    </option>

                    {urgencias.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>

                  <ErrorMessage name="urgencia" />
                </div>
              </div>

              {/* Equipamento */}
              <div>
                <label
                  htmlFor="equipamento"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Equipamento ou sistema afetado *
                </label>

                <input
                  id="equipamento"
                  name="equipamento"
                  type="text"
                  value={form.equipamento}
                  onChange={handleChange}
                  placeholder="Ex.: Notebook Dell, rede Wi-Fi, site da empresa..."
                  className={inputClass}
                />

                <ErrorMessage name="equipamento" />
              </div>

              {/* Descrição */}
              <div>
                <label
                  htmlFor="descricao"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Descrição do problema *
                </label>

                <textarea
                  id="descricao"
                  name="descricao"
                  value={form.descricao}
                  onChange={handleChange}
                  placeholder="Explique o que está acontecendo..."
                  rows={6}
                  className={`${inputClass} resize-none`}
                />

                <ErrorMessage name="descricao" />
              </div>

              {/* Tentativas */}
              <div>
                <label
                  htmlFor="tentou"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  O que você já tentou fazer? *
                </label>

                <textarea
                  id="tentou"
                  name="tentou"
                  value={form.tentou}
                  onChange={handleChange}
                  placeholder="Informe os testes ou procedimentos que já realizou..."
                  rows={4}
                  className={`${inputClass} resize-none`}
                />

                <ErrorMessage name="tentou" />
              </div>

              {/* Desde quando */}
              <div>
                <label
                  htmlFor="desdeQuando"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Desde quando acontece? *
                </label>

                <input
                  id="desdeQuando"
                  name="desdeQuando"
                  type="text"
                  value={form.desdeQuando}
                  onChange={handleChange}
                  placeholder="Ex.: hoje pela manhã, há 3 dias..."
                  className={inputClass}
                />

                <ErrorMessage name="desdeQuando" />
              </div>

              {/* Botão */}
              <button
                type="submit"
                className="w-full rounded-full bg-purple px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple focus:ring-offset-2 focus:ring-offset-bg-section"
              >
                Enviar chamado
              </button>
            </form>
          </div>

          {/* Lateral */}
          <aside className="h-fit rounded-2xl border border-border bg-bg-section p-6 md:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.15em] text-purple">
              Antes de enviar
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Como agilizar seu atendimento
            </h2>

            <ul className="mt-6 space-y-5 text-sm leading-6 text-text-muted">
              <li>
                <span className="font-semibold text-white">
                  Seja específico:
                </span>{" "}
                informe mensagens de erro, sintomas e o
                equipamento afetado.
              </li>

              <li>
                <span className="font-semibold text-white">
                  Conte o que já tentou:
                </span>{" "}
                isso evita repetir procedimentos
                desnecessariamente.
              </li>

              <li>
                <span className="font-semibold text-white">
                  Escolha a urgência:
                </span>{" "}
                use a prioridade que melhor representa o
                impacto do problema.
              </li>
            </ul>

            <div className="mt-8 border-t border-border pt-6">
              <p className="text-sm text-text-muted">
                Dúvida simples? Consulte a Central de
                ajuda antes de abrir um chamado.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}