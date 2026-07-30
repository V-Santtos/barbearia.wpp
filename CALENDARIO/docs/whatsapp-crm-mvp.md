# WhatsApp CRM MVP

Objetivo: manter o webhook principal no N8N e espelhar mensagens recebidas no app `CALENDARIO`.

## 1. Criar tabelas

No terminal:

```bash
cd "Aplicativo FULL/CALENDARIO"
npm run init:whatsapp-crm
```

O script usa a mesma `DATABASE_URL` do `server.js`.

## 2. Endpoint do calendario

```http
POST http://localhost:3333/whatsapp/events
```

Em producao, trocar pelo dominio/VPS da API.

## 3. Node HTTP Request no N8N

Adicionar logo depois do node `Dados`.

Configuracao recomendada:

- Method: `POST`
- URL: `http://SEU_HOST:3333/whatsapp/events`
- Send Body: `JSON`
- Continue On Fail: `true`
- Timeout: curto, por exemplo `3000ms`

Body JSON:

```json
{
  "direction": "inbound",
  "sender_type": "customer",
  "phone": "={{ $('Dados').item.json.Telefone }}",
  "wa_id": "={{ $('Dados').item.json.remotejid }}",
  "name": "={{ $('Dados').item.json.NomeWpp }}",
  "type": "={{ $('Dados').item.json.message.content_type }}",
  "body": "={{ $('Dados').item.json.message.content }}",
  "timestamp": "={{ $('Dados').item.json.message.timestamp }}",
  "whatsapp_message_id": "={{ $('Webhook').item.json.messages?.[0]?.id }}",
  "raw": "={{ $('Webhook').item.json }}"
}
```

## 4. Teste rapido

Com a API rodando:

```bash
npm run server
```

Enviar uma mensagem para o WhatsApp e verificar:

```http
GET http://localhost:3333/whatsapp/conversations
```

Depois abrir as mensagens:

```http
GET http://localhost:3333/whatsapp/conversations/1/messages
```

## Observacao

Neste MVP, apenas mensagens recebidas entram no CRM. As mensagens que o bot envia ficam para a proxima etapa, registrando um evento `outbound` depois dos nodes `Enviar Mensagem`.
