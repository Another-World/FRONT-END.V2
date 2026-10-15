// A conexão/espera no pool já tem limite de 5 s em db.js.
// query_timeout limita esta consulta a 2 s; pool.query descarta o cliente
// em erro, inclusive timeout. A consulta não lê nem altera dados de clientes.
export function criarHandlerProntidao(pool) {
  let consultaEmAndamento;

  return async function prontidao(_req, res) {
    try {
      // Requisições simultâneas compartilham a mesma consulta ao banco.
      if (!consultaEmAndamento) {
        consultaEmAndamento = pool.query({
          text: "SELECT 1 AS pronto",
          query_timeout: 2000,
        }).then(resultado => {
          if (resultado.rows[0]?.pronto !== 1) {
            throw new Error("Resposta inesperada na verificação do banco.");
          }
        }).finally(() => { consultaEmAndamento = undefined; });
      }
      await consultaEmAndamento;
      return res.json({ status: "ok", banco: "ok" });
    } catch {
      // Nunca devolver configuração, mensagem do driver ou credenciais.
      res.set("Retry-After", "5");
      return res.status(503).json({ status: "indisponivel", banco: "indisponivel" });
    }
  };
}
