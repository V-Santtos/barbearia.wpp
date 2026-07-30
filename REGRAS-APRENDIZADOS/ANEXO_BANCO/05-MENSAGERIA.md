# 05 — Mensageria WhatsApp (`whatsapp_contacts` / `conversations` / `messages`)

Este trio é o **CRM de conversas dentro do app de calendário**. Foi alimentado pelo endpoint
`POST barberapi.autohost.shop/whatsapp/events`, que o fluxo n8n chamava a cada mensagem, nas
duas direções. É a peça que fazia o dono acompanhar o atendimento sem abrir o WhatsApp.

Ao contrário das outras tabelas do bot, este bloco é **bem modelado**: FKs, CHECKs, índices
parciais úteis.

## `whatsapp_contacts` — 8 linhas

| coluna | tipo | nulo | observação |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `phone` | text | não | **UNIQUE** |
| `wa_id` | text | sim | |
| `name` | text | sim | |
| `last_message_at` | timestamptz | sim | |
| `service_window_until` | timestamptz | sim | **janela de 24h do WhatsApp** |
| `created_at` / `updated_at` | timestamptz | não | `now()` |

**`service_window_until` é o achado mais relevante desta tabela.** É a materialização da
regra de negócio da Meta: depois que o cliente manda uma mensagem, a empresa tem 24h para
responder livremente; fora dessa janela só pode iniciar contato por template aprovado.
Confirmando nos dados: `last_message_at = 2026-06-17T02:22:43` com
`service_window_until = 2026-06-18T02:22:35` — exatamente 24h depois da mensagem.

### Corrupção de dado real em `wa_id`

**7 das 8 linhas têm `wa_id` começando com `=`** — por exemplo `=55338…`. É o sinal de
igual das expressões do n8n (`={{ ... }}`) que vazou literalmente para dentro do banco: o
campo foi gravado com o prefixo da expressão em vez do valor avaliado.

Consequência: qualquer busca por `wa_id` exato falha nesses registros. As queries do fluxo
antigo comparavam `phone` **ou** `wa_id`, com e sem sufixo — provavelmente para contornar
justamente isso.

## `whatsapp_conversations` — 11 linhas

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `contact_id` | bigint | não | FK → `whatsapp_contacts.id` (CASCADE) |
| `status` | text | não | `'open'` |
| `assigned_to` | text | sim | |
| `last_message_at` | timestamptz | sim | |
| `created_at` / `updated_at` | timestamptz | não | `now()` |

**CHECK constraint:** `status IN ('open', 'bot', 'human', 'closed')`

**Índice único parcial:** `UNIQUE (contact_id) WHERE status <> 'closed'` — garante **uma
única conversa aberta por contato**. Modelagem correta: histórico preservado, mas sem
ambiguidade sobre qual conversa está viva.

Mais um índice: `(last_message_at DESC)`, para listar conversas recentes.

Estado real:

| status | assigned_to | n |
|---|---|---|
| `open` | NULL | 8 |
| `closed` | NULL | 3 |

Os valores `bot` e `human` existem na constraint mas **nunca foram usados**, e `assigned_to`
está sempre nulo. Ou seja: a modelagem previu "bot atendendo" vs "humano atendendo", mas o
fluxo n8n nunca escreveu isso aqui — ele usava
`dados_cliente.atendimento_temporario` (ver `04`).

## `whatsapp_messages` — 165 linhas

A tabela com mais dado real do banco. Cobre **01/06/2026 a 17/06/2026**.

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `conversation_id` | bigint | não | FK → `whatsapp_conversations.id` (CASCADE) |
| `contact_id` | bigint | não | FK → `whatsapp_contacts.id` (CASCADE) |
| `direction` | text | não | CHECK `IN ('inbound','outbound')` |
| `sender_type` | text | não | `'customer'`, CHECK `IN ('customer','bot','human','system')` |
| `message_type` | text | não | `'text'` |
| `whatsapp_message_id` | text | sim | o `wamid` da Meta |
| `body` | text | sim | |
| `media_id` | text | sim | |
| `status` | text | sim | |
| `raw_payload` | jsonb | não | `'{}'` |
| `created_at` / `received_at` | timestamptz | não | `now()` |
| `read_at` | timestamptz | sim | |

### Índices — bem pensados

- `UNIQUE (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL` — **dedupe por
  `wamid` no nível do banco**. A reentrega de evento da Meta é rejeitada pelo próprio
  Postgres. O n8n fazia isso no Redis; aqui já existe garantia estrutural.
- `(conversation_id, created_at)` — leitura da thread em ordem
- `(conversation_id) WHERE direction='inbound' AND read_at IS NULL` — contador de não lidas

### Distribuição real das mensagens

| direction | sender_type | message_type | n |
|---|---|---|---|
| outbound | bot | interactive | 61 |
| inbound | customer | interactive | 51 |
| inbound | customer | text | 31 |
| outbound | bot | text | 12 |
| **outbound** | **human** | **text** | **10** |

Três leituras diretas desses números:

1. **112 das 165 mensagens são `interactive`** — 68%. Confirma no dado que o sistema era de
   botões, não de conversa aberta.
2. **31 mensagens `inbound text`** — o cliente digitou 31 vezes. No fluxo, o único momento em
   que digitar era esperado é o nome; o resto era cliente escrevendo fora do trilho
   (saudação, dúvida, ou tentando conversar).
3. **10 mensagens `outbound human`** — o dono realmente assumiu conversas e respondeu pelo
   app. A necessidade de "humano no meio" não é hipótese: aconteceu.

### `raw_payload` guarda o envelope do espelhamento

Exemplo real de uma mensagem inbound:

```json
{
  "body": "🔘 13:00",
  "name": "<nome do contato>",
  "type": "interactive",
  "phone": "55339842****@s.whatsapp.net",
  "wa_id": "5533842****",
  "direction": "inbound",
  "timestamp": "2026-06-17T02:22:35.000Z",
  "sender_type": "customer",
  "whatsapp_message_id": "wamid.HBgMNTUzMzg0M****"
}
```

(dígitos finais mascarados aqui; o dado real está no banco)

Dois detalhes:

- **Não é o payload da Meta** — é o corpo que o n8n enviava ao endpoint de espelhamento
  (`direction`, `sender_type`, `phone`, `wa_id`, `body`). O envelope original da Cloud API
  (com `entry`/`changes`/`value`) **não foi preservado em nenhum lugar**.
- O `phone` vem no formato JID da Evolution API (`@s.whatsapp.net`) enquanto o `wa_id` vem
  limpo — e os dois **têm quantidade de dígitos diferente para o mesmo número**: o `phone`
  carrega um `9` a mais, inserido artificialmente pelo n8n depois do DDI+DDD (ver seção 9 do
  `ANEXO_FLUXO_N8N.md`). Dois campos, mesmo telefone, dígitos que não batem.
- `body` guarda o **título visível** do botão (`"🔘 13:00"`), não o `id` (`HORA_..._1300`).
  O identificador que o fluxo usava para rotear **não foi persistido**.
