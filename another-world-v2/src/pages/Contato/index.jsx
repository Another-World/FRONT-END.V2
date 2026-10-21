import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { criarSolicitacao, SERVICOS_ORCAMENTO } from "../../services/solicitacoes";

const initialForm = {
  nome: "",
  email: "",
  telefone: "",
  cep: "",
  rua: "",
  bairro: "",
  cidade: "",
  uf: "",
  numero: "",
  complemento: "",
  servicoSlug: "",
  pessoaJuridica: false,
  cnpj: "",
  canalPreferido: "email",
  whatsappAutorizado: false,
  mensagem: "",
};

export default function Contato() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [resultado, setResultado] = useState(null);
  const [envioError, setEnvioError] = useState("");
  const [enviando, setEnviando] = useState(false);

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

    if (!form.servicoSlug) {
      newErrors.servicoSlug = "Selecione o serviço de interesse.";
    }

    if (form.pessoaJuridica && form.cnpj.replace(/\D/g, "").length !== 14) {
      newErrors.cnpj = "Informe um CNPJ válido.";
    }

    if (!form.cep.trim()) {
      newErrors.cep = "Informe seu CEP.";
    } else if (form.cep.replace(/\D/g, "").length !== 8) {
      newErrors.cep = "Digite um CEP válido.";
    }

    if (!form.mensagem.trim()) {
      newErrors.mensagem = "Digite uma mensagem.";
    }

    if (form.canalPreferido === "whatsapp" && !form.whatsappAutorizado) {
      newErrors.canalPreferido = "Autorize o contato por WhatsApp para continuar.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setResultado(null);
    setEnvioError("");

    if (!validateForm()) {
      return;
    }

    setEnviando(true);
    try {
      const solicitacao = await criarSolicitacao({
        ...form,
      }, user?.id ?? null);
      setResultado(solicitacao);
      setForm(initialForm);
      setCepMessage("");
    } catch (error) {
      setEnvioError(error.message || "Não foi possível enviar sua solicitação.");
    } finally {
      setEnviando(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-bg-section px-4 py-3 text-sm text-white outline-none transition focus:border-purple placeholder:text-text-muted";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#160b20]">
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
          backgroundImage: `radial-gradient(ellipse 65% 580px at 50% 0%, rgb(139 69 214 / 18%), transparent 75%), radial-gradient(ellipse 45% 700px at 100% 38%, rgb(77 83 160 / 11%), transparent 75%), radial-gradient(ellipse 55% 600px at 0% 85%, rgb(139 69 214 / 10%), transparent 75%), radial-gradient(1.5px 1.5px at 63px 113px, rgb(255 255 255 / 70%) 80%, transparent), radial-gradient(1px 1px at 211px 237px, rgb(219 208 245 / 65%) 80%, transparent)`,
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 457px 389px, 593px 541px",
          animation: "spaceGlow 9s ease-in-out infinite alternate",
        }}
      />
      {/* Cabeçalho da página */}
      <section className="relative z-10 mx-auto max-w-[1200px] px-6 pb-12 pt-20">
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
      <section className="relative z-10 mx-auto max-w-[1200px] px-6 pb-20">
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

                <div>
                  <label htmlFor="numero" className="mb-2 block text-sm font-medium text-white">
                    Número
                  </label>
                  <input id="numero" name="numero" type="text" value={form.numero}
                    onChange={handleChange} placeholder="Número ou S/N" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="complemento" className="mb-2 block text-sm font-medium text-white">
                    Complemento
                  </label>
                  <input id="complemento" name="complemento" type="text" value={form.complemento}
                    onChange={handleChange} placeholder="Sala, bloco, apartamento..." className={inputClass} />
                </div>
              </div>

              <div>
                <label htmlFor="servicoSlug" className="mb-2 block text-sm font-medium text-white">
                  Serviço de interesse *
                </label>
                <select id="servicoSlug" name="servicoSlug" value={form.servicoSlug}
                  onChange={handleChange} className={inputClass}>
                  <option value="">Selecione uma opção</option>
                  {SERVICOS_ORCAMENTO.map((servico) => (
                    <option key={servico.slug} value={servico.slug}>{servico.nome}</option>
                  ))}
                </select>
                {errors.servicoSlug && <p className="mt-1.5 text-xs text-red-400">{errors.servicoSlug}</p>}
              </div>

              <label className="block rounded-xl border border-border px-4 py-4 text-sm text-text-muted">
                <span className="flex items-start gap-3">
                  <input type="checkbox" checked={form.pessoaJuridica}
                    onChange={(event) => setForm((anterior) => ({ ...anterior, pessoaJuridica: event.target.checked, cnpj: event.target.checked ? anterior.cnpj : "" }))} />
                  <span><strong className="text-white">Sou uma empresa / Pessoa Jurídica</strong><br />
                    Marque esta opção se a solicitação for feita em nome de uma empresa.</span>
                </span>
              </label>

              {form.pessoaJuridica && <div>
                <label htmlFor="cnpj" className="mb-2 block text-sm font-medium text-white">CNPJ *</label>
                <input id="cnpj" name="cnpj" type="text" value={form.cnpj} onChange={handleChange}
                  placeholder="00.000.000/0000-00" className={inputClass} />
                {errors.cnpj && <p className="mt-1.5 text-xs text-red-400">{errors.cnpj}</p>}
              </div>}

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

              <div>
                <label htmlFor="canalPreferido" className="mb-2 block text-sm font-medium text-white">
                  Como prefere receber nosso retorno?
                </label>
                <select id="canalPreferido" name="canalPreferido" value={form.canalPreferido}
                  onChange={handleChange} className={inputClass}>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                {form.canalPreferido === "whatsapp" && <label className="mt-3 flex items-start gap-2 text-sm text-text-muted">
                  <input type="checkbox" checked={form.whatsappAutorizado}
                    onChange={(event) => setForm((anterior) => ({ ...anterior, whatsappAutorizado: event.target.checked }))} />
                  Autorizo o contato por WhatsApp neste número.
                </label>}
                {errors.canalPreferido && <p className="mt-1.5 text-xs text-red-400">{errors.canalPreferido}</p>}
              </div>

              {/* Sucesso */}
              {resultado && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <p>Solicitação recebida. Nossa equipe retornará pelo canal escolhido.</p>
                  <p className="mt-2 font-medium">Solicitação: {resultado.codigo}</p>
                </div>
              )}
              {envioError && <p role="alert" className="text-sm text-red-400">{envioError}</p>}

              {/* Botão */}
              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-full bg-purple px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {enviando ? "Enviando..." : "Enviar mensagem"}
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
