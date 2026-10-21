const acessoNegado = "Acesso restrito à equipe de atendimento.";

class FalhaHttp extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

function resumirSolicitacao(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    status: row.status,
    nomeContato: row.nome_contato,
    servico: row.servico_nome ?? "Serviço",
    criadaEm: row.criada_em,
  };
}

export function criarHandlerDashboard(pool) {
  return async (req, res) => {
    let client;
    let descartar = false;
    try {
      if (Object.keys(req.query).length) {
        return res.status(400).json({ erro: "Esta consulta não aceita filtros." });
      }
      client = await pool.connect();
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const acesso = await client.query(
        "SELECT papel, ativo FROM aw.usuarios WHERE id = $1", [req.identidade.id],
      );
      if (!acesso.rows[0]?.ativo || acesso.rows[0].papel !== "admin") {
        throw new FalhaHttp(403, acessoNegado);
      }

      const solicitacoes = await client.query(`
          SELECT count(*)::integer AS total,
            count(*) FILTER (WHERE status = 'em_analise')::integer AS em_analise,
            count(*) FILTER (WHERE status = 'aceito')::integer AS aceitas_para_orcamento,
            count(*) FILTER (WHERE status = 'negado')::integer AS recusadas
          FROM aw.solicitacoes_orcamento
        `);
      const orcamentos = await client.query(`
          SELECT count(*)::integer AS em_andamento
          FROM aw.orcamentos
          WHERE status IN ('rascunho', 'aguardando_envio', 'enviada')
        `);
      const recentes = await client.query(`
          SELECT s.id, s.codigo, s.status, s.nome_contato, s.criada_em, v.nome AS servico_nome
          FROM aw.solicitacoes_orcamento s
          LEFT JOIN aw.servicos v ON v.id = s.servico_id
          ORDER BY s.criada_em DESC, s.id DESC
          LIMIT 5
        `);
      await client.query("COMMIT");
      return res.json({
        indicadores: {
          totalSolicitacoes: solicitacoes.rows[0].total,
          emAnalise: solicitacoes.rows[0].em_analise,
          aceitasParaOrcamento: solicitacoes.rows[0].aceitas_para_orcamento,
          recusadas: solicitacoes.rows[0].recusadas,
          orcamentosEmAndamento: orcamentos.rows[0].em_andamento,
        },
        solicitacoesRecentes: recentes.rows.map(resumirSolicitacao),
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => { descartar = true; });
      if (error instanceof FalhaHttp) return res.status(error.status).json({ erro: error.message });
      console.error(JSON.stringify({ evento: "dashboard_falhou", codigo: error.code ?? "interno" }));
      return res.status(error.code === "57014" ? 503 : 500)
        .json({ erro: "Não foi possível carregar o dashboard. Tente novamente." });
    } finally {
      client?.release(descartar ? new Error("Falha ao encerrar consulta.") : undefined);
    }
  };
}
