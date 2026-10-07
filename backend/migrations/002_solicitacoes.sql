BEGIN;

-- Mantém as novas tabelas com o mesmo proprietário da migração 001.
SET LOCAL ROLE admin;

CREATE TABLE aw.solicitacoes_orcamento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- UUID do usuário no Supabase, quando a solicitação for autenticada.
    usuario_id uuid,
    servico_id uuid REFERENCES aw.servicos(id) ON DELETE RESTRICT,

    nome_contato varchar(120) NOT NULL
        CHECK (length(btrim(nome_contato)) > 0),
    email_contato varchar(254) NOT NULL
        CHECK (length(btrim(email_contato)) > 0),
    telefone_contato varchar(20) NOT NULL
        CHECK (length(btrim(telefone_contato)) > 0),

    pessoa_juridica boolean NOT NULL DEFAULT false,
    cnpj varchar(14),
    empresa_nome_livre varchar(160),

    canal_preferido varchar(8) NOT NULL DEFAULT 'email'
        CHECK (canal_preferido IN ('email', 'whatsapp')),
    whatsapp_autorizado_em timestamptz,

    cep varchar(8) NOT NULL CHECK (cep ~ '^[0-9]{8}$'),
    logradouro varchar(180),
    bairro varchar(100),
    cidade varchar(100),
    uf char(2) CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
    numero varchar(20),
    complemento varchar(100),

    mensagem text NOT NULL CHECK (length(btrim(mensagem)) > 0),
    status varchar(16) NOT NULL DEFAULT 'em_analise'
        CHECK (status IN (
            'em_analise', 'em_contato', 'aceito',
            'negado', 'concluida', 'cancelada'
        )),

    resposta_admin text,
    respondida_em timestamptz,
    idempotencia_chave uuid UNIQUE,
    criada_em timestamptz NOT NULL DEFAULT now(),
    atualizada_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT cnpj_pessoa_juridica_check CHECK (
        (pessoa_juridica = true AND cnpj ~ '^[0-9]{14}$')
        OR (pessoa_juridica = false AND cnpj IS NULL)
    ),
    CONSTRAINT whatsapp_exige_autorizacao CHECK (
        canal_preferido <> 'whatsapp'
        OR whatsapp_autorizado_em IS NOT NULL
    )
);

CREATE INDEX solicitacoes_status_criada_idx
    ON aw.solicitacoes_orcamento (status, criada_em DESC);

CREATE INDEX solicitacoes_email_idx
    ON aw.solicitacoes_orcamento (lower(email_contato));

-- Registra acontecimentos relevantes da solicitação.
CREATE TABLE aw.solicitacoes_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id uuid NOT NULL
        REFERENCES aw.solicitacoes_orcamento(id) ON DELETE RESTRICT,
    tipo varchar(32) NOT NULL,
    detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(detalhes) = 'object'),
    criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX solicitacoes_eventos_ordem_idx
    ON aw.solicitacoes_eventos (solicitacao_id, criado_em);

-- Fila de mensagens. Esta tabela, sozinha, não envia e-mails ou WhatsApp.
CREATE TABLE aw.comunicacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id uuid NOT NULL
        REFERENCES aw.solicitacoes_orcamento(id) ON DELETE RESTRICT,
    canal varchar(8) NOT NULL
        CHECK (canal IN ('email', 'whatsapp')),
    tipo varchar(24) NOT NULL
        CHECK (tipo IN ('confirmacao', 'resposta', 'acompanhamento')),
    destinatario varchar(254) NOT NULL,
    assunto varchar(200),
    conteudo text,
    status varchar(16) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'processando', 'enviada', 'falhou')),
    tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
    ultimo_erro text,
    agendada_em timestamptz NOT NULL DEFAULT now(),
    enviada_em timestamptz,
    criada_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comunicacoes_pendentes_idx
    ON aw.comunicacoes (agendada_em)
    WHERE status IN ('pendente', 'falhou');

CREATE UNIQUE INDEX comunicacoes_confirmacao_unica_idx
    ON aw.comunicacoes (solicitacao_id, canal)
    WHERE tipo = 'confirmacao';

CREATE FUNCTION aw.atualizar_data_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizada_em := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER solicitacao_atualizada_em
BEFORE UPDATE ON aw.solicitacoes_orcamento
FOR EACH ROW
EXECUTE FUNCTION aw.atualizar_data_solicitacao();

INSERT INTO aw.schema_migrations (versao) VALUES ('002_solicitacoes');

COMMIT;