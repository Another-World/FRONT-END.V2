$ErrorActionPreference = "Stop"

# Execute somente com o backend apontando para aw_migration_test_20260930.
# Reinicie o backend antes deste teste, para zerar o contador em memoria.
$url = "http://127.0.0.1:3001/api/solicitacoes"
$headers = @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }
$dados = @{
    nome = "Teste protecao"
    email = "teste@example.com"
    telefone = "11000000000"
    servicoSlug = "hardware"
    cep = "05000000"
    mensagem = "Teste de reenvio no banco temporario"
    canalPreferido = "email"
    whatsappAutorizado = $false
}
$corpo = $dados | ConvertTo-Json -Compress

function Enviar-Tentativa([string]$json) {
    try {
        $resposta = Invoke-WebRequest -UseBasicParsing -Uri $url -Method Post `
            -Headers $headers -ContentType "application/json; charset=utf-8" `
            -Body $json -TimeoutSec 20
        return @{
            status = [int]$resposta.StatusCode
            dados = ($resposta.Content | ConvertFrom-Json)
        }
    } catch {
        if ($null -eq $_.Exception.Response) { throw }
        return @{ status = [int]$_.Exception.Response.StatusCode; dados = $null }
    }
}

$primeira = Enviar-Tentativa $corpo
if ($primeira.status -ne 201) {
    throw "Esperava HTTP 201, recebeu $($primeira.status). Confira a migracao, o tunel e reinicie o backend."
}
$segunda = Enviar-Tentativa $corpo
if ($segunda.status -ne 200 -or $primeira.dados.id -ne $segunda.dados.id) {
    throw "O reenvio deveria retornar HTTP 200 e o mesmo protocolo."
}
Write-Host "OK: criacao 201 e reenvio 200, com o mesmo protocolo: $($primeira.dados.id)"

$dados.mensagem = "Outro conteudo usando a mesma chave"
$conflito = Enviar-Tentativa ($dados | ConvertTo-Json -Compress)
if ($conflito.status -ne 409) { throw "Esperava conflito HTTP 409, recebeu $($conflito.status)." }
Write-Host "OK: a mesma chave com outro conteudo foi rejeitada com HTTP 409."

# Ja fizemos tres tentativas. As sete seguintes ainda cabem no limite de dez.
foreach ($numero in 4..10) {
    $resposta = Enviar-Tentativa $corpo
    if ($resposta.status -ne 200) {
        throw "A tentativa $numero recebeu HTTP $($resposta.status). Reinicie o backend e rode o teste sem outros envios."
    }
}
$bloqueada = Enviar-Tentativa $corpo
if ($bloqueada.status -ne 429) { throw "A tentativa 11 deveria receber HTTP 429, recebeu $($bloqueada.status)." }
Write-Host "OK: a tentativa 11 foi bloqueada com HTTP 429."
Write-Host "Teste concluido. Deve existir somente UMA nova solicitacao e UM evento no banco de testes."
Write-Host "Reinicie o backend se quiser testar o formulario imediatamente, pois o limite deste IP foi atingido."
