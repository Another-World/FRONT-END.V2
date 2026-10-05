import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}
if (!process.env.PGUSER || !process.env.PGPASSWORD) {
  throw new Error("Defina PGUSER e PGPASSWORD no ambiente.");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "16kb" }));

const texto = (limite) => z.string().trim().min(1).max(limite);
const opcional = (limite) => z.string().trim().max(limite).optional();

const solicitacaoSchema = z.strictObject({
  nome: texto(120),
  email: z.email().max(254),
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

// Esta rota confirma apenas que o servidor está funcionando.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Solicitações anônimas são permitidas. Não recebemos usuario_id do navegador.
app.post("/api/solicitacoes", async (req, res) => {
  const resultado = solicitacaoSchema.safeParse(req.body);
  if (!resultado.success) {
    return res.status(400).json({
      erro: "Dados inválidos.",
      campos: resultado.error.issues.map((issue) => issue.path.join(".")),
    });
  }

  const dados = resultado.data;
  const cep = dados.cep.replace(/\D/g, "");
  const cnpj = dados.cnpj?.replace(/\D/g, "") || null;
  if (cep.length !== 8) {
    return res.status(400).json({ erro: "CEP inválido." });
  }
  if (
    (dados.pessoaJuridica && cnpj?.length !== 14) ||
    (!dados.pessoaJuridica && cnpj !== null)
  ) {
    return res.status(400).json({ erro: "CNPJ incompatível com o tipo de pessoa." });
  }
  if (dados.canalPreferido === "whatsapp" && !dados.whatsappAutorizado) {
    return res.status(400).json({
      erro: "É necessária autorização para contato por WhatsApp.",
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const servico = await client.query(
      "SELECT id FROM aw.servicos WHERE slug = $1 AND ativo = true",
      [dados.servicoSlug],
    );
    if (servico.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro: "Serviço indisponível." });
    }

    // Parâmetros evitam concatenar os dados do cliente ao SQL.
    const insercao = await client.query(
      `INSERT INTO aw.solicitacoes_orcamento (
        servico_id, nome_contato, email_contato, telefone_contato,
        pessoa_juridica, cnpj, empresa_nome_livre,
        canal_preferido, whatsapp_autorizado_em,
        cep, logradouro, bairro, cidade, uf, numero, complemento, mensagem
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING id, criada_em`,
      [
        servico.rows[0].id,
        dados.nome,
        dados.email.trim().toLowerCase(),
        dados.telefone,
        dados.pessoaJuridica,
        cnpj,
        dados.empresa || null,
        dados.canalPreferido,
        dados.canalPreferido === "whatsapp" ? new Date() : null,
        cep,
        dados.logradouro || null,
        dados.bairro || null,
        dados.cidade || null,
        dados.uf?.toUpperCase() ?? null,
        dados.numero || null,
        dados.complemento || null,
        dados.mensagem,
      ],
    );
    // Solicitação e histórico são gravados na mesma transação.
    await client.query(
      `INSERT INTO aw.solicitacoes_eventos (solicitacao_id, tipo)
       VALUES ($1, 'criada')`,
      [insercao.rows[0].id],
    );
    await client.query("COMMIT");
    return res.status(201).json({
      id: insercao.rows[0].id,
      criadaEm: insercao.rows[0].criada_em,
      status: "em_analise",
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Erro ao criar solicitação:", error);
    return res.status(500).json({ erro: "Não foi possível registrar a solicitação." });
  } finally {
    client?.release();
  }
});

// Responde em JSON quando o corpo enviado não é um JSON válido.
app.use((error, _req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ erro: "Solicitação excede o tamanho permitido." });
  }
  next(error);
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API disponível em http://127.0.0.1:${port}`);
});
