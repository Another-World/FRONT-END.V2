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
| GET | `/api/atendimento/solicitacoes` | Listar pedidos; `limite` 1–50, padrão 20; filtros `status` e `busca` opcionais, com `cursor` opcional |
| GET | `/api/atendimento/solicitacoes/:id` | Detalhe do pedido e últimos 50 eventos |
| PATCH | `/api/atendimento/solicitacoes/:id/status` | Alterar somente status, com versão esperada |

Corpo do PATCH:

```json
{"status":"em_contato","versao":0}
```

Para decisões que exigem confirmação, enviar também o booleano `confirmado: true`:

```json
{"status":"aceito","versao":0,"confirmado":true}
```

Aceitar significa concordar em **preparar um orçamento**, não contratação pelo cliente. Aceite, recusa, cancelamento, conclusão e reabertura exigem confirmação na interface e aceitação explícita na requisição. O booleano não substitui a autorização do administrador nem prova, por si só, uma interação humana.

| Status atual | Próximos status permitidos |
| --- | --- |
| `em_analise` | `em_contato`, `aceito`, `negado`, `cancelada` |
| `em_contato` | `em_analise`, `aceito`, `negado`, `cancelada` |
| `aceito` | `em_analise`, `em_contato`, `concluida`, `cancelada` |
| `negado`, `cancelada`, `concluida` | Somente `em_analise`, por reabertura confirmada |

A regra de reabertura foi escolhida pelo responsável pelo projeto em 15/10/2026. A API confere o status atual sob lock; um cliente não pode pular essa validação enviando um status válido do enum. Detalhes e respostas de atualização incluem `acoesDisponiveis: [{status, confirmacao}]`; a tela usa essa lista do servidor para montar as opções e a mensagem de confirmação. Repetir o mesmo status com a versão atual continua sendo uma operação sem efeito, sem novo evento ou confirmação obrigatória.

`busca` aceita de 2 a 120 caracteres após trim, por parte do nome de contato ou protocolo, sem distinguir maiúsculas/minúsculas. A busca é literal: `%`, `_` e aspas não recebem significado especial. O termo é enviado como parâmetro SQL e combinado com status e paginação; não é uma busca por e-mail. A interface consulta ao submeter o formulário, preserva a busca ao trocar status/carregar mais e reinicia a paginação ao alterar os filtros. Para esta base pequena não foi acrescentado índice de substring; consultas permanecem sujeitas a timeout. Medir o plano com volume real antes de escolher um índice específico.

Lista retorna protocolo, nome de contato, serviço, status, versão e datas. Contato completo/mensagem/endereço e histórico só aparecem no detalhe administrativo. Hash/chave de idempotência não são retornados. A paginação usa `(criada_em, id)` e preserva microssegundos. Mudanças de status entre páginas podem alterar os resultados de um filtro; usar Atualizar lista para consultar novamente a fila.

Respostas: 401 para JWT ausente/inválido; 403 para conta sem administração ativa; 400 para corpo/filtro/protocolo inválido ou confirmação ausente; 404 para pedido inexistente; 409 para versão antiga ou transição não permitida. Todas as respostas de atendimento usam `Cache-Control: no-store`. Limite independente de 300 requisições por IP em 15 minutos.

## Concorrência e histórico

A migration 006 adiciona `versao_status`, inicialmente zero. O trigger existente passa a controlar a versão: somente uma mudança real de status a incrementa, inclusive em atualizações diretas por um operador. A API tem UPDATE apenas de `status`, sem UPDATE da versão.

O PATCH bloqueia o perfil administrador antes do pedido, confere a versão, transição e confirmação, altera o status e grava `status_alterado` na mesma transação. O evento inclui UUID do administrador, status/versão anteriores e novos, `acao` e `confirmado: true` quando exigido. Uma reabertura usa `acao: "reabertura"`; a tela destaca esse registro no histórico. Uma falha no histórico desfaz também status, versão e data. Status igual com a versão atual não gera evento novo; uma versão antiga retorna 409 mesmo se o status solicitado coincidir.

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

55 testes de backend aprovados no desenvolvimento, incluindo os 44 cenários anteriores e busca/paginação, termos literais/SQL, confirmação explícita, reabertura dos três status encerrados, transições proibidas, rollback da reabertura e reaberturas concorrentes. Build do frontend e lint dos arquivos alterados aprovados. Quatro testes isolados de componentes verificaram cancelamento da confirmação sem PATCH, reabertura confirmada com versão, confirmação de aceite e preservação da busca em filtro/paginação; não são testes visuais de navegador.

Os testes SQL usam PGlite e transações serializadas em uma conexão. O teste de dois envios confirma o resultado 200/409 nesse contexto; não é um teste de contenção com várias conexões PostgreSQL nativas. O código usa locks e versão no PostgreSQL para controlar concorrência.

O navegador de testes não estava instalado no ambiente de desenvolvimento; a validação visual/manual fica para o frontend local após instalação. Conferir:

1. Administrador vê contas e visitantes; cliente não acessa painel/API.
2. Selecionar pedido de teste e mudar Em análise → Em contato.
3. Histórico registra a mudança; F5 mantém o status; Área do Cliente mostra o novo status ao atualizar.
4. Duas abas com detalhe antigo: depois de salvar na primeira, a segunda recebe conflito e exige Atualizar detalhes.
5. Validar layout em celular e desktop, filtros, lista vazia e carregamento de mais pedidos.
6. Buscar nome/protocolo, combinar com status e limpar a busca.
7. Em um pedido de teste recusado/cancelado/concluído, escolher Em análise: cancelar a confirmação não altera o pedido; confirmar grava a reabertura, que permanece após F5.

## Frontend e publicação

O painel usa o perfil retornado pela API para exibir o acesso, mas o servidor sempre revalida a autorização. Troca de conta desmonta a tela e cancela requisições; 401/403 limpa o painel. Dados pessoais não são guardados em localStorage/sessionStorage nem enviados a logs.

O botão Abrir e-mail abre o aplicativo de e-mail do operador. Não há envio automático de mensagens, worker ou resposta administrativa escrita no banco nesta entrega.

O atendimento passa a ser a seção **Solicitações**, em `/admin/solicitacoes`, dentro do `AdminLayout` da equipe (PR #39 / issue #31). O menu e as páginas de Dashboard, Orçamentos, Usuários e Avaliações são preservados; essas páginas mantêm seus estados de espera por integração. `/atendimento` redireciona para `/admin/solicitacoes`, e a Área do Cliente passa a oferecer o botão Painel administrativo, apontando para `/admin`.

`RotaAdmin` envolve todas as páginas administrativas, respeita inicialização/recuperação da sessão e consulta o perfil na API para exigir `papel=admin`. Troca de conta ou página desmonta o estado anterior; retorno à aba/janela revalida o perfil. Uma falha na verificação impede o acesso. O `role` do navegador e metadata não concedem permissão. Cada endpoint continua revalidando a conta no PostgreSQL.

O logout do layout aguarda o resultado do Supabase antes de navegar e mostra erro em caso de falha. Não foi incorporada a autenticação simulada de `services/auth.js` da main: permanece o serviço Supabase da branch autenticada, sem senhas no localStorage.

Foram acrescentados rewrites exatos para `/admin` e as quatro subseções, preservando os rewrites públicos e `/atendimento`. Não é necessário alterar a API ou reaplicar a migration 006 para essa integração visual. As três variáveis de produção foram configuradas pelo operador na Vercel; a publicação do frontend integrado depende da validação final.

Em 14/10/2026, o operador confirmou release 25ee256 ativa, migrations 001–006, health/ready 200, atendimento sem token 401, rota HTTPS 401 e primeiro perfil administrador ativo. O pedido de teste manteve a alteração de status após F5. O backup Nginx anterior à rota de atendimento é `/var/backups/another-world/nginx/api-atendimento-20261014T192549Z-10182.conf`.

## Relação com as issues da equipe

- **#31:** reaproveita layout, navegação e páginas da equipe; não substitui seu trabalho visual.
- **#33:** implementa lista, busca, filtro por status, detalhes, atualização e histórico reais, confirmação de decisões e regras de transição/reabertura. A publicação desta evolução exige primeiro atualizar a API, seguida do frontend e da conferência final de aceite. Aceitar significa preparar um orçamento; não é contratação pelo cliente.
- **#38:** reaproveita autenticação Supabase, autorização na API/banco e testes de acesso existentes, com proteção das rotas administrativas e logout assíncrono. A estratégia de validade de JWT após logout está descrita em Autorização.
- **#32, #34, #35, #36 e #37:** indicadores, propostas/PDF, envio automático de e-mail, gestão de usuários e avaliações permanecem como entregas próprias; não declarar essas issues concluídas por esta integração.

A integração foi validada com lint dos arquivos envolvidos, build com configuração publicável de teste e sete testes de componentes: sessão ausente/inicialização/recuperação, metadata sem autorização, revogação ao retomar janela, troca de conta/resposta antiga, troca de página/erro da API e logout confirmado/falho. Esses testes isolam o perfil e a sessão; não substituem os 44 testes reais da implementação de backend nem a conferência visual no navegador local. Não foram adicionadas dependências de teste ao projeto. O navegador automatizado não pôde ser instalado neste ambiente.

`operacao-ec2.md` registra o snapshot operacional da release e28bdf9 e do backup anterior à 006; este documento descreve a entrega seguinte de atendimento.

## Publicação da busca e do fluxo de reabertura

Não há nova migration, dependência ou grant. Permanecem as migrations 001–006, os endpoints atuais e o snippet Nginx existente. Publicar a branch, instalar o backend na EC2 com verificação e rollback pelo procedimento de releases, e depois integrar o frontend à main para a Vercel.

O frontend novo exige `acoesDisponiveis` no detalhe e não oferece salvamento contra uma API anterior. Durante o intervalo entre as publicações, o frontend antigo pode listar/ver detalhes e registrar andamento comum, mas decisões que exigem `confirmado: true` serão recusadas até a atualização da tela. Em rollback para o backend anterior, manter esse bloqueio da tela nova e restabelecer uma combinação compatível de frontend/backend; não remover registros de histórico.
