BEGIN;
SET LOCAL ROLE admin;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM aw.schema_migrations WHERE versao = '005_solicitacoes_conta'
    ) THEN
        RAISE EXCEPTION 'Aplique 005_solicitacoes_conta antes desta migracao.';
    END IF;
END;
$$;

ALTER TABLE aw.solicitacoes_orcamento
    ADD COLUMN versao_status integer NOT NULL DEFAULT 0 CHECK (versao_status >= 0);

-- O banco controla a versão, inclusive quando um operador corrige o status
-- fora do painel. A API não recebe UPDATE da coluna de versão.
CREATE OR REPLACE FUNCTION aw.atualizar_data_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizada_em := now();
    NEW.versao_status := OLD.versao_status;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.versao_status := OLD.versao_status + 1;
    END IF;
    RETURN NEW;
END;
$$;

-- O papel da API atende clientes e administradores. A leitura de contatos
-- só é exposta por rotas que conferem papel/ativo no banco a partir do JWT.
GRANT SELECT (
    nome_contato, email_contato, telefone_contato, pessoa_juridica, cnpj,
    empresa_nome_livre, canal_preferido, whatsapp_autorizado_em,
    cep, logradouro, bairro, cidade, uf, numero, complemento, mensagem,
    versao_status
) ON aw.solicitacoes_orcamento TO aw_api;
GRANT UPDATE (status) ON aw.solicitacoes_orcamento TO aw_api;
GRANT SELECT (id, solicitacao_id, tipo, detalhes, criado_em)
    ON aw.solicitacoes_eventos TO aw_api;
GRANT INSERT (detalhes) ON aw.solicitacoes_eventos TO aw_api;

CREATE INDEX solicitacoes_atendimento_criada_idx
    ON aw.solicitacoes_orcamento (criada_em DESC, id DESC);
CREATE INDEX solicitacoes_atendimento_status_idx
    ON aw.solicitacoes_orcamento (status, criada_em DESC, id DESC);
DROP INDEX aw.solicitacoes_status_criada_idx;
CREATE INDEX solicitacoes_eventos_paginacao_idx
    ON aw.solicitacoes_eventos (solicitacao_id, criado_em DESC, id DESC);
DROP INDEX aw.solicitacoes_eventos_ordem_idx;

-- Não promove contas, não altera papel/ativo e não concede DELETE/TRUNCATE.
INSERT INTO aw.schema_migrations (versao) VALUES ('006_atendimento');
COMMIT;
