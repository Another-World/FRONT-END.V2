BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM aw.schema_migrations WHERE versao='008_emails') THEN
    RAISE EXCEPTION 'Aplique 008_emails antes desta migracao.';
  END IF;
END $$;

-- Suporta a ordem estável e a paginação por data e UUID do painel.
-- Não concede permissões adicionais ao usuário da API.
CREATE INDEX usuarios_criado_id_idx ON aw.usuarios (criado_em DESC, id DESC);

INSERT INTO aw.schema_migrations (versao) VALUES ('009_consulta_usuarios');
COMMIT;
