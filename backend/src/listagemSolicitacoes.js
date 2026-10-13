import { z } from "zod";

const consultaSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
const cursorSchema = z.object({
  id: z.uuid(),
  criadaEm: z.iso.datetime({ precision: 6 }),
}).strict();

function decodificarCursor(valor) {
  if (!valor) return null;
  return cursorSchema.parse(JSON.parse(Buffer.from(valor, "base64url").toString("utf8")));
}

export function criarHandlerListagemSolicitacoes(pool) {
  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    let consulta;
    let cursor;
    try {
      consulta = consultaSchema.parse(req.query);
      cursor = decodificarCursor(consulta.cursor);
    } catch {
      return res.status(400).json({ erro: "Parâmetros de consulta inválidos." });
    }

    const usuarioId = req.identidade.id;
    const conta = await pool.query("SELECT ativo FROM aw.usuarios WHERE id = $1", [usuarioId]);
    if (!conta.rows[0]) {
      return res.status(404).json({ erro: "Abra sua Área do Cliente para sincronizar o perfil." });
    }
    if (!conta.rows[0].ativo) {
      return res.status(403).json({ erro: "Sua conta está desativada. Entre em contato com a Another World." });
    }

    // Nenhum UUID/e-mail do navegador define o dono. O cursor só delimita
    // a página dentro das solicitações do UUID autenticado.
    const parametros = cursor
      ? [usuarioId, cursor.criadaEm, cursor.id, consulta.limite + 1]
      : [usuarioId, consulta.limite + 1];
    const pagina = await pool.query(`
      SELECT s.id, s.status, s.criada_em, s.atualizada_em,
        to_char(s.criada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_criada_em,
        v.slug AS servico_slug, v.nome AS servico_nome
      FROM aw.solicitacoes_orcamento s
      LEFT JOIN aw.servicos v ON v.id = s.servico_id
      JOIN aw.usuarios u ON u.id = s.usuario_id AND u.ativo
      WHERE s.usuario_id = $1
        ${cursor ? "AND (s.criada_em, s.id) < ($2::timestamptz, $3::uuid)" : ""}
      ORDER BY s.criada_em DESC, s.id DESC
      LIMIT ${cursor ? "$4" : "$2"}
    `, parametros);
    const registros = pagina.rows.slice(0, consulta.limite);
    const ultimo = registros.at(-1);
    const proximoCursor = pagina.rows.length > consulta.limite && ultimo
      ? Buffer.from(JSON.stringify({ id: ultimo.id, criadaEm: ultimo.cursor_criada_em })).toString("base64url")
      : null;

    return res.json({
      solicitacoes: registros.map(row => ({
        id: row.id,
        status: row.status,
        servico: { slug: row.servico_slug, nome: row.servico_nome ?? "Serviço" },
        criadaEm: row.criada_em,
        atualizadaEm: row.atualizada_em,
      })),
      proximoCursor,
    });
  };
}
