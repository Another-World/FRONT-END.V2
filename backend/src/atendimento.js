import { z } from "zod";
import { decodificarCursor } from "./listagemSolicitacoes.js";
import { STATUS_SOLICITACOES, acoesDisponiveis, identificarAcao } from "./fluxoSolicitacoes.js";
import { registrarDecisao } from "./emails.js";

const statusSchema = z.enum(STATUS_SOLICITACOES);
const consultaSchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  status: statusSchema.optional(),
  busca: z.string().trim().min(2).max(120).optional(),
}).strict();
const alteracaoSchema = z.object({
  status: statusSchema,
  versao: z.number().int().min(0).max(2147483646),
  confirmado: z.boolean().optional(),
}).strict();
const acessoNegado = "Acesso restrito à equipe de atendimento.";

class FalhaHttp extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

export function criarAutorizacaoAdmin(pool) {
  return async (req, res, next) => {
    const r = await pool.query("SELECT papel, ativo FROM aw.usuarios WHERE id = $1", [req.identidade.id]);
    if (!r.rows[0]?.ativo || r.rows[0].papel !== "admin") {
      return res.status(403).json({ erro: acessoNegado });
    }
    return next();
  };
}

function resumo(row) {
  return {
    id: row.id, codigo: row.codigo, status: row.status, versao: row.versao_status,
    nomeContato: row.nome_contato,
    servico: { slug: row.servico_slug, nome: row.servico_nome ?? "Serviço" },
    criadaEm: row.criada_em, atualizadaEm: row.atualizada_em,
  };
}
const colunasResumo = `s.id, s.codigo, s.status, s.versao_status, s.nome_contato, s.criada_em, s.atualizada_em,
  v.slug AS servico_slug, v.nome AS servico_nome`;

function estado(row) {
  return { id: row.id, codigo: row.codigo, status: row.status, versao: row.versao_status,
    atualizadaEm: row.atualizada_em, acoesDisponiveis: acoesDisponiveis(row.status) };
}

export function criarHandlersAtendimento(pool, { emailsEnabled = false } = {}) {
  async function executar(req, res, tarefa) {
    let client;
    let descartar = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL lock_timeout = '3s'");
      // Revalidar dentro da transação e impedir revogação durante a operação.
      // O lock de perfil precede sempre o lock do pedido.
      const conta = await client.query(
        "SELECT papel, ativo FROM aw.usuarios WHERE id = $1 FOR SHARE", [req.identidade.id],
      );
      if (!conta.rows[0]?.ativo || conta.rows[0].papel !== "admin") {
        throw new FalhaHttp(403, acessoNegado);
      }
      const dados = await tarefa(client);
      await client.query("COMMIT");
      return res.json(dados);
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => { descartar = true; });
      if (error instanceof FalhaHttp) return res.status(error.status).json({ erro: error.message });
      console.error(JSON.stringify({ evento: "atendimento_falhou", codigo: error.code ?? "interno" }));
      const temporario = error.code === "57014" || error.code === "55P03";
      return res.status(temporario ? 503 : 500).json({ erro: "Não foi possível concluir o atendimento. Tente novamente." });
    } finally {
      client?.release(descartar ? new Error("Falha ao encerrar transação.") : undefined);
    }
  }

  return {
    async listar(req, res) {
      let consulta;
      let cursor;
      try {
        consulta = consultaSchema.parse(req.query);
        cursor = decodificarCursor(consulta.cursor);
      } catch {
        return res.status(400).json({ erro: "Filtro ou paginação inválidos." });
      }
      return executar(req, res, async client => {
        const parametros = [];
        const condicoes = [];
        if (consulta.status) {
          parametros.push(consulta.status);
          condicoes.push(`s.status = $${parametros.length}`);
        }
        if (consulta.busca) {
          parametros.push(consulta.busca);
          // Busca literal: %, _ e aspas não viram padrões nem comandos SQL.
          condicoes.push(`(strpos(lower(s.nome_contato), lower($${parametros.length})) > 0
            OR strpos(lower(s.codigo), lower($${parametros.length})) > 0)`);
        }
        if (cursor) {
          parametros.push(cursor.criadaEm, cursor.id);
          condicoes.push(`(s.criada_em, s.id) < ($${parametros.length - 1}::timestamptz, $${parametros.length}::uuid)`);
        }
        parametros.push(consulta.limite + 1);
        const pagina = await client.query(`
          SELECT ${colunasResumo},
            to_char(s.criada_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_criada_em
          FROM aw.solicitacoes_orcamento s LEFT JOIN aw.servicos v ON v.id = s.servico_id
          ${condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : ""}
          ORDER BY s.criada_em DESC, s.id DESC LIMIT $${parametros.length}
        `, parametros);
        const registros = pagina.rows.slice(0, consulta.limite);
        const ultimo = registros.at(-1);
        return {
          solicitacoes: registros.map(resumo),
          proximoCursor: pagina.rows.length > consulta.limite && ultimo
            ? Buffer.from(JSON.stringify({ id: ultimo.id, criadaEm: ultimo.cursor_criada_em })).toString("base64url") : null,
        };
      });
    },

    async consultar(req, res) {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success || Object.keys(req.query).length) return res.status(400).json({ erro: "Identificador da solicitação inválido." });
      return executar(req, res, async client => {
        const r = await client.query(`
          SELECT ${colunasResumo}, s.email_contato, s.telefone_contato, s.pessoa_juridica,
            s.cnpj, s.empresa_nome_livre, s.canal_preferido, s.whatsapp_autorizado_em,
            s.cep, s.logradouro, s.bairro, s.cidade, s.uf, s.numero, s.complemento, s.mensagem
          FROM aw.solicitacoes_orcamento s LEFT JOIN aw.servicos v ON v.id = s.servico_id
          WHERE s.id = $1
        `, [id.data]);
        const row = r.rows[0];
        if (!row) throw new FalhaHttp(404, "Solicitação não encontrada.");
        const historico = await client.query(`
          SELECT tipo, detalhes, criado_em FROM aw.solicitacoes_eventos
          WHERE solicitacao_id = $1 ORDER BY criado_em DESC, id DESC LIMIT 50
        `, [id.data]);
        return {
          solicitacao: {
            ...resumo(row), acoesDisponiveis: acoesDisponiveis(row.status), mensagem: row.mensagem,
            contato: {
              email: row.email_contato, telefone: row.telefone_contato,
              pessoaJuridica: row.pessoa_juridica, cnpj: row.cnpj, empresa: row.empresa_nome_livre,
              canalPreferido: row.canal_preferido,
              whatsappAutorizado: row.canal_preferido === "whatsapp" && Boolean(row.whatsapp_autorizado_em),
            },
            endereco: {
              cep: row.cep, logradouro: row.logradouro, bairro: row.bairro, cidade: row.cidade,
              uf: row.uf, numero: row.numero, complemento: row.complemento,
            },
          },
          historico: historico.rows.map(row => ({ tipo: row.tipo, detalhes: row.detalhes, criadoEm: row.criado_em })),
        };
      });
    },

    async atualizarStatus(req, res) {
      const id = z.uuid().safeParse(req.params.id);
      const entrada = alteracaoSchema.safeParse(req.body);
      if (!id.success || !entrada.success || Object.keys(req.query).length) {
        return res.status(400).json({ erro: "Informe uma solicitação, status e versão válidos. Só o status pode ser alterado." });
      }
      return executar(req, res, async client => {
        const anterior = await client.query(`
          SELECT id, codigo, status, versao_status, atualizada_em, nome_contato, email_contato FROM aw.solicitacoes_orcamento
          WHERE id = $1 FOR UPDATE
        `, [id.data]);
        const row = anterior.rows[0];
        if (!row) throw new FalhaHttp(404, "Solicitação não encontrada.");
        if (row.versao_status !== entrada.data.versao) {
          throw new FalhaHttp(409, "Este pedido foi alterado por outra operação. Atualize os detalhes antes de salvar.");
        }
        if (row.status === entrada.data.status) {
          return { solicitacao: estado(row) };
        }
        const acao = acoesDisponiveis(row.status).find(item => item.status === entrada.data.status);
        if (!acao) {
          throw new FalhaHttp(409, "Esta mudança de status não é permitida. Atualize os detalhes e escolha uma ação disponível.");
        }
        if (acao.confirmacao && entrada.data.confirmado !== true) {
          throw new FalhaHttp(400, "Confirme a decisão antes de alterar o status.");
        }
        const atualizado = await client.query(`
          UPDATE aw.solicitacoes_orcamento SET status = $2
          WHERE id = $1 AND versao_status = $3 RETURNING id, codigo, status, versao_status, atualizada_em
        `, [id.data, entrada.data.status, entrada.data.versao]);
        await client.query(`
          INSERT INTO aw.solicitacoes_eventos (solicitacao_id, tipo, detalhes)
          VALUES ($1, 'status_alterado', $2::jsonb)
        `, [id.data, JSON.stringify({
          administradorId: req.identidade.id, statusAnterior: row.status, statusNovo: entrada.data.status,
          versaoAnterior: row.versao_status, versaoNova: atualizado.rows[0].versao_status,
          acao: identificarAcao(row.status, entrada.data.status),
          ...(acao.confirmacao ? { confirmado: true } : {}),
        })]);
        const novo = atualizado.rows[0];
        if (emailsEnabled)
          await registrarDecisao(client, { ...row, versao_status: novo.versao_status }, novo.status);
        return { solicitacao: estado(novo) };
      });
    },
  };
}
