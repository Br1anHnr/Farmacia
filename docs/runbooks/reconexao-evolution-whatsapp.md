# Runbook Operacional — Reconexão de WhatsApp via Evolution API

## Objetivo
Restabelecer rapidamente a conexão da instância de homologação do WhatsApp caso a sessão seja desconectada pelo aplicativo ou após reinicialização do servidor Coolify.

---

## 1. Diagnóstico do Estado

1. Acesse o endpoint de saúde do serviço de integração:
   ```bash
   GET /internal/health
   ```
2. Caso o campo `evolution.status` retorne `"disconnected"` ou `"close"`, verifique o status direto na Evolution API:
   ```bash
   curl -X GET "https://evolution.homologacao.farmacia.com/instance/connectionState/farmacia-homolog" \
     -H "apikey: $EVOLUTION_API_KEY"
   ```

---

## 2. Procedimento de Reconexão

### Passo 1: Obter Novo QR Code
Execute a chamada para conectar a instância:
```bash
curl -X GET "https://evolution.homologacao.farmacia.com/instance/connect/farmacia-homolog" \
  -H "apikey: $EVOLUTION_API_KEY"
```
A resposta conterá o QR Code em base64 e em formato ASCII.

### Passo 2: Escanear com o Aparelho de Homologação
1. Abra o WhatsApp no aparelho de teste de homologação.
2. Vá em **Configurações > Aparelhos Conectados > Conectar um aparelho**.
3. Aponte a câmera para o QR Code gerado.

### Passo 3: Validação da Conexão
Confirme se a instância retornou para o estado `"open"`:
```bash
curl -X GET "https://evolution.homologacao.farmacia.com/instance/connectionState/farmacia-homolog" \
  -H "apikey: $EVOLUTION_API_KEY"
```
Resposta esperada:
```json
{
  "instance": {
    "instanceName": "farmacia-homolog",
    "state": "open"
  }
}
```

### Passo 4: Teste de Mensagem
Envie uma mensagem de teste do seu próprio celular para o número de homologação e certifique-se de que a mensagem apareceu na caixa de entrada do Chatwoot dentro de 5 segundos.
