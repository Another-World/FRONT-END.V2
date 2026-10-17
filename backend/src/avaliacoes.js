import { z } from "zod";
import { decodificarCursor } from "./listagemSolicitacoes.js";

const semControles = (valor) =>
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(valor);
const textoOpcional = z.string().trim().max(2000).refine(semControles).default("");
const statusSchema = z.enum(["pendente", "publicada", "oculta"]);
const criarSchema = z.object({
  solicitacaoId: z.uuid(),
  nota: z.number().int().min(1).max(5),
  observacoes: textoOpcional,
  sugestoes: textoOpcional,
}).strict();
const consultaSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  nota: z.coerce.number().int().min(1).max(5).optional(),
  status: statusSchema.optional(),
}).strict();
const moderacaoSchema = z.object({
  status: z.enum(["publicada", "oculta"]),
  versao: z.number().int().min(0).max(2147483646),
  motivo: z.string().trim().min(1).max(500).refine(semControles),
  confirmado: z.literal(true),
}).strict();

class Falha extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const uuidSemConsulta = (req) =>
  z.uuid().safeParse(req.params.id).success && Object.keys(req.query).length === 0;
const nulo = (valor) => valor || null;
const isoCursor = (row) =>
  Buffer.from(JSON.stringify({ id: row.id, criadaEm: row.cursor_data })).toString("base64url");

function resumo(row) {
  return {
    id: row.id,
    solicitacaoId: row.solicitacao_id,
    nota: row.nota,
    status: row.status,
    versao: row.versao,
    cliente: { id: row.usuario_id, nome: row.usuario_nome },
    servico: { slug: row.servico_slug, nome: row.servico_nome ?? "Serviço" },
    criadaEm: row.criada_em,
    atualizadaEm: row.atualizada_em,
  };
}

function completa(row) {
  return {
    ...resumo(row),
    observacoes: row.observacoes,
    sugestoes: row.sugestoes,
    cliente: { ...resumo(row).cliente, email: row.usuario_email },
  };
}

function propria(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    solicitacaoId: row.solicitacao_id,
    nota: row.nota,
    observacoes: row.observacoes,
    sugestoes: row.sugestoes,
    status: row.status,
    criadaEm: row.criada_em,
  };
}

export function criarHandlersAvaliacoes(pool) {
  async function executar(req, res, papel, tarefa) {
    let client;
    let descartar = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL statement_timeout='10s'");
      await client.query("SET LOCAL lock_timeout='3s'");
      const conta = await client.query(
        "SELECT papel,ativo FROM aw.usuarios WHERE id=$1 FOR SHARE",
        [req.identidade.id],
      );
      if (!conta.rows[0])
        throw new Falha(404, "Abra sua Área do Cliente para sincronizar o perfil.");
      if (!conta.rows[0].ativo)
        throw new Falha(403, "Esta conta está desativada.");
      if (papel === "cliente" && conta.rows[0].papel !== "cliente")
        throw new Falha(403, "Somente clientes podem enviar avaliações.");
      if (papel === "admin" && conta.rows[0].papel !== "admin")
        throw new Falha(403, "Acesso restrito à equipe de atendimento.");
      const resultado = await tarefa(client);
      await client.query("COMMIT");
      return res.json(resultado);
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => { descartar = true; });
      if (error instanceof Falha)
        return res.status(error.status).json({ erro: error.message });
      console.error(JSON.stringify({
        evento: "avaliacao_falhou",
        codigo: error.code ?? "interno",
      }));
      return res.status(["57014", "55P03"].includes(error.code) ? 503 : 500)
        .json({ erro: "Não foi possível concluir a operação com a avaliação." });
    } finally {
      client?.release(descartar ? new Error("Falha ao encerrar transação.") : undefined);
    }
  }

  const colunas = `a.id,a.solicitacao_id,a.usuario_id,a.nota,a.observacoes,a.sugestoes,
    a.status,a.versao,a.criada_em,a.atualizada_em,u.nome AS usuario_nome,
    u.email AS usuario_email,v.slug AS servico_slug,v.nome AS servico_nome`;

  return {
    async consultarPropria(req, res) {
      if (!uuidSemConsulta(req))
        return res.status(400).json({ erro: "Solicitação inválida." });
      return executar(req, res, "cliente", async (client) => {
        const resultado = await client.query(`
          SELECT a.id,a.solicitacao_id,a.nota,a.observacoes,a.sugestoes,
            a.status,a.criada_em
          FROM aw.solicitacoes_orcamento s
          LEFT JOIN aw.avaliacoes a ON a.solicitacao_id=s.id
          WHERE s.id=$1 AND s.usuario_id=$2`, [req.params.id, req.identidade.id]);
        if (!resultado.rows[0])
          throw new Falha(404, "Solicitação não encontrada para esta conta.");
        return { avaliacao: propria(resultado.rows[0]) };
      });
    },

    async criar(req, res) {
      const entrada = criarSchema.safeParse(req.body);
      if (!entrada.success || Object.keys(req.query).length)
        return res.status(400).json({
          erro: "Informe a solicitação, uma nota de 1 a 5 e textos válidos.",
        });
      return executar(req, res, "cliente", async (client) => {
        const dados = entrada.data;
        const pedido = await client.query(`
          SELECT s.id,s.usuario_id,s.status,v.slug AS servico_slug,v.nome AS servico_nome
          FROM aw.solicitacoes_orcamento s
          LEFT JOIN aw.servicos v ON v.id=s.servico_id
          WHERE s.id=$1`, [dados.solicitacaoId]);
        const solicitacao = pedido.rows[0];
        if (!solicitacao || solicitacao.usuario_id !== req.identidade.id)
          throw new Falha(404, "Solicitação concluída não encontrada para esta conta.");
        if (solicitacao.status !== "concluida")
          throw new Falha(409, "A avaliação só pode ser enviada após a conclusão da solicitação.");

        const inserida = await client.query(`
          INSERT INTO aw.avaliacoes(solicitacao_id,usuario_id,nota,observacoes,sugestoes)
          VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(solicitacao_id) DO NOTHING
          RETURNING id,solicitacao_id,usuario_id,nota,observacoes,sugestoes,
            status,versao,criada_em,atualizada_em`, [
          solicitacao.id,
          req.identidade.id,
          dados.nota,
          nulo(dados.observacoes),
          nulo(dados.sugestoes),
        ]);
        let avaliacao = inserida.rows[0];
        if (!avaliacao) {
          avaliacao = (await client.query(
            "SELECT * FROM aw.avaliacoes WHERE solicitacao_id=$1",
            [solicitacao.id],
          )).rows[0];
          const repetida = avaliacao?.usuario_id === req.identidade.id
            && avaliacao.nota === dados.nota
            && avaliacao.observacoes === nulo(dados.observacoes)
            && avaliacao.sugestoes === nulo(dados.sugestoes);
          if (!repetida)
            throw new Falha(409, "Esta solicitação já possui uma avaliação.");
        } else {
          res.status(201);
        }
        return {
          avaliacao: {
            id: avaliacao.id,
            solicitacaoId: avaliacao.solicitacao_id,
            nota: avaliacao.nota,
            observacoes: avaliacao.observacoes,
            sugestoes: avaliacao.sugestoes,
            status: avaliacao.status,
            criadaEm: avaliacao.criada_em,
          },
        };
      });
    },

    async listar(req, res) {
      let consulta;
      let cursor;
      try {
        consulta = consultaSchema.parse(req.query);
        cursor = decodificarCursor(consulta.cursor);
      } catch {
        return res.status(400).json({ erro: "Filtro ou paginação inválidos." });
      }
      return executar(req, res, "admin", async (client) => {
        const parametros = [];
        const condicoes = [];
        if (consulta.status) {
          parametros.push(consulta.status);
          condicoes.push(`a.status=$${parametros.length}`);
        }
        if (consulta.nota) {
          parametros.push(consulta.nota);
          condicoes.push(`a.nota=$${parametros.length}`);
        }
        if (cursor) {
          parametros.push(cursor.criadaEm, cursor.id);
          condicoes.push(`(a.criada_em,a.id)<($${parametros.length - 1}::timestamptz,$${parametros.length}::uuid)`);
        }
        parametros.push(consulta.limite + 1);
        const pagina = await client.query(`
          SELECT ${colunas},
            to_char(a.criada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_data
          FROM aw.avaliacoes a
          JOIN aw.usuarios u ON u.id=a.usuario_id
          JOIN aw.solicitacoes_orcamento s ON s.id=a.solicitacao_id
          LEFT JOIN aw.servicos v ON v.id=s.servico_id
          ${condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : ""}
          ORDER BY a.criada_em DESC,a.id DESC LIMIT $${parametros.length}
        `, parametros);
        const indicadores = (await client.query(`
          SELECT count(*)::integer AS quantidade,
            round(avg(nota)::numeric,2) AS media
          FROM aw.avaliacoes`)).rows[0];
        const registros = pagina.rows.slice(0, consulta.limite);
        const ultimo = registros.at(-1);
        return {
          avaliacoes: registros.map(resumo),
          indicadores: {
            quantidade: indicadores.quantidade,
            media: indicadores.media === null ? null : Number(indicadores.media),
          },
          proximoCursor: pagina.rows.length > consulta.limite && ultimo
            ? isoCursor(ultimo) : null,
        };
      });
    },

    async consultar(req, res) {
      if (!uuidSemConsulta(req))
        return res.status(400).json({ erro: "Avaliação inválida." });
      return executar(req, res, "admin", async (client) => {
        const resultado = await client.query(`
          SELECT ${colunas}
          FROM aw.avaliacoes a
          JOIN aw.usuarios u ON u.id=a.usuario_id
          JOIN aw.solicitacoes_orcamento s ON s.id=a.solicitacao_id
          LEFT JOIN aw.servicos v ON v.id=s.servico_id
          WHERE a.id=$1`, [req.params.id]);
        if (!resultado.rows[0]) throw new Falha(404, "Avaliação não encontrada.");
        const historico = await client.query(`
          SELECT e.status_anterior,e.status_novo,e.motivo,e.criado_em,
            e.administrador_id,u.nome AS administrador_nome
          FROM aw.avaliacoes_eventos e
          JOIN aw.usuarios u ON u.id=e.administrador_id
          WHERE e.avaliacao_id=$1
          ORDER BY e.criado_em DESC,e.id DESC LIMIT 100`, [req.params.id]);
        return {
          avaliacao: completa(resultado.rows[0]),
          historico: historico.rows.map((evento) => ({
            statusAnterior: evento.status_anterior,
            statusNovo: evento.status_novo,
            motivo: evento.motivo,
            criadoEm: evento.criado_em,
            administrador: {
              id: evento.administrador_id,
              nome: evento.administrador_nome,
            },
          })),
        };
      });
    },

    async moderar(req, res) {
      const entrada = moderacaoSchema.safeParse(req.body);
      if (!uuidSemConsulta(req) || !entrada.success)
        return res.status(400).json({
          erro: "Confirme a moderação e informe status, versão e motivo válidos.",
        });
      return executar(req, res, "admin", async (client) => {
        const atual = await client.query(
          "SELECT * FROM aw.avaliacoes WHERE id=$1 FOR UPDATE",
          [req.params.id],
        );
        const avaliacao = atual.rows[0];
        if (!avaliacao) throw new Falha(404, "Avaliação não encontrada.");
        if (avaliacao.versao !== entrada.data.versao)
          throw new Falha(409, "A avaliação foi moderada em outra tela. Atualize os detalhes.");
        if (avaliacao.status === entrada.data.status)
          return { avaliacao: {
            id: avaliacao.id,
            status: avaliacao.status,
            versao: avaliacao.versao,
            atualizadaEm: avaliacao.atualizada_em,
          } };
        const alterada = (await client.query(
          "UPDATE aw.avaliacoes SET status=$2 WHERE id=$1 AND versao=$3 RETURNING *",
          [avaliacao.id, entrada.data.status, entrada.data.versao],
        )).rows[0];
        await client.query(`
          INSERT INTO aw.avaliacoes_eventos(
            avaliacao_id,administrador_id,status_anterior,status_novo,motivo
          ) VALUES($1,$2,$3,$4,$5)`, [
          avaliacao.id,
          req.identidade.id,
          avaliacao.status,
          alterada.status,
          entrada.data.motivo,
        ]);
        return { avaliacao: {
          id: alterada.id,
          status: alterada.status,
          versao: alterada.versao,
          atualizadaEm: alterada.atualizada_em,
        } };
      });
    },
  };
}
