# Painel de atendimento

Entrega: listar pedidos de todas as contas e visitantes, consultar contato/mensagem/endereço e alterar os seis status existentes. O cliente continua recebendo apenas a lista mínima dos seus pedidos.

## Autorização

- Todos os endpoints de atendimento exigem JWT Supabase válido, com `role=authenticated`, do projeto configurado no backend.
- O UUID vem exclusivamente do JWT validado. O servidor consulta `aw.usuarios` e exige `ativo=true` e `papel='admin'`.
- Metadata, corpo, query, e-mail e permissões exibidas no navegador não concedem administração.
- Cada operação revalida a conta dentro de uma transação com `FOR SHARE`. A conta permanece bloqueada contra alteração de papel/ativo até a operação terminar. Novas requisições de uma conta rebaixada ou desativada são recusadas mesmo com o JWT anterior.
- A API não cria administradores, não altera papel/ativo e não administra usuários. Essa liberação é exclusiva do operador PostgreSQL autorizado.
- JWTs já emitidos continuam válidos até expirar após logout/exclusão no Supabase. Para bloquear imediatamente o acesso ao atendimento, desativar/rebaixar também o perfil local; este painel não implementa consulta de `auth.sessions` no serviço remoto.

## API

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/api/atendimento/solicitacoes` | Listar pedidos; `limite` 1–50, padrão 20; filtro `status` opcional e `cursor` opcional |
| GET | `/api/atendimento/solicitacoes/:id` | Detalhe do pedido e últimos 50 eventos |
| PATCH | `/api/atendimento/solicitacoes/:id/status` | Alterar somente status, com versão esperada |

Corpo do PATCH:

```json
{"status":"em_contato","versao":0}
```

Status: `em_analise`, `em_contato`, `aceito`, `negado`, `concluida`, `cancelada`. O administrador pode corrigir/reabrir qualquer status. Não há restrições adicionais de transição de negócio nesta entrega.

Lista retorna protocolo, nome de contato, serviço, status, versão e datas. Contato completo/mensagem/endereço e histórico só aparecem no detalhe administrativo. Hash/chave de idempotência não são retornados. A paginação usa `(criada_em, id)` e preserva microssegundos. Mudanças de status entre páginas podem alterar os resultados de um filtro; usar Atualizar lista para consultar novamente a fila.

Respostas: 401 para JWT ausente/inválido; 403 para conta sem administração ativa; 400 para corpo/filtro/protocolo inválido; 404 para pedido inexistente; 409 para versão antiga. Todas as respostas de atendimento usam `Cache-Control: no-store`. Limite independente de 300 requisições por IP em 15 minutos.

## Concorrência e histórico

A migration 006 adiciona `versao_status`, inicialmente zero. O trigger existente passa a controlar a versão: somente uma mudança real de status a incrementa, inclusive em atualizações diretas por um operador. A API tem UPDATE apenas de `status`, sem UPDATE da versão.

O PATCH bloqueia o perfil administrador antes do pedido, confere a versão, altera o status e grava `status_alterado` na mesma transação. O evento inclui UUID do administrador, status/versão anteriores e novos. Uma falha no histórico desfaz também status, versão e data. Status igual com a versão atual não gera evento novo; uma versão antiga retorna 409 mesmo se o status solicitado coincidir.

Uma alteração direta no banco avança a versão, mas não grava o evento com identidade Supabase deste endpoint. Preferir o painel para ter esse histórico de autoria. Uma resposta HTTP perdida pode ocorrer após o commit; atualizar o detalhe antes de tentar novamente. A interface bloqueia novo salvamento após erro até os detalhes serem atualizados.

## Migration e privilégios

`006_atendimento.sql` exige a 005, usa transação, lock timeout de 5 s e statement timeout de 60 s. Não promove contas, não altera dados de contato e não exige novas credenciais de banco.

O papel servidor `aw_api` atende as rotas de clientes e de administradores. A 006 acrescenta as leituras de contato necessárias ao atendimento, SELECT de eventos, INSERT da coluna `detalhes` e UPDATE somente de `status`. Os endpoints administrativos fazem a autorização; o navegador não recebe conexão direta ao PostgreSQL. A API continua sem UPDATE de dono, contato, papel/ativo, versão ou eventos e sem DELETE/TRUNCATE das tabelas da aplicação.

Os testes da 005 preservam sua auditoria histórica, anterior à concessão de leitura de contatos na 006. Os testes de atendimento verificam o conjunto novo e que as rotas de cliente continuam isoladas e não expõem os campos administrativos.

## Instalação na EC2

1. Manter o backup já validado em `/var/backups/another-world/postgres/20261014_174556_2697`.
2. Preparar release nova e validar JavaScript/importação como `aw-api`, pelo procedimento de operação já usado.
3. Copiar somente a migration 006 para um caminho legível por `postgres`; aplicar com `psql -X -d sistema_postgres -v ON_ERROR_STOP=1`. Confirmar `006_atendimento` no registro. Não executar migrations 001–005 novamente.
4. Trocar `current`, reiniciar a API e aguardar health/ready 200, listagem cliente 401 e listagem administrativa sem token 401, com rollback de software se falhar.
5. Incluir o prefixo de atendimento no snippet Nginx, preservando as diretivas existentes. Padrão proposto:

```nginx
location ~ ^/api/(health|ready|solicitacoes|perfil|atendimento(/.*)?)/?$ {
    # Preservar o conteúdo atual: CORS, HTTPS e proxy 127.0.0.1:3001.
}
```

Este trecho não substitui o arquivo completo. Salvar cópia, usar `nginx -t`, recarregar e repetir o teste HTTPS por alguns segundos. Esperado sem JWT: 401 no endpoint administrativo.

6. Conferir identidade do primeiro administrador no Supabase e no perfil local antes de sua liberação. Usar o UUID confirmado, com correspondência de e-mail/conta ativa. Atualizar `papel` como operador PostgreSQL, nunca por um endpoint ou metadata. A migration não faz essa liberação automaticamente.
7. Recarregar o frontend local e abrir `/atendimento` pelo botão Painel de atendimento na Área do Cliente.

O rollback do software mantém a 006; não apagar a coluna, eventos ou permissões como rollback. A versão anterior mantém perfil e pedidos, mas não tem os endpoints administrativos; a interface do painel também depende da versão nova.

## Validação

44 testes de backend aprovados no desenvolvimento, incluindo JWTs inválidos, clientes/metadata, revogação antes/durante a operação, grants, contatos de visitantes/contas, filtro/paginação, rollback do histórico, versão antiga e escrita concorrente. Build do frontend e lint dos arquivos alterados aprovados.

Os testes SQL usam PGlite e transações serializadas em uma conexão. O teste de dois envios confirma o resultado 200/409 nesse contexto; não é um teste de contenção com várias conexões PostgreSQL nativas. O código usa locks e versão no PostgreSQL para controlar concorrência.

O navegador de testes não estava instalado no ambiente de desenvolvimento; a validação visual/manual fica para o frontend local após instalação. Conferir:

1. Administrador vê contas e visitantes; cliente não acessa painel/API.
2. Selecionar pedido de teste e mudar Em análise → Em contato.
3. Histórico registra a mudança; F5 mantém o status; Área do Cliente mostra o novo status ao atualizar.
4. Duas abas com detalhe antigo: depois de salvar na primeira, a segunda recebe conflito e exige Atualizar detalhes.
5. Validar layout em celular e desktop, filtros, lista vazia e carregamento de mais pedidos.

## Frontend e publicação

O painel usa o perfil retornado pela API para exibir o acesso, mas o servidor sempre revalida a autorização. Troca de conta desmonta a tela e cancela requisições; 401/403 limpa o painel. Dados pessoais não são guardados em localStorage/sessionStorage nem enviados a logs.

O botão Abrir e-mail abre o aplicativo de e-mail do operador. Não há envio automático de mensagens, worker ou resposta administrativa escrita no banco nesta entrega.

O rewrite `/atendimento → /index.html` foi acrescentado à Vercel. Publicação e variáveis de produção permanecem adiadas. O frontend local continua funcionando pelo túnel PuTTY e pelo proxy Vite.

`operacao-ec2.md` registra o snapshot operacional da release e28bdf9 e do backup anterior à 006; este documento descreve a entrega seguinte de atendimento.
