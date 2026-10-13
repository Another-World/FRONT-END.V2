BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM aw.schema_migrations WHERE versao = '004_usuarios'
    ) THEN
        RAISE EXCEPTION 'Aplique 004_usuarios antes desta migracao.';
    END IF;
END;
$$;

-- Complementa somente as leituras ausentes na auditoria. INSERT de usuario_id
-- já era permitido. Não concede UPDATE/DELETE nem leitura de dados de contato.
GRANT SELECT (servico_id, status, atualizada_em)
    ON aw.solicitacoes_orcamento TO aw_api;
GRANT SELECT (nome) ON aw.servicos TO aw_api;

-- O desempate pelo UUID mantém a paginação estável quando datas coincidem.
CREATE INDEX IF NOT EXISTS solicitacoes_usuario_paginacao_idx
    ON aw.solicitacoes_orcamento (usuario_id, criada_em DESC, id DESC)
    WHERE usuario_id IS NOT NULL;
DROP INDEX IF EXISTS aw.solicitacoes_usuario_criada_idx;

INSERT INTO aw.schema_migrations (versao)
    VALUES ('005_solicitacoes_conta') ON CONFLICT DO NOTHING;
COMMIT;
