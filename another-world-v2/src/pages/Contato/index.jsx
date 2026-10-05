import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  criarSolicitacao,
  SERVICOS_ORCAMENTO,
} from "../../services/solicitacoes";

const initialForm = {
  nome: "",
  email: "",
  telefone: "",
  servicoSlug: "",
  cep: "",
  rua: "",
  bairro: "",
  cidade: "",
  uf: "",
  numero: "",
  complemento: "",
  mensagem: "",
  canalPreferido: "email",
  whatsappAutorizado: false,
};

export default function Contato() {
  const [form, setForm] = useState({ ...initialForm });
  const [errors, setErrors] = useState({});
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [success, setSuccess] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const cepController = useRef(null);

  // Cancela a consulta se a pessoa sair desta página.
  useEffect(() => () => {
    const controller = cepController.current;
    cepController.current = null;
    controller?.abort();
  }, []);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox"
      ? checked
      : name === "uf" ? value.toUpperCase() : value;
    setForm((previous) => ({
      ...previous,
      [name]: nextValue,
      ...(name === "canalPreferido" ? { whatsappAutorizado: false } : {}),
    }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setSubmitError("");
    setSuccess(null);
  }

  function formatCep(value) {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    return numbers.length > 5
      ? `${numbers.slice(0, 5)}-${numbers.slice(5)}`
      : numbers;
  }

  async function buscarCep(cepValue) {
    const cep = cepValue.replace(/\D/g, "");
    if (cep.length !== 8) return;

    cepController.current?.abort();
    const controller = new AbortController();
    cepController.current = controller;
    setCepLoading(true);
    setCepMessage("");
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Falha na consulta do CEP.");
      const data = await response.json();
      // Uma consulta antiga não pode sobrescrever um CEP novo.
      if (cepController.current !== controller) return;
      if (data.erro) {
        setCepMessage("CEP não encontrado. Confira o número informado.");
        return;
      }
      setForm((previous) => ({
        ...previous,
        rua: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      }));
    } catch {
      if (cepController.current === controller) {
        setCepMessage("Consulta indisponível. Você pode preencher o endereço manualmente.");
      }
    } finally {
      clearTimeout(timeout);
      if (cepController.current === controller) {
        cepController.current = null;
        setCepLoading(false);
      }
    }
  }

  function handleCepChange(event) {
    const controller = cepController.current;
    cepController.current = null;
    controller?.abort();
    setCepLoading(false);
    const cep = formatCep(event.target.value);
    setForm((previous) => ({
      ...previous,
      cep,
      rua: "",
      bairro: "",
      cidade: "",
      uf: "",
    }));
    setErrors((previous) => ({ ...previous, cep: "" }));
    setCepMessage("");
    setSubmitError("");
    setSuccess(null);
  }

  function validateForm() {
    const newErrors = {};
    if (!form.nome.trim()) newErrors.nome = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Digite um e-mail válido.";
    }
    const telefone = form.telefone.replace(/\D/g, "");
    if (telefone.length < 10 || telefone.length > 15) {
      newErrors.telefone = "Informe um telefone com DDD, incluindo o código do país se necessário.";
    }
    if (!SERVICOS_ORCAMENTO.some((servico) => servico.slug === form.servicoSlug)) {
      newErrors.servicoSlug = "Escolha um serviço ou a opção Outro / Ainda não sei.";
    }
    if (form.cep.replace(/\D/g, "").length !== 8) {
      newErrors.cep = "Digite um CEP com oito números.";
    }
    if (form.uf && !/^[A-Z]{2}$/.test(form.uf)) {
      newErrors.uf = "Informe a sigla do estado com duas letras.";
    }
    if (!form.mensagem.trim()) newErrors.mensagem = "Descreva o que você precisa.";
    if (form.canalPreferido === "whatsapp" && !form.whatsappAutorizado) {
      newErrors.whatsappAutorizado = "Autorize o contato por WhatsApp ou escolha e-mail.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current || cepLoading) return;
    setSuccess(null);
    setSubmitError("");
    if (!validateForm()) return;

    // Bloqueia novos cliques enquanto a requisição está em andamento.
    submitting.current = true;
    setSending(true);
    try {
      const resultado = await criarSolicitacao(form);
      // Só confirma o sucesso depois da resposta da API.
      setSuccess(resultado);
      setForm({ ...initialForm });
      setErrors({});
      setCepMessage("");
    } catch (error) {
      // Preserva todos os campos para a pessoa corrigir ou tentar novamente.
      setSubmitError(error.message || "Não foi possível enviar a solicitação.");
      if (Array.isArray(error.campos)) {
        const invalidos = Object.fromEntries(error.campos.map((campo) => [
          campo === "logradouro" ? "rua" : campo,
          "Confira este campo.",
        ]));
        setErrors((previous) => ({ ...previous, ...invalidos }));
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
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
                Solicite um orçamento
              </h2>

              <p className="mt-2 text-sm text-text-muted">
                Conte sua necessidade e escolha como prefere receber nosso retorno.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <fieldset disabled={sending} aria-busy={sending} className="space-y-5">
                <legend className="sr-only">Dados da solicitação de orçamento</legend>

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
                    maxLength={120}
                    aria-invalid={Boolean(errors.nome)}
                    aria-describedby={errors.nome ? "erro-nome" : undefined}
                    name="nome"
                    type="text"
                    value={form.nome}
                    onChange={handleChange}
                    placeholder="Seu nome"
                    className={inputClass}
                  />

                  {errors.nome && (
                    <p id="erro-nome" className="mt-1.5 text-xs text-red-400">
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
                    maxLength={254}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "erro-email" : undefined}
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="seuemail@email.com"
                    className={inputClass}
                  />

                  {errors.email && (
                    <p id="erro-email" className="mt-1.5 text-xs text-red-400">
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
                      maxLength={30}
                      aria-invalid={Boolean(errors.telefone)}
                      aria-describedby={errors.telefone ? "erro-telefone" : undefined}
                      name="telefone"
                      type="tel"
                      value={form.telefone}
                      onChange={handleChange}
                      placeholder="(11) 99999-9999"
                      className={inputClass}
                    />

                    {errors.telefone && (
                      <p id="erro-telefone" className="mt-1.5 text-xs text-red-400">
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
                      aria-invalid={Boolean(errors.cep)}
                      aria-describedby="cep-ajuda"
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

                    <div id="cep-ajuda" aria-live="polite">
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

                    {errors.cep && (
                      <p className="mt-1.5 text-xs text-red-400">
                        {errors.cep}
                      </p>
                    )}
                    </div>
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
                      maxLength={180}
                      aria-invalid={Boolean(errors.rua)}
                      aria-describedby={errors.rua ? "erro-rua" : undefined}
                      name="rua"
                      type="text"
                      value={form.rua}
                      onChange={handleChange}
                      placeholder="Preenchido automaticamente"
                      className={inputClass}
                    />
                    {errors.rua && <p id="erro-rua" className="mt-1.5 text-xs text-red-400">{errors.rua}</p>}
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
                      maxLength={100}
                      aria-invalid={Boolean(errors.bairro)}
                      aria-describedby={errors.bairro ? "erro-bairro" : undefined}
                      name="bairro"
                      type="text"
                      value={form.bairro}
                      onChange={handleChange}
                      placeholder="Bairro"
                      className={inputClass}
                    />
                    {errors.bairro && <p id="erro-bairro" className="mt-1.5 text-xs text-red-400">{errors.bairro}</p>}
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
                      maxLength={100}
                      aria-invalid={Boolean(errors.cidade)}
                      aria-describedby={errors.cidade ? "erro-cidade" : undefined}
                      name="cidade"
                      type="text"
                      value={form.cidade}
                      onChange={handleChange}
                      placeholder="Cidade"
                      className={inputClass}
                    />
                    {errors.cidade && <p id="erro-cidade" className="mt-1.5 text-xs text-red-400">{errors.cidade}</p>}
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
                      aria-invalid={Boolean(errors.uf)}
                      aria-describedby={errors.uf ? "erro-uf" : undefined}
                      name="uf"
                      type="text"
                      value={form.uf}
                      onChange={handleChange}
                      placeholder="UF"
                      maxLength={2}
                      className={inputClass}
                    />
                    {errors.uf && <p id="erro-uf" className="mt-1.5 text-xs text-red-400">{errors.uf}</p>}
                  </div>
                  <div>
                    <label htmlFor="numero" className="mb-2 block text-sm font-medium text-white">Número</label>
                    <input id="numero" name="numero" type="text" value={form.numero}
                      onChange={handleChange} maxLength={20} placeholder="Número ou S/N" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="complemento" className="mb-2 block text-sm font-medium text-white">Complemento</label>
                    <input id="complemento" name="complemento" type="text" value={form.complemento}
                      onChange={handleChange} maxLength={100} placeholder="Sala, bloco, apartamento..." className={inputClass} />
                  </div>
                </div>

                {/* Os valores são os mesmos slugs cadastrados no PostgreSQL. */}
                <div>
                  <label htmlFor="servicoSlug" className="mb-2 block text-sm font-medium text-white">
                    Serviço de interesse *
                  </label>
                  <select id="servicoSlug" name="servicoSlug" value={form.servicoSlug}
                    onChange={handleChange} className={inputClass}
                    aria-invalid={Boolean(errors.servicoSlug)}
                    aria-describedby={errors.servicoSlug ? "erro-servicoSlug" : undefined}>
                    <option value="">Selecione uma opção</option>
                    {SERVICOS_ORCAMENTO.map((servico) => (
                      <option key={servico.slug} value={servico.slug}>{servico.nome}</option>
                    ))}
                  </select>
                  {errors.servicoSlug && <p id="erro-servicoSlug" className="mt-1.5 text-xs text-red-400">{errors.servicoSlug}</p>}
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
                    maxLength={4000}
                    aria-invalid={Boolean(errors.mensagem)}
                    aria-describedby={errors.mensagem ? "erro-mensagem" : undefined}
                    name="mensagem"
                    value={form.mensagem}
                    onChange={handleChange}
                    placeholder="Conte um pouco sobre o que você precisa..."
                    rows={6}
                    className={`${inputClass} resize-none`}
                  />

                  {errors.mensagem && (
                    <p id="erro-mensagem" className="mt-1.5 text-xs text-red-400">
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
                  {form.canalPreferido === "whatsapp" && (
                    <div className="mt-3">
                      <label className="flex items-start gap-3 text-sm leading-6 text-text-muted">
                        <input id="whatsappAutorizado" name="whatsappAutorizado" type="checkbox"
                          checked={form.whatsappAutorizado} onChange={handleChange}
                          className="mt-1 h-4 w-4 accent-purple"
                          aria-invalid={Boolean(errors.whatsappAutorizado)}
                          aria-describedby={errors.whatsappAutorizado ? "erro-whatsapp" : undefined} />
                        Autorizo a Another World a entrar em contato por WhatsApp sobre esta solicitação.
                      </label>
                      {errors.whatsappAutorizado && <p id="erro-whatsapp" className="mt-1.5 text-xs text-red-400">{errors.whatsappAutorizado}</p>}
                    </div>
                  )}
                </div>

                {submitError && (
                  <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {submitError}
                  </div>
                )}

                {/* Sucesso */}
                {success && (
                  <div role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                    Solicitação recebida. Nossa equipe retornará pelo canal escolhido.
                    <span className="mt-2 block break-all text-xs">Protocolo: {success.id}</span>
                  </div>
                )}

                {/* Botão */}
                <button
                  type="submit"
                  disabled={sending || cepLoading}
                  className="w-full rounded-full bg-purple px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                  {sending ? "Enviando..." : cepLoading ? "Consultando CEP..." : "Enviar solicitação"}
                </button>

              </fieldset>
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
