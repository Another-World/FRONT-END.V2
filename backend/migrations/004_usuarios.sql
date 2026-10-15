BEGIN;
SET LOCAL ROLE admin;

-- Interrompe sem alterar o banco se a etapa anterior não estiver aplicada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM aw.schema_migrations
        WHERE versao = '003_protecao_solicitacoes'
    ) THEN
        RAISE EXCEPTION 'Aplique 003_protecao_solicitacoes antes desta migracao.';
    END IF;

    -- Até aqui, a API cria pedidos anônimos com usuario_id NULL.
    -- Se já existirem IDs preenchidos, revisar a origem antes de criar a FK.
    IF EXISTS (
        SELECT 1 FROM aw.solicitacoes_orcamento WHERE usuario_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Existem solicitacoes com usuario_id preenchido. Revise estes vinculos antes de aplicar 004_usuarios.';
    END IF;
END;
$$;

CREATE TABLE aw.usuarios (
    -- Mesmo UUID da identidade no Supabase, validado pelo backend.
    -- Sem DEFAULT: nunca gerar uma identidade diferente na EC2.
    -- auth.users está em outro servidor, portanto não existe FK até ela.
    id uuid PRIMARY KEY,
    nome varchar(120) NOT NULL
        CHECK (length(btrim(nome)) > 0),
    email varchar(254) NOT NULL CHECK (
        email = lower(btrim(email)) AND position('@' IN email) > 1
    ),
    telefone varchar(20) CHECK (
        telefone IS NULL OR telefone ~ '^[0-9]{10,15}$'
    ),
    empresa_nome_livre varchar(160) CHECK (
        empresa_nome_livre IS NULL OR length(btrim(empresa_nome_livre)) > 0
    ),
    papel varchar(12) NOT NULL DEFAULT 'cliente'
        CHECK (papel IN ('cliente', 'admin')),
    ativo boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- A identidade é o UUID, não o e-mail. Este índice serve para pesquisas.
-- Não impor UNIQUE local: uma conta excluída/recriada no Supabase pode
-- reutilizar um e-mail, sem assumir os pedidos da identidade antiga.
CREATE INDEX usuarios_email_idx ON aw.usuarios (email);

ALTER TABLE aw.solicitacoes_orcamento
    ADD CONSTRAINT solicitacoes_usuario_fk
    FOREIGN KEY (usuario_id) REFERENCES aw.usuarios(id) ON DELETE RESTRICT;

-- Pedidos anônimos continuam aceitos. Só pedidos vinculados entram no índice.
CREATE INDEX solicitacoes_usuario_criada_idx
    ON aw.solicitacoes_orcamento (usuario_id, criada_em DESC)
    WHERE usuario_id IS NOT NULL;

CREATE FUNCTION aw.atualizar_data_usuario()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER usuario_atualizado_em
BEFORE UPDATE ON aw.usuarios
FOR EACH ROW
EXECUTE FUNCTION aw.atualizar_data_usuario();

-- A API pode criar o perfil inicial e editar somente seus dados cadastrais.
-- O backend ainda deverá limitar cada operação ao UUID autenticado.
REVOKE ALL ON aw.usuarios FROM PUBLIC;
GRANT SELECT ON aw.usuarios TO aw_api;
GRANT INSERT (id, nome, email) ON aw.usuarios TO aw_api;
GRANT UPDATE (nome, email, telefone, empresa_nome_livre)
    ON aw.usuarios TO aw_api;

-- Permite comparar o dono de um envio ao tratar sua chave de idempotência.
GRANT SELECT (usuario_id) ON aw.solicitacoes_orcamento TO aw_api;

-- Nenhuma senha é armazenada nesta tabela. Papel/ativo não podem ser
-- definidos nem alterados pelo usuário da API com essas permissões.
INSERT INTO aw.schema_migrations (versao) VALUES ('004_usuarios');

COMMIT;
