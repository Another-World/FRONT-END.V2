BEGIN;
SET LOCAL ROLE admin;

-- Mantém a chave UNIQUE da migração 002 e acrescenta a impressão do conteúdo.
-- Os registros anteriores permanecem válidos, com hash NULL.
ALTER TABLE aw.solicitacoes_orcamento
    ADD COLUMN idempotencia_hash char(64),
    ADD CONSTRAINT solicitacoes_idempotencia_hash_check CHECK (
        idempotencia_hash IS NULL OR (
            idempotencia_chave IS NOT NULL
            AND idempotencia_hash ~ '^[0-9a-f]{64}$'
        )
    ),
    -- CHECK aceita NULL: por isso a exigência de CNPJ deve ser explícita.
    ADD CONSTRAINT solicitacoes_cnpj_presenca_check CHECK (
        NOT pessoa_juridica OR cnpj IS NOT NULL
    );

-- A API compara chave + hash e devolve somente o protocolo da tentativa anterior.
-- Não recebe permissão de UPDATE, DELETE ou leitura dos dados de contato.
GRANT SELECT (idempotencia_chave, idempotencia_hash)
    ON aw.solicitacoes_orcamento TO aw_api;

INSERT INTO aw.schema_migrations (versao) VALUES ('003_protecao_solicitacoes');
COMMIT;
