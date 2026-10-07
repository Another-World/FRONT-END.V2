import { createHash } from "node:crypto";
import { z } from "zod";

const texto = (limite) => z.string().trim().min(1).max(limite);
const opcional = (limite) => z.string().trim().max(limite).optional();
const schema = z.strictObject({
  nome: texto(120),
  email: z.string().trim().max(254).pipe(z.email()),
  telefone: z.string().trim().regex(/^[0-9()+\s-]{8,20}$/),
  servicoSlug: z.string().regex(/^[a-z0-9-]{2,48}$/),
  pessoaJuridica: z.boolean().default(false),
  cnpj: z.string().max(30).optional(),
  empresa: opcional(160),
  canalPreferido: z.enum(["email", "whatsapp"]).default("email"),
  whatsappAutorizado: z.boolean().default(false),
  cep: z.string().max(20),
  logradouro: opcional(180),
  bairro: opcional(100),
  cidade: opcional(100),
  uf: z.string().regex(/^[a-zA-Z]{2}$/).optional(),
  numero: opcional(20),
  complemento: opcional(100),
  mensagem: texto(10000),
});

function respostaOriginal(registro) {
  // Reenvio devolve a confirmação original, sem revelar os dados pessoais.
  return { id: registro.id, criadaEm: registro.criada_em, status: "em_analise" };
}

// Receber o pool como argumento facilita testar a rota sem iniciar o servidor.
export function criarHandlerSolicitacoes(pool) {
  return async (req, res) => {
    const chave = z.uuid().safeParse(req.get("Idempotency-Key")?.trim().toLowerCase());
    if (!chave.success) {
      return res.status(400).json({ erro: "Chave de envio ausente ou inválida." });
    }
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      return res.status(400).json({
        erro: "Dados inválidos.",
        campos: resultado.error.issues.map((issue) => issue.path.join(".")),
      });
    }

    const entrada = resultado.data;
    // Campos em ordem fixa: a comparação independe da ordem do JSON recebido.
    const dados = {
      nome: entrada.nome,
      email: entrada.email.toLowerCase(),
      telefone: entrada.telefone.replace(/\D/g, ""),
      servicoSlug: entrada.servicoSlug,
      pessoaJuridica: entrada.pessoaJuridica,
      cnpj: entrada.cnpj?.replace(/\D/g, "") || null,
      empresa: entrada.empresa || null,
      canalPreferido: entrada.canalPreferido,
      whatsappAutorizado: entrada.canalPreferido === "whatsapp" && entrada.whatsappAutorizado,
      cep: entrada.cep.replace(/\D/g, ""),
      logradouro: entrada.logradouro || null,
      bairro: entrada.bairro || null,
      cidade: entrada.cidade || null,
      uf: entrada.uf?.toUpperCase() ?? null,
      numero: entrada.numero || null,
      complemento: entrada.complemento || null,
      mensagem: entrada.mensagem,
    };
    if (dados.cep.length !== 8) {
      return res.status(400).json({ erro: "CEP inválido.", campos: ["cep"] });
    }
    if (!/^[0-9]{10,15}$/.test(dados.telefone)) {
      return res.status(400).json({ erro: "Telefone inválido.", campos: ["telefone"] });
    }
    if ((dados.pessoaJuridica && dados.cnpj?.length !== 14) ||
        (!dados.pessoaJuridica && dados.cnpj !== null)) {
      return res.status(400).json({ erro: "CNPJ incompatível com o tipo de pessoa." });
    }
    if (dados.canalPreferido === "whatsapp" && !dados.whatsappAutorizado) {
      return res.status(400).json({ erro: "É necessária autorização para contato por WhatsApp." });
    }
    const hash = createHash("sha256").update(JSON.stringify(dados)).digest("hex");
    let client;
    try {
      client = await pool.connect();
      // Cada consulta deve enxergar o envio concorrente que acabou de confirmar.
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL statement_timeout = '10s'");

      const consultarTentativa = () => client.query(
        `SELECT id, criada_em, idempotencia_hash
         FROM aw.solicitacoes_orcamento WHERE idempotencia_chave = $1`,
        [chave.data],
      );
      const responderReenvio = async (registro) => {
        await client.query("ROLLBACK");
        if (registro.idempotencia_hash !== hash) {
          return res.status(409).json({
            erro: "Esta chave de envio já foi usada com dados diferentes.",
          });
        }
        return res.status(200).json(respostaOriginal(registro));
      };

      const anterior = await consultarTentativa();
      if (anterior.rowCount > 0) return await responderReenvio(anterior.rows[0]);

      const servico = await client.query(
        "SELECT id FROM aw.servicos WHERE slug = $1 AND ativo = true",
        [dados.servicoSlug],
      );
      if (servico.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ erro: "Serviço indisponível.", campos: ["servicoSlug"] });
      }
      // A chave UNIQUE resolve também dois envios simultâneos: apenas um insere.
      // DO NOTHING evita precisar conceder UPDATE ao usuário da API.
      const insercao = await client.query(
        `INSERT INTO aw.solicitacoes_orcamento (
          servico_id, nome_contato, email_contato, telefone_contato,
          pessoa_juridica, cnpj, empresa_nome_livre,
          canal_preferido, whatsapp_autorizado_em,
          cep, logradouro, bairro, cidade, uf, numero, complemento, mensagem,
          idempotencia_chave, idempotencia_hash
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) ON CONFLICT (idempotencia_chave) DO NOTHING
        RETURNING id, criada_em`,
        [
          servico.rows[0].id, dados.nome, dados.email, dados.telefone,
          dados.pessoaJuridica, dados.cnpj, dados.empresa,
          dados.canalPreferido, dados.whatsappAutorizado ? new Date() : null,
          dados.cep, dados.logradouro, dados.bairro, dados.cidade, dados.uf,
          dados.numero, dados.complemento, dados.mensagem, chave.data, hash,
        ],
      );
      if (insercao.rowCount === 0) {
        const concorrente = await consultarTentativa();
        if (concorrente.rowCount === 0) throw new Error("Tentativa concorrente não encontrada.");
        return await responderReenvio(concorrente.rows[0]);
      }
      await client.query(
        `INSERT INTO aw.solicitacoes_eventos (solicitacao_id, tipo) VALUES ($1, 'criada')`,
        [insercao.rows[0].id],
      );
      await client.query("COMMIT");
      return res.status(201).json(respostaOriginal(insercao.rows[0]));
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      // Não imprime corpo da requisição, senha ou detalhes pessoais do PostgreSQL.
      console.error("Erro ao registrar solicitação:", { codigo: error.code ?? "interno" });
      return res.status(500).json({ erro: "Não foi possível registrar a solicitação. Tente novamente." });
    } finally {
      client?.release();
    }
  };
}
