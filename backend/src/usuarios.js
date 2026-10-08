import { z } from "zod";

// Apenas estes campos podem ser alterados pelo cliente.
// strict() rejeita id, email, papel, ativo ou qualquer campo extra.
const perfilSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  telefone: z.string().trim().max(25).regex(/^[0-9\s()+.-]*$/).nullable().transform((valor) => {
    if (!valor) return null;
    return valor.replace(/\D/g, "") || null;
  }).refine((valor) => valor === null || /^[0-9]{10,15}$/.test(valor)),
  empresa: z.string().trim().max(160).nullable().transform((valor) => valor || null),
}).strict();

const colunas = "id, nome, email, telefone, empresa_nome_livre, papel, ativo, criado_em, atualizado_em";

function exibirPerfil(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    empresa: row.empresa_nome_livre,
    papel: row.papel,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function responderPerfil(res, row) {
  if (!row) return res.status(404).json({ erro: "Perfil não encontrado. Recarregue a página para sincronizar sua conta." });
  if (!row.ativo) return res.status(403).json({ erro: "Sua conta está desativada. Entre em contato com a Another World." });
  return res.json({ perfil: exibirPerfil(row) });
}

export function criarHandlersUsuarios(pool) {
  return {
    async sincronizar(req, res) {
      const { id, nome, email } = req.identidade;
      // O UUID e o e-mail vêm exclusivamente do JWT verificado.
      // Em contas existentes, preservar nome, telefone e empresa editados.
      // papel/ativo recebem os padrões do banco e não são escritos pela API.
      const resultado = await pool.query(`
        INSERT INTO aw.usuarios (id, nome, email)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
          WHERE aw.usuarios.ativo AND aw.usuarios.email IS DISTINCT FROM EXCLUDED.email
        RETURNING ${colunas}
      `, [id, nome, email]);
      const row = resultado.rows[0] ?? (await pool.query(
        `SELECT ${colunas} FROM aw.usuarios WHERE id = $1`, [id],
      )).rows[0];
      return responderPerfil(res, row);
    },

    async consultar(req, res) {
      // Nenhum UUID enviado por URL/body/query muda o dono da consulta.
      const resultado = await pool.query(
        `SELECT ${colunas} FROM aw.usuarios WHERE id = $1`, [req.identidade.id],
      );
      return responderPerfil(res, resultado.rows[0]);
    },

    async atualizar(req, res) {
      const resultado = perfilSchema.safeParse(req.body);
      if (!resultado.success) {
        return res.status(400).json({
          erro: "Confira nome, telefone e empresa. Só esses campos podem ser editados.",
          campos: [...new Set(resultado.error.issues.flatMap((issue) => issue.path.slice(0, 1)))],
        });
      }
      const { nome, telefone, empresa } = resultado.data;
      const atualizado = await pool.query(`
        UPDATE aw.usuarios
        SET nome = $2, telefone = $3, empresa_nome_livre = $4
        WHERE id = $1 AND ativo
        RETURNING ${colunas}
      `, [req.identidade.id, nome, telefone, empresa]);
      if (atualizado.rows[0]) return responderPerfil(res, atualizado.rows[0]);
      // Distingue perfil inexistente de conta desativada sem alterá-la.
      const existente = await pool.query(
        `SELECT ${colunas} FROM aw.usuarios WHERE id = $1`, [req.identidade.id],
      );
      return responderPerfil(res, existente.rows[0]);
    },
  };
}
