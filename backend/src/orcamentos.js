import { z } from "zod";
import { decodificarCursor } from "./listagemSolicitacoes.js";
import { gerarPropostaPdf } from "./propostaPdf.js";
import { registrarProposta } from "./emails.js";

const texto = (max) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s));
const dataSchema = z.iso.date().nullable();
const campos = z
  .object({
    descricao: texto(500),
    escopo: texto(6000),
    valorCentavos: z.number().int().min(1).max(1000000000),
    prazo: texto(200),
    condicoes: z.string().trim().max(4000).default(""),
    validade: dataSchema.default(null),
  })
  .strict();
const versao = z.number().int().min(0).max(2147483646);
const consultaSchema = z
  .object({
    limite: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(512).optional(),
    status: z.enum(["rascunho", "aguardando_envio", "enviada", "aceita", "recusada"]).optional(),
    solicitacaoId: z.uuid().optional(),
  })
  .strict();
const criarSchema = campos.extend({ solicitacaoId: z.uuid() });
const editarSchema = campos.extend({ versao });
const acaoSchema = z
  .object({
    status: z.enum(["enviada", "aceita", "recusada"]),
    versao,
    confirmado: z.literal(true),
    nota: texto(1000).optional(),
  })
  .strict();
const emailSchema = z.object({ versao, confirmado: z.literal(true) }).strict();
class Falha extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const semConsulta = (req) => Object.keys(req.query).length === 0;
const idValido = (req) =>
  z.uuid().safeParse(req.params.id).success && semConsulta(req);
const hoje = () => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const dataIso = (d) =>
  d == null
    ? null
    : typeof d === "string"
      ? d.slice(0, 10)
      : d.toISOString().slice(0, 10);
function comercial(r) {
  return {
    descricao: r.descricao,
    escopo: r.escopo,
    valorCentavos: r.valor_centavos,
    prazo: r.prazo,
    condicoes: r.condicoes,
    validade: dataIso(r.validade),
  };
}
function detalhe(r) {
  return {
    id: r.id,
    solicitacaoId: r.solicitacao_id,
    cliente: r.cliente,
    ...comercial(r),
    status: r.status,
    versao: r.versao,
    criadaEm: r.criada_em,
    atualizadaEm: r.atualizada_em,
    enviadaEm: r.enviada_em,
    respondidaEm: r.respondida_em,
    respostaNota: r.resposta_nota,
  };
}
function iguais(r, d) {
  return (
    JSON.stringify(comercial(r)) ===
    JSON.stringify({
      descricao: d.descricao,
      escopo: d.escopo,
      valorCentavos: d.valorCentavos,
      prazo: d.prazo,
      condicoes: d.condicoes,
      validade: d.validade,
    })
  );
}
function validarValidade(d) {
  if (d.validade && d.validade < hoje())
    throw new Falha(
      400,
      "A validade não pode estar no passado (horário de Brasília).",
    );
}
let pdfsAtivos = 0;
export function criarHandlersOrcamentos(pool, { emailsEnabled = false } = {}) {
  async function executar(req, res, tarefa, pdf = false) {
    let client,
      descartar = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL statement_timeout='10s'");
      await client.query("SET LOCAL lock_timeout='3s'");
      const a = await client.query(
        "SELECT papel,ativo FROM aw.usuarios WHERE id=$1 FOR SHARE",
        [req.identidade.id],
      );
      if (!a.rows[0]?.ativo || a.rows[0].papel !== "admin")
        throw new Falha(403, "Acesso restrito à equipe de atendimento.");
      const result = await tarefa(client);
      await client.query("COMMIT");
      client.release();
      client = null;
      if (!pdf) return res.json(result);
      // Renderização fora da transação: nenhum lock fica preso ao gerar PDF.
      if (pdfsAtivos >= 2)
        throw new Falha(503, "Geração de PDF ocupada. Tente novamente.");
      pdfsAtivos++;
      try {
        const bytes = await gerarPropostaPdf(result);
        return res
          .type("application/pdf")
          .set(
            "Content-Disposition",
            `inline; filename="proposta-${result.id}-v${result.versao}.pdf"`,
          )
          .send(bytes);
      } finally {
        pdfsAtivos--;
      }
    } catch (e) {
      if (client)
        await client.query("ROLLBACK").catch(() => {
          descartar = true;
        });
      if (e instanceof Falha)
        return res.status(e.status).json({ erro: e.message });
      if (e.code === "23505")
        return res
          .status(409)
          .json({
            erro: "Já existe um rascunho para esta solicitação. Atualize a lista.",
          });
      console.error(
        JSON.stringify({
          evento: "orcamento_falhou",
          codigo: e.code ?? "interno",
        }),
      );
      return res
        .status(["57014", "55P03"].includes(e.code) ? 503 : 500)
        .json({
          erro: "Não foi possível concluir o orçamento. Atualize antes de tentar novamente.",
        });
    } finally {
      client?.release(
        descartar ? new Error("Falha ao encerrar transação.") : undefined,
      );
    }
  }
  async function pedido(c, id, exigirAceito = false) {
    // Ordem global: perfil -> solicitação -> orçamento.
    const r = await c.query(
      "SELECT id,usuario_id,status,nome_contato,email_contato,telefone_contato,empresa_nome_livre FROM aw.solicitacoes_orcamento WHERE id=$1 FOR SHARE",
      [id],
    );
    if (!r.rows[0]) throw new Falha(404, "Solicitação não encontrada.");
    if (exigirAceito && r.rows[0].status !== "aceito")
      throw new Falha(
        409,
        "Somente solicitações aceitas podem criar, editar ou enviar propostas.",
      );
    return r.rows[0];
  }
  async function travar(c, id) {
    const ref = await c.query(
      "SELECT solicitacao_id FROM aw.orcamentos WHERE id=$1",
      [id],
    );
    if (!ref.rows[0]) throw new Falha(404, "Orçamento não encontrado.");
    const s = await pedido(c, ref.rows[0].solicitacao_id);
    const r = await c.query(
      "SELECT * FROM aw.orcamentos WHERE id=$1 FOR UPDATE",
      [id],
    );
    return { o: r.rows[0], s };
  }
  async function evento(c, req, o, tipo, extra = {}) {
    await c.query(
      "INSERT INTO aw.orcamentos_eventos(orcamento_id,tipo,detalhes) VALUES($1,$2,$3::jsonb)",
      [
        o.id,
        tipo,
        JSON.stringify({
          administradorId: req.identidade.id,
          versao: o.versao,
          ...extra,
        }),
      ],
    );
  }
  return {
    async listar(req, res) {
      let q, cursor;
      try {
        q = consultaSchema.parse(req.query);
        cursor = decodificarCursor(q.cursor);
      } catch {
        return res.status(400).json({ erro: "Filtro ou paginação inválidos." });
      }
      return executar(req, res, async (c) => {
        const p = [],
          w = [];
        for (const [valor, coluna] of [
          [q.status, "status"],
          [q.solicitacaoId, "solicitacao_id"],
        ])
          if (valor) {
            p.push(valor);
            w.push(`${coluna}=$${p.length}`);
          }
        if (cursor) {
          p.push(cursor.criadaEm, cursor.id);
          w.push(
            `(criada_em,id)<($${p.length - 1}::timestamptz,$${p.length}::uuid)`,
          );
        }
        p.push(q.limite + 1);
        const r = await c.query(
          `SELECT id,solicitacao_id,status,versao,descricao,valor_centavos,criada_em,
          to_char(criada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_data
          FROM aw.orcamentos ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY criada_em DESC,id DESC LIMIT $${p.length}`,
          p,
        );
        const rows = r.rows.slice(0, q.limite),
          last = rows.at(-1);
        return {
          orcamentos: rows.map((o) => ({
            id: o.id,
            solicitacaoId: o.solicitacao_id,
            status: o.status,
            versao: o.versao,
            descricao: o.descricao,
            valorCentavos: o.valor_centavos,
            criadaEm: o.criada_em,
          })),
          proximoCursor:
            r.rows.length > q.limite && last
              ? Buffer.from(
                  JSON.stringify({ id: last.id, criadaEm: last.cursor_data }),
                ).toString("base64url")
              : null,
        };
      });
    },
    async consultar(req, res) {
      if (!idValido(req))
        return res.status(400).json({ erro: "Orçamento inválido." });
      return executar(req, res, async (c) => {
        const r = await c.query("SELECT * FROM aw.orcamentos WHERE id=$1", [
          req.params.id,
        ]);
        if (!r.rows[0]) throw new Falha(404, "Orçamento não encontrado.");
        const h = await c.query(
          "SELECT tipo,detalhes,criado_em FROM aw.orcamentos_eventos WHERE orcamento_id=$1 ORDER BY criado_em DESC,id DESC LIMIT 100",
          [req.params.id],
        );
        const e = await c.query(`
          SELECT id,status,tentativas,ultimo_erro,criada_em,enviada_em
          FROM aw.comunicacoes WHERE orcamento_id=$1 AND tipo='proposta'
          ORDER BY criada_em DESC LIMIT 1`, [req.params.id]);
        return {
          orcamento: detalhe(r.rows[0]),
          emailDisponivel: emailsEnabled,
          email: e.rows[0] ? {
            id: e.rows[0].id, status: e.rows[0].status,
            tentativas: e.rows[0].tentativas, erro: e.rows[0].ultimo_erro,
            criadaEm: e.rows[0].criada_em, enviadaEm: e.rows[0].enviada_em,
          } : null,
          historico: h.rows.map((e) => ({
            tipo: e.tipo,
            detalhes: e.detalhes,
            criadoEm: e.criado_em,
          })),
        };
      });
    },
    async criar(req, res) {
      const v = criarSchema.safeParse(req.body),
        key = z.uuid().safeParse(req.get("Idempotency-Key"));
      if (!v.success || !key.success || !semConsulta(req))
        return res
          .status(400)
          .json({
            erro: "Preencha os campos obrigatórios e informe uma chave de envio válida.",
          });
      const d = v.data;
      return executar(req, res, async (c) => {
        validarValidade(d);
        const s = await pedido(c, d.solicitacaoId, true);
        const existente = await c.query(
          "SELECT * FROM aw.orcamentos WHERE id=$1",
          [key.data],
        );
        if (existente.rows[0]) {
          if (
            existente.rows[0].solicitacao_id !== s.id ||
            !iguais(existente.rows[0], d)
          )
            throw new Falha(
              409,
              "Chave de envio já usada com outros dados. Consulte os orçamentos existentes.",
            );
          return { orcamento: detalhe(existente.rows[0]) };
        }
        const cliente = {
          nome: s.nome_contato,
          email: s.email_contato,
          telefone: s.telefone_contato,
          empresa: s.empresa_nome_livre,
        };
        const r = await c.query(
          `INSERT INTO aw.orcamentos(id,solicitacao_id,usuario_id,cliente,descricao,escopo,valor_centavos,prazo,condicoes,validade)
          VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING *`,
          [
            key.data,
            s.id,
            s.usuario_id,
            JSON.stringify(cliente),
            d.descricao,
            d.escopo,
            d.valorCentavos,
            d.prazo,
            d.condicoes,
            d.validade,
          ],
        );
        let o = r.rows[0];
        if (!o) {
          o = (
            await c.query("SELECT * FROM aw.orcamentos WHERE id=$1", [key.data])
          ).rows[0];
          if (!o || o.solicitacao_id !== s.id || !iguais(o, d))
            throw new Falha(
              409,
              "Envio concorrente com dados diferentes. Atualize a lista.",
            );
        } else await evento(c, req, o, "rascunho_criado");
        return { orcamento: detalhe(o) };
      });
    },
    async editar(req, res) {
      const v = editarSchema.safeParse(req.body);
      if (!idValido(req) || !v.success)
        return res
          .status(400)
          .json({ erro: "Informe os campos comerciais e a versão válida." });
      return executar(req, res, async (c) => {
        const { o, s } = await travar(c, req.params.id),
          d = v.data;
        if (o.versao !== d.versao)
          throw new Falha(
            409,
            "Orçamento alterado por outra operação. Reabra os detalhes.",
          );
        if (o.status !== "rascunho" || s.status !== "aceito")
          throw new Falha(
            409,
            "Somente rascunhos de solicitações aceitas podem ser editados.",
          );
        validarValidade(d);
        if (iguais(o, d)) return { orcamento: detalhe(o) };
        const r = await c.query(
          `UPDATE aw.orcamentos SET descricao=$2,escopo=$3,valor_centavos=$4,prazo=$5,condicoes=$6,validade=$7 WHERE id=$1 RETURNING *`,
          [
            o.id,
            d.descricao,
            d.escopo,
            d.valorCentavos,
            d.prazo,
            d.condicoes,
            d.validade,
          ],
        );
        await evento(c, req, r.rows[0], "rascunho_editado");
        return { orcamento: detalhe(r.rows[0]) };
      });
    },
    async status(req, res) {
      const v = acaoSchema.safeParse(req.body);
      if (!idValido(req) || !v.success)
        return res
          .status(400)
          .json({ erro: "Confirme a ação e informe a versão válida." });
      return executar(req, res, async (c) => {
        const { o, s } = await travar(c, req.params.id),
          d = v.data;
        if (o.versao !== d.versao)
          throw new Falha(
            409,
            "Orçamento alterado por outra operação. Reabra os detalhes.",
          );
        if (d.status === "enviada") {
          if (
            d.nota !== undefined ||
            o.status !== "rascunho" ||
            s.status !== "aceito"
          )
            throw new Falha(
              409,
              "Somente rascunhos de solicitações aceitas podem ser marcados como enviados.",
            );
          validarValidade({ validade: dataIso(o.validade) });
        } else if (o.status !== "enviada" || !d.nota)
          throw new Falha(
            409,
            "Registre a origem da resposta para uma proposta enviada.",
          );
        const r = await c.query(
          "UPDATE aw.orcamentos SET status=$2,resposta_nota=$3 WHERE id=$1 RETURNING *",
          [o.id, d.status, d.nota ?? null],
        );
        await evento(
          c,
          req,
          r.rows[0],
          d.status === "enviada"
            ? "envio_manual_confirmado"
            : "resposta_registrada",
          {
            statusAnterior: o.status,
            statusNovo: d.status,
            confirmado: true,
            origem: "registro_manual",
            ...(d.nota ? { nota: d.nota } : {}),
          },
        );
        return { orcamento: detalhe(r.rows[0]) };
      });
    },
    async enviarEmail(req, res) {
      if (!emailsEnabled) return res.status(503).json({ erro: "Envio de e-mails ainda não está configurado." });
      const v = emailSchema.safeParse(req.body);
      if (!idValido(req) || !v.success)
        return res.status(400).json({ erro: "Confirme o envio por e-mail e informe a versão." });
      return executar(req, res, async (c) => {
        const { o, s } = await travar(c, req.params.id);
        if (o.versao !== v.data.versao)
          throw new Falha(409, "Orçamento alterado. Reabra os detalhes.");
        if (o.status !== "rascunho" || s.status !== "aceito")
          throw new Falha(409, "Somente rascunhos de solicitações aceitas podem ser enviados.");
        validarValidade({ validade: dataIso(o.validade) });
        const r = await c.query(
          "UPDATE aw.orcamentos SET status='aguardando_envio' WHERE id=$1 RETURNING *",
          [o.id]);
        await registrarProposta(c, r.rows[0]);
        await evento(c, req, r.rows[0], "email_solicitado", { confirmado: true });
        return { orcamento: detalhe(r.rows[0]) };
      });
    },
    async pdf(req, res) {
      if (!idValido(req))
        return res.status(400).json({ erro: "Orçamento inválido." });
      return executar(
        req,
        res,
        async (c) => {
          const r = await c.query("SELECT * FROM aw.orcamentos WHERE id=$1", [
            req.params.id,
          ]);
          if (!r.rows[0]) throw new Falha(404, "Orçamento não encontrado.");
          return detalhe(r.rows[0]);
        },
        true,
      );
    },
  };
}
