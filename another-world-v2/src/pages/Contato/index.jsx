import { useState } from "react";
import { Link } from "react-router-dom";

const initialForm = {
  nome: "",
  email: "",
  telefone: "",
  cep: "",
  rua: "",
  bairro: "",
  cidade: "",
  uf: "",
  mensagem: "",
};

export default function Contato() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [success, setSuccess] = useState(false);

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

    if (name === "cep") {
      setCepMessage("");
    }
  }

  function formatCep(value) {
    const numbers = value.replace(/\D/g, "").slice(0, 8);

    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }

    return numbers;
  }

  async function buscarCep(cepValue) {
    const cep = cepValue.replace(/\D/g, "");

    if (cep.length !== 8) {
      return;
    }

    setCepLoading(true);
    setCepMessage("");

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cep}/json/`
      );

      if (!response.ok) {
        throw new Error("Falha na consulta do CEP.");
      }

      const data = await response.json();

      if (data.erro) {
        setCepMessage("CEP não encontrado.");
        setForm((previous) => ({
          ...previous,
          rua: "",
          bairro: "",
          cidade: "",
          uf: "",
        }));
        return;
      }

      setForm((previous) => ({
        ...previous,
        rua: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      }));
    } catch (error) {
      console.error(error);
      setCepMessage(
        "Não foi possível consultar o CEP. Tente novamente."
      );
    } finally {
      setCepLoading(false);
    }
  }

  function handleCepChange(event) {
    const formattedCep = formatCep(event.target.value);

    setForm((previous) => ({
      ...previous,
      cep: formattedCep,
    }));

    setCepMessage("");
  }

  function validateForm() {
    const newErrors = {};

    if (!form.nome.trim()) {
      newErrors.nome = "Informe seu nome.";
    }

    if (!form.email.trim()) {
      newErrors.email = "Informe seu e-mail.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      newErrors.email = "Digite um e-mail válido.";
    }

    if (!form.telefone.trim()) {
      newErrors.telefone = "Informe seu telefone.";
    }

    if (!form.cep.trim()) {
      newErrors.cep = "Informe seu CEP.";
    } else if (form.cep.replace(/\D/g, "").length !== 8) {
      newErrors.cep = "Digite um CEP válido.";
    }

    if (!form.mensagem.trim()) {
      newErrors.mensagem = "Digite uma mensagem.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();

    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    console.log("Dados enviados:", form);

    setSuccess(true);

    setForm(initialForm);
    setCepMessage("");
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-bg-section px-4 py-3 text-sm text-white outline-none transition focus:border-purple placeholder:text-text-muted";

  return (
    <main className="min-h-screen bg-bg-dark">
      {/* Cabeçalho da página */}
      <section className="mx-auto max-w-[1200px] px-6 pb-12 pt-20">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-purple">
          Contato
        </p>

        <h1 className="max-w-2xl text-4xl font-bold text-white md:text-5xl">
          Vamos conversar sobre o seu projeto?
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted">
          Entre em contato com a Another World. Conte um pouco sobre
          sua necessidade e nossa equipe poderá ajudar.
        </p>
      </section>

      {/* Conteúdo */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">

          {/* Formulário */}
          <div className="rounded-2xl border border-border bg-bg-section p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">
                Envie uma mensagem
              </h2>

              <p className="mt-2 text-sm text-text-muted">
                Preencha os campos abaixo e entraremos em contato.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

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

                {errors.nome && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.nome}
                  </p>
                )}
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

                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Telefone + CEP */}
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

                  {errors.telefone && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.telefone}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="cep"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    CEP *
                  </label>

                  <input
                    id="cep"
                    name="cep"
                    type="text"
                    inputMode="numeric"
                    value={form.cep}
                    onChange={handleCepChange}
                    onBlur={() => buscarCep(form.cep)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={inputClass}
                  />

                  {cepLoading && (
                    <p className="mt-1.5 text-xs text-purple">
                      Consultando CEP...
                    </p>
                  )}

                  {cepMessage && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {cepMessage}
                    </p>
                  )}

                  {errors.cep && !cepMessage && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.cep}
                    </p>
                  )}
                </div>
              </div>

              {/* Endereço preenchido pelo CEP */}
              <div className="grid gap-5 md:grid-cols-2">

                <div className="md:col-span-2">
                  <label
                    htmlFor="rua"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Rua
                  </label>

                  <input
                    id="rua"
                    name="rua"
                    type="text"
                    value={form.rua}
                    onChange={handleChange}
                    placeholder="Preenchido automaticamente"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="bairro"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Bairro
                  </label>

                  <input
                    id="bairro"
                    name="bairro"
                    type="text"
                    value={form.bairro}
                    onChange={handleChange}
                    placeholder="Bairro"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="cidade"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Cidade
                  </label>

                  <input
                    id="cidade"
                    name="cidade"
                    type="text"
                    value={form.cidade}
                    onChange={handleChange}
                    placeholder="Cidade"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="uf"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    UF
                  </label>

                  <input
                    id="uf"
                    name="uf"
                    type="text"
                    value={form.uf}
                    onChange={handleChange}
                    placeholder="UF"
                    maxLength={2}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <label
                  htmlFor="mensagem"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Mensagem *
                </label>

                <textarea
                  id="mensagem"
                  name="mensagem"
                  value={form.mensagem}
                  onChange={handleChange}
                  placeholder="Conte um pouco sobre o que você precisa..."
                  rows={6}
                  className={`${inputClass} resize-none`}
                />

                {errors.mensagem && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.mensagem}
                  </p>
                )}
              </div>

              {/* Sucesso */}
              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  Mensagem enviada com sucesso!
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                className="w-full rounded-full bg-purple px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Enviar mensagem
              </button>

            </form>
          </div>

          {/* Informações */}
          <aside className="h-fit rounded-2xl border border-border bg-bg-section p-6 md:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.15em] text-purple">
              Fale conosco
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Informações de contato
            </h2>

            <div className="mt-8 space-y-7">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Endereço
                </p>

                <p className="mt-2 text-sm leading-6 text-white">
                  Rua Tito, 54
                  <br />
                  São Paulo - SP
                  <br />
                  CEP 05051-000
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Telefone / WhatsApp
                </p>

                <p className="mt-2 text-sm text-white">
                  0800 837-1429
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  E-mail
                </p>

                <p className="mt-2 break-all text-sm text-white">
                  contato@anotherworld.com
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Horário de atendimento
                </p>

                <p className="mt-2 text-sm leading-6 text-white">
                  Segunda a sexta
                  <br />
                  09:00 às 18:00
                </p>
              </div>

            </div>

            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm text-text-muted">
                Precisa de ajuda com um projeto?
              </p>

              <Link
                to="/servicos"
                className="mt-4 inline-block text-sm font-medium text-purple transition-colors hover:text-white"
              >
                Conheça nossos serviços →
              </Link>
            </div>
          </aside>

        </div>
      </section>
    </main>
  );
}