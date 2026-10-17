# Orçamentos e propostas comerciais — issue #34

## Modelo e implantação

As migrations 001–006 mantêm pedidos em `aw.solicitacoes_orcamento`; não há
persistência de propostas comerciais nesse schema no código anterior. A 007
acrescenta `aw.orcamentos` e `aw.orcamentos_eventos`, sem converter pedidos em
propostas e sem modificar tabelas antigas de outro aplicativo em `public`.
Antes de aplicar em produção, conferir o inventário real de tabelas e possíveis
integrações com modelos legados. Se já existir um módulo comercial no schema
`aw` fora das migrations, interromper e revisar a integração, sem criar duplicatas.

Ordem: backup validado do banco atual, conferir migration 006, instalar a release
com `npm ci --omit=dev --ignore-scripts`, aplicar 007 como postgres (a migration
usa `SET LOCAL ROLE admin`), validar o backend e só depois publicar o frontend.
A migration é transacional; uma segunda aplicação deve ser interrompida, não
forçada. Confirmar `007_orcamentos` em `aw.schema_migrations` antes de ativar.
O rollback da API pode usar a release anterior mantendo as tabelas novas: não
apagar propostas nem eventos. Fazer um novo backup após a implantação.

O módulo usa os endpoints já cobertos pelo prefixo Nginx
`/api/atendimento(/.*)?`, pelo CORS e pelo header `Idempotency-Key` existentes.
Não acrescenta portas, variáveis, credenciais nem mudanças no Supabase Auth.
O PDFKit está fixado em 0.20.2 no lockfile. A fonte DejaVu Sans e sua licença
acompanham a release, sem depender de fontes instaladas na EC2.

O PDF inclui o logo oficial do site em uma cópia compacta na release do backend.
O documento mostra proposta, solicitação e data de emissão, identifica o
cliente e destaca investimento, prazo e validade. O cabeçalho e a numeração
aparecem em todas as páginas. Esses dados são os valores persistidos na
proposta; o layout não acrescenta promessas comerciais por conta própria.

## Fluxo

1. Uma solicitação em `aceito` pode gerar um rascunho. O UUID de usuário e o
   contato são copiados do pedido pelo servidor. Visitantes permanecem sem
   conta vinculada; e-mail não concede propriedade. O contato comercial do
   pedido pode diferir do e-mail de login.
2. Há no máximo um rascunho por solicitação; depois do envio, é possível
   criar outra proposta sem alterar as anteriores. Cada uma tem UUID próprio.
3. Preencher serviço, escopo, preço total, prazo, condições opcionais e validade
   opcional. Valores são inteiros em centavos (BRL), de 1 a 1.000.000.000.
   A tela converte valores como `1250,50` sem arredondar uma terceira casa.
   Datas de validade são avaliadas no fuso America/Sao_Paulo.
4. Salvar, revisar o PDF persistido e baixar. O PDF contém o documento comercial,
   não uma afirmação de que houve entrega. A equipe envia o arquivo pelo canal
   externo escolhido e confirma **envio manual** no painel. Isso não envia
   e-mail nem WhatsApp, nem comprova entrega ou leitura. O envio automático e
   sua comprovação ficam na issue #35, apoiada na fila já existente.
5. Depois do envio os campos comerciais ficam congelados. O administrador pode
   registrar uma resposta como `aceita` ou `recusada`, informando obrigatoriamente
   origem/observação e confirmando. Trata-se de registro manual da equipe, não
   autenticação nem assinatura do cliente. O status do pedido não muda junto.
6. Histórico registra administrador, versão, decisão, confirmação e origem.
   Edições de rascunho registram a versão, sem guardar cópias de cada texto
   anterior. Propostas enviadas não são reescritas nem reabertas.

Criar, editar e marcar envio exigem que o pedido ainda esteja aceito. Cancelar
ou reabrir o pedido bloqueia essas operações, sem apagar PDFs/histórico.
Respostas de propostas anteriormente enviadas ainda podem ser registradas.
Rascunho vencido deve receber validade atualizada antes do envio.

## API protegida

Todas as rotas ficam sob `/api/atendimento/orcamentos` e exigem JWT válido,
usuário ativo e papel admin lido no PostgreSQL. Metadata não concede acesso.
A sessão é novamente conferida no frontend depois de cada resposta.

- `GET /`: lista mínima paginada (`limite` até 50, `cursor`, `status`,
  `solicitacaoId`). Ordem por data com microssegundos e UUID decrescentes.
- `POST /`: corpo comercial + `solicitacaoId`, header UUID `Idempotency-Key`.
  A chave é o UUID da proposta e permite reenvio sem duplicar registros/eventos.
  Reutilizar a chave com outro pedido ou dados diferentes retorna 409.
  Resposta de criação/reenvio: 200, `{ orcamento }`.
- `GET /:id`: proposta completa e até 100 eventos recentes.
- `PATCH /:id`: todos os campos comerciais + `versao`; somente rascunho.
- `PATCH /:id/status`: `{ status, versao, confirmado: true, nota? }`.
  `nota` obrigatória para resposta do cliente e proibida ao marcar envio.
- `GET /:id/pdf`: `application/pdf`, inline, sem URL pública e com `no-store`.
  O frontend usa Blob temporário e revoga a URL ao fechar/trocar de conta.

Campos comerciais: `descricao` (1–500), `escopo` (1–6000), `valorCentavos`,
`prazo` (1–200), `condicoes` (até 4000), `validade` (`YYYY-MM-DD` ou null).
Objetos estritos rejeitam campos de identidade, destinatário e privilégios.
A tela limita o corpo serializado a 15 KB e a API a 16 KB, compatível com o
Nginx atual; textos Unicode extensos podem precisar ser reduzidos.

Conflitos retornam 409 e exigem nova leitura; confirmações ausentes retornam
400. Falhas de auditoria revertem a operação inteira. A UI bloqueia novas
escritas após resultado incerto até atualizar a lista/reabrir a proposta.

O mesmo papel de conexão `aw_api` serve rotas de cliente e de administrador,
como no atendimento existente. O controle de acesso é na API, com revalidação
transacional de papel/ativo; este banco privado na EC2 não é Data API Supabase.
Não há concessão de DELETE/TRUNCATE, alteração de vínculo, contato, versão ou
carimbos de data. Eventos são somente de inserção/leitura. Funções são invoker,
sem SECURITY DEFINER. O trigger protege transições e congela dados enviados.

Ordem de locks: perfil FOR SHARE, pedido FOR SHARE, proposta FOR UPDATE.
Timeouts de consulta/lock são 10 s/3 s. A renderização do PDF ocorre após o
COMMIT/liberação da conexão, com até duas gerações simultâneas por processo.
Nenhuma requisição HTTP externa acontece dentro dessas transações.

## Validação e aceite em produção

`npm --prefix backend test` inclui cenários de grants, JWT inválido, cliente
forjado, revogação, destinatário/conta corretos, pedidos visitantes, dados
inválidos, idempotência, rascunho único, edição/versionamento, congelamento,
resposta com confirmação, atomicidade com falha de evento e paginação.
Os testes usam PGlite com DDL real e papel aw_api, mas o pool de teste serializa
transações: o cenário concorrente não substitui teste de contenção no PostgreSQL
nativo. Revisar também os limites e recursos da instância em produção.

O PDF foi inspecionado em exemplos de uma e quatro páginas, com conferência
de acentos, preço, data, cabeçalho/rodapé e ausência de cortes. Os dados dos
exemplos são fictícios. A fonte cobre português e os alfabetos do DejaVu Sans;
não é uma fonte universal para todos os símbolos e idiomas.

Após publicar, testar em um pedido de teste: criar/salvar/recarregar rascunho,
ver PDF e baixar, cancelar confirmação de envio, confirmar envio manual,
verificar bloqueio de edição, registrar resposta com nota, recarregar e conferir
histórico. Usar conta cliente para confirmar bloqueio do painel e PDF.
Não fechar #34 antes dessa validação e da revisão da equipe.
