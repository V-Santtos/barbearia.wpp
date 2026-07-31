# WhatsApp / Meta Cloud API

O que o painel da Meta e a plataforma impõem ao nosso bot. Saiu do `CONTEXTO.md`
em 2026-07-30, quando aquele arquivo passou de 400 linhas: isto aqui é
conhecimento durável, não "onde estamos agora".

Os **porquês de desenho** do bot (contexto no id do botão, escada de feedback,
roteador puro, formato canônico de telefone) estão em [`../REGRAS.md`](../REGRAS.md),
entradas de 2026-07-30. Aqui fica só o que é da plataforma.

| Arquivo | O que tem |
|---|---|
| `README.md` (este) | o ambiente Meta e as armadilhas de plataforma |
| [`COEXISTENCIA.md`](COEXISTENCIA.md) | a decisão em aberto: usar o número que o dono já tem |
| [`NOMES_DE_USUARIO.md`](NOMES_DE_USUARIO.md) | **o telefone deixa de ser a chave.** Nomes de usuário + BSUID, já em produção desde abril/2026 e obrigatórios. Ler antes de qualquer decisão sobre identidade de cliente |

---

## O ambiente (verificado em 2026-07-29)

| | |
|---|---|
| App | **Barbearia - API**, ID `843143105019857`, modo **Ao vivo** |
| WABA ID | `830103189833653` |
| Phone Number ID | `922642447599728` |
| Número | **+55 33 8459-4968** ("Barbearia") — Conectado, qualidade Alta |
| Campos assinados | `messages` (v26.0) + `history`, `smb_app_state_sync`, `smb_message_echoes` |

**O número é descartável.** Era de um case antigo, sem vínculo com nada em uso.
Pode ser resetado ou re-onboardado à vontade.

Os três campos de coexistência já estão assinados e o endpoint já os reconhece
(`src/whatsapp/eventos.ts` os trata como `campo:` ignorado, com log). Isso é de
propósito: quando a coexistência entrar, ela entra por cima, sem retrabalho.

O fluxo n8n antigo (`webhook.autohost.shop`) está **desativado** e a Callback URL
aponta para o nosso endpoint. Há backups do n8n só para consulta visual.

## Marco atingido em 2026-07-29

Mensagem real saiu do celular → Meta → túnel → endpoint Hono local, passou pela
validação de `X-Hub-Signature-256` e foi logada. O handshake de verificação foi
confirmado como legítimo (UA `facebookplatform/1.0`, IP `2a03:2880::`, faixa da
Meta) — não era eco de teste local.

---

# As armadilhas

## A entrega é atrasada e fora de ordem, por design

**Verificado em 2026-07-30, em teste de celular.** A Meta entregou uma mensagem
**4min59s depois** de o cliente ter digitado, e o bot respondeu a ela como se
fosse de agora — o cliente já tinha avançado dois passos.

| digitado | entregue aqui | texto | o que o bot fez |
|----------|---------------|-------|-----------------|
| 16:46:35 | 16:46:38      | Oii   | saudação + menu |
| 16:43:59 | **16:48:58**  | Oi    | dica da escada, fora de hora |

**A causa foi nossa:** às 16:43:59 o webhook estava inalcançável, porque o túnel
novo ainda não tinha sido colado no painel. A Meta **enfileira e reentrega** — é
o que impede mensagem de se perder.

**Como reconhecer se reaparecer:** comparar o `timestamp` (relógio do cliente,
dentro do `payload`) com o `recebido_em` (relógio nosso) em `webhook_eventos`.
Distância de minutos entre os dois é reentrega, não bug de roteamento.

```bash
cd BARBEARIA && npm run db -- "select wamid, tipo, acao, to_timestamp((payload->>'timestamp')::bigint) as digitado, recebido_em from webhook_eventos where de = '553384246770' order by id desc limit 10"
```

**Decidido não codar nada** enquanto a causa for troca de túnel. Reabre se o
atraso aparecer **sem** isso — aí vira timeout ou 5xx nosso, que também dispara
reentrega. Levantamento já feito, para não refazer:

- **Toque em botão não sofre com atraso** — o contexto viaja dentro do id, então
  botão velho chega auto-suficiente. Só texto sofre, porque a escada de feedback
  só significa algo em relação ao *agora*.
- **Corte por idade tem caso ruim:** calaria quem mandou uma mensagem só e ficou
  esperando. O critério que separa os dois casos é *superação* — "já respondi algo
  mais novo desse contato?" —, não idade.
- **Custaria uma coluna:** hoje só `recebido_em` é coluna; o timestamp da Meta
  vive dentro do `payload`, e comparar por jsonb não indexa.
- **Descartar em silêncio conflita com regra travada** (`REGRAS.md`: "silêncio só
  existe no último degrau da escada"). Abrir exceção ou não é a decisão de
  verdade, e ela não foi tomada.

O `wamid` continua no dedupe, então reentrega da *mesma* mensagem já é absorvida.

## A janela de 24h

Fora dela só se inicia conversa por **template aprovado**. Está materializada em
`whatsapp_contacts.service_window_until` (sempre `last_message_at + 24h`) —
impacta direto o lembrete. Ver [`../ANEXO_BANCO/README.md`](../ANEXO_BANCO/README.md).

## O túnel morre a cada sessão

Ao voltar a testar recebimento, subir o túnel de novo e **recolar a URL de
callback no painel** (Webhooks → Conta comercial do WhatsApp). O verify token
continua válido, está no `BARBEARIA/.env`.

Antes de subir um túnel novo, conferir se já não há um rodando (`Get-Process
ngrok`) — o plano free aceita uma sessão por vez. O `ngrok` do PATH só executa
pelo PowerShell (`ngrok.cmd`); pelo Bash dá `Exec format error`.

## O token de envio é de teste e já vazou

`WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` estão no `BARBEARIA/.env`. O token
é **descartável e passou por log de conversa** — trocar antes da produção, que
será outro número e outro ambiente.
