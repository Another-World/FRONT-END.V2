import { z } from "zod";
import { decodificarCursor } from "./listagemSolicitacoes.js";

const buscaSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  busca: z.string().trim().min(2).max(120).optional(),
  ativo: z.enum(["true", "false"]).optional(),
}).strict();
const pedidosSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
const negado = "Acesso restrito à equipe de atendimento.";
class FalhaHttp extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

function pagina(rows, limite, converter) {
  const registros = rows.slice(0, limite);
  const ultimo = registros.at(-1);
  return {
    registros: registros.map(converter),
    proximoCursor: rows.length > limite && ultimo
      ? Buffer.from(JSON.stringify({ id: ultimo.id, criadaEm: ultimo.cursor_criada_em })).toString("base64url")
      : null,
  };
}

function resumo(row) {
  return { id: row.id, nome: row.nome, email: row.email,
    empresa: row.empresa_nome_livre, papel: row.papel, ativo: row.ativo,
    criadoEm: row.criado_em };
}

export function criarHandlersAdminUsuarios(pool) {
  async function executar(req, res, tarefa) {
    let client;
    let descartar = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const acesso = await client.query(
        "SELECT papel, ativo FROM aw.usuarios WHERE id = $1", [req.identidade.id],
      );
      if (!acesso.rows[0]?.ativo || acesso.rows[0].papel !== "admin")
        throw new FalhaHttp(403, negado);
      const dados = await tarefa(client);
      await client.query("COMMIT");
      return res.json(dados);
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => { descartar = true; });
      if (error instanceof FalhaHttp) return res.status(error.status).json({ erro: error.message });
      console.error(JSON.stringify({ evento: "usuarios_admin_falhou", codigo: error.code ?? "interno" }));
      return res.status(error.code === "57014" ? 503 : 500)
        .json({ erro: "Não foi possível consultar os usuários. Tente novamente." });
    } finally {
      client?.release(descartar ? new Error("Falha ao encerrar consulta.") : undefined);
    }
  }

  return {
    listar(req, res) {
      let filtro, cursor;
      try { filtro = buscaSchema.parse(req.query); cursor = decodificarCursor(filtro.cursor); }
      catch { return res.status(400).json({ erro: "Filtro ou paginação inválidos." }); }
      return executar(req, res, async client => {
        const parametros = [];
        const condicoes = [];
        if (filtro.ativo !== undefined) {
          parametros.push(filtro.ativo === "true");
          condicoes.push(`u.ativo = $${parametros.length}`);
        }
        if (filtro.busca) {
          parametros.push(filtro.busca);
          condicoes.push(`(strpos(lower(u.nome), lower($${parametros.length})) > 0
            OR strpos(lower(u.email), lower($${parametros.length})) > 0)`);
        }
        if (cursor) {
          parametros.push(cursor.criadaEm, cursor.id);
          condicoes.push(`(u.criado_em, u.id) < ($${parametros.length - 1}::timestamptz, $${parametros.length}::uuid)`);
        }
        parametros.push(filtro.limite + 1);
        const resultado = await client.query(`
          SELECT u.id, u.nome, u.email, u.empresa_nome_livre, u.papel, u.ativo, u.criado_em,
            to_char(u.criado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_criada_em
          FROM aw.usuarios u ${condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : ""}
          ORDER BY u.criado_em DESC, u.id DESC LIMIT $${parametros.length}
        `, parametros);
        const p = pagina(resultado.rows, filtro.limite, resumo);
        return { usuarios: p.registros, proximoCursor: p.proximoCursor };
      });
    },

    consultar(req, res) {
      const id = z.uuid().safeParse(req.params.id);
      let filtro, cursor;
      try { filtro = pedidosSchema.parse(req.query); cursor = decodificarCursor(filtro.cursor); }
      catch { return res.status(400).json({ erro: "Filtro ou paginação inválidos." }); }
      if (!id.success) return res.status(400).json({ erro: "Usuário inválido." });
      return executar(req, res, async client => {
        const usuario = await client.query(`
          SELECT id, nome, email, telefone, empresa_nome_livre, papel, ativo, criado_em, atualizado_em
          FROM aw.usuarios WHERE id = $1
        `, [id.data]);
        if (!usuario.rows[0]) throw new FalhaHttp(404, "Usuário não encontrado.");
        const parametros = [id.data];
        const condicoes = ["s.usuario_id = $1"];
        if (cursor) {
          parametros.push(cursor.criadaEm, cursor.id);
          condicoes.push(`(s.criada_em, s.id) < ($2::timestamptz, $3::uuid)`);
        }
        parametros.push(filtro.limite + 1);
        const pedidos = await client.query(`
          SELECT s.id, s.codigo, s.status, s.criada_em, v.nome AS servico_nome,
            to_char(s.criada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_criada_em
          FROM aw.solicitacoes_orcamento s LEFT JOIN aw.servicos v ON v.id = s.servico_id
          WHERE ${condicoes.join(" AND ")}
          ORDER BY s.criada_em DESC, s.id DESC LIMIT $${parametros.length}
        `, parametros);
        const p = pagina(pedidos.rows, filtro.limite, row => ({
          id: row.id, codigo: row.codigo, status: row.status, criadaEm: row.criada_em,
          servico: row.servico_nome ?? "Serviço",
        }));
        return { usuario: { ...resumo(usuario.rows[0]), telefone: usuario.rows[0].telefone,
          atualizadoEm: usuario.rows[0].atualizado_em },
        solicitacoes: p.registros, proximoCursor: p.proximoCursor };
      });
    },
  };
}
