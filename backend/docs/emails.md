# Envio de decisões e propostas por e-mail — issue #35

## Ativação

O envio fica desligado por padrão (`EMAILS_ENABLED` ausente ou diferente de
`true`). Decisões tomadas nesse estado não são enfileiradas nem enviadas
retroativamente; a API de proposta por e-mail devolve 503 e a interface não
mostra o botão automático.

A conta autorizada para o projeto é `mateusisaque.aw@gmail.com`. A API usa o
SMTP do Gmail com TLS na porta 465. Variáveis no arquivo protegido
`/etc/another-world-api/api.env` da EC2: `SMTP_USER=mateusisaque.aw@gmail.com`,
`SMTP_APP_PASSWORD` (senha de app da conta com verificação em duas etapas) e,
**somente após validar conexão e entrega**, `EMAILS_ENABLED=true`. Nunca
publicar a senha de app, colocá-la no frontend, em commit ou em logs.
Não use a senha normal da conta. A senha de app pode ser revogada pelo Google
ou após troca da senha da conta. O Gmail aplica limites diários de envio e
pode bloquear atividades suspeitas: esta opção atende baixo volume; para
volume comercial, planeje domínio próprio e provedor transacional.

O Gmail apresenta o nome **Another World**, mas o endereço real continua
`mateusisaque.aw@gmail.com`. Cada mensagem contém versões texto e HTML; o
HTML usa o logo do projeto incorporado, sem imagens remotas ou rastreadores.
O PDF anexo e a prévia protegida usam o mesmo documento com identidade visual.
Mensagens pendentes continuam usando o assunto e o conteúdo já persistidos.
Nas novas propostas, o assunto e o texto usam o nome do serviço vinculado à
solicitação em `aw.servicos` (por exemplo, Hardware ou Redes). O protocolo
permanece na proposta em PDF e nos registros internos. Solicitações antigas sem
serviço vinculado usam o título genérico "Serviço solicitado"; mensagens já
enfileiradas ou enviadas não têm o assunto alterado retroativamente.
Essas mudanças não garantem a caixa principal: para um endereço
`@another-world...` no futuro, registrar um domínio controlado pela equipe,
verificar o remetente no serviço de e-mail e publicar SPF, DKIM e DMARC
conforme o provedor antes de alterar o endereço `From`. Nunca forjar um
endereço comercial no SMTP da conta Gmail. Conferir `Authentication-Results`
(SPF/DKIM/DMARC), reputação e feedback de destinatários em envios de teste.

Os testes usam um transporte falso: não comprovam entrega real. `messageId` e
`accepted` confirmam a aceitação pelo SMTP, não o recebimento na caixa de
entrada. Conferir o envio de teste na pasta Enviados e no destinatário,
inclusive spam. O fluxo não recebe notificações automáticas de bounce.

## Dados e consistência

A migration `008_emails.sql` ampliou a fila `aw.comunicacoes` e acrescentou
`aguardando_envio` à proposta; não modifica as tabelas `public.*`. O e-mail
usa o destinatário persistido no pedido/proposta; o navegador não o escolhe.
O PDF é gerado no backend e anexado ao SMTP; não há link público de download.
Um índice único em `evento_chave` impede duplicação do enfileiramento por
mesma decisão/proposta. O envio manual continua disponível sem disparar e-mail.

O worker reserva uma mensagem pendente com `FOR UPDATE SKIP LOCKED`, marca
`processando`, envia fora da transação e registra a resposta do Gmail.
Depois de confirmação SMTP, marca a comunicação `enviada`; para propostas,
atualiza o status e grava o evento `email_aceito_pelo_provedor` na mesma
transação. O evento antigo `email_aceito_pelo_ses` continua legível na tela.
O worker processa até dez itens por rodada a cada 30 segundos.

Timeout, queda de conexão ou falha de persistência tornam o resultado
**incerto**: a mensagem talvez tenha saído. `falhou/resultado_incerto` e
`processando` após reinício **não são reenviados automaticamente**. Consulte
logs `email_nao_confirmado` ou `email_aceito_sem_confirmacao_local`, a pasta
Enviados do Gmail e o destinatário antes de qualquer reconciliação; SMTP não
oferece deduplicação por chave da aplicação. Propostas aguardando envio nessas
condições exigem acompanhamento técnico. Não altere status diretamente no
banco nem reenvie às cegas.

## Implantação

1. Publicar a nova release, instalar dependências (`npm ci --omit=dev
   --ignore-scripts`) e validar código com `EMAILS_ENABLED` desligado.
   A migration 008 já está aplicada; não é necessária nova migration.
2. Confirmar health 200, ready 200 e rota de e-mail sem login 401.
3. Criar senha de app da conta autorizada, guardá-la no arquivo de ambiente
   protegido da EC2 e testar conectividade TLS com o Gmail. Não compartilhar
   a senha na conversa nem em capturas de tela.
4. Realizar envio deliberado a endereço de teste autorizado, conferir ambas
   as caixas e os cabeçalhos. Somente então habilitar `EMAILS_ENABLED=true`
   e reiniciar a API. Antes de habilitar, conferir itens pendentes na fila.

Consulta de operação na EC2, como `postgres`, sem revelar endereços:

```sql
SELECT tipo,status,count(*) FROM aw.comunicacoes
WHERE canal='email' AND evento_chave IS NOT NULL
GROUP BY tipo,status ORDER BY tipo,status;
```

Para voltar à release anterior, desligue `EMAILS_ENABLED` e reinicie a API
antes do rollback. Mantenha migration e registros; releases anteriores
não entendem `aguardando_envio`.
