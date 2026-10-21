# Proposta comercial: layout profissional

## O que muda

O gerador continua sendo `src/propostaPdf.js`. O painel salva os mesmos campos,
abre a mesma rota protegida de PDF, permite baixar o arquivo e solicita envio
pela mesma fila de e-mails. A prévia e o anexo agora compartilham também a
projeção `dadosPropostaPdf`, evitando conversões diferentes da validade.

- A4, logo Another World, tipografia DejaVu Sans regular e negrito incorporada.
- Identificação do cliente e contato, descrição do serviço, escopo, preço total,
  prazo, condições e validade. Valores monetários em BRL; datas em DD/MM/AAAA.
- Referência visual abreviada no topo e UUIDs completos da proposta e do pedido
  no rodapé para rastreabilidade. A referência curta não é chave de consulta.
- Paginação automática, repetição dos títulos de seções em continuação,
  cabeçalho e rodapé em todas as páginas. O tamanho do bloco de prazo acompanha
  seu texto; o preço se ajusta para comportar o maior valor permitido pela API.
- Campos não preenchidos aparecem como não informados. O PDF não cria condições
  de pagamento, garantias, descontos, tributos, CNPJ ou promessas de execução.
- A validade é uma data de calendário: prévia e anexo a consultam como texto
  `YYYY-MM-DD` no PostgreSQL, sem conversão de fuso pelo driver. O gerador também
  aceita `Date` local para uso direto. Emissão corresponde à criação da proposta no fuso de
  Brasília. A conversão antiga `String(o.validade).slice(0,10)` no anexo podia
  produzir texto como `Fri Oct 23`; foi removida.

A renderização não usa a data atual nem status de envio para modificar o texto
comercial. A versão operacional continua no painel e no histórico. Os bytes
podem variar por metadados internos do PDF, embora o conteúdo seja igual.
Não é um PDF assinado digitalmente, nem um sistema de armazenamento de versões
imutáveis de PDFs: arquivos já enviados permanecem no e-mail; novas prévias de
propostas antigas usam o modelo instalado e os dados comerciais persistidos.

## Prévia local com dados fictícios

Na raiz do repositório:

```bash
npm --prefix backend ci --ignore-scripts
node backend/scripts/preview-proposta.mjs
```

Os exemplos ficam em `backend/.previews/propostas/` (ignorada pelo Git). O script
não lê credenciais, não consulta banco e não envia e-mails. Valores e condições
dos exemplos são fictícios e não se tornam padrões do sistema.

```bash
npm --prefix backend test
```

Os testes cobrem datas com fusos UTC, Brasília e Auckland, conteúdo da prévia
comparado ao anexo realmente gerado pelo processador com SMTP simulado, campos
opcionais, limite de valor, textos extensos e limites geométricos de páginas.
A validação visual externa também confere exemplos de uma e três páginas.
DejaVu Sans cobre português; não garante cobertura de todos os emojis/idiomas.

## Implantação

Não há migração, variável de ambiente, dependência npm ou alteração de rota
nesta entrega. Incluir a nova fonte `assets/fonts/DejaVuSans-Bold.ttf` junto da
fonte regular e do logo já existentes; a licença DejaVu acompanha os arquivos.

Antes de publicar, comparar a release ativa com o commit da nova release e
conferir as migrações exigidas por eventuais mudanças da equipe que já estejam
na main (esta mudança do PDF não autoriza aplicar migrações pendentes).
Usar o procedimento de troca de release com rollback do projeto. O rollback
para a release anterior não exige alteração de banco.

Aceite: abrir um orçamento já salvo no painel, conferir cliente, valor, prazo,
condições e validade na prévia e no download. Depois, em orçamento de teste
com destinatário da equipe, confirmar um único envio e comparar o anexo com a
prévia. O envio deve continuar registrando aceitação pelo provedor e histórico.
Conferir que cliente comum e acesso sem sessão continuam sem acesso ao PDF.
