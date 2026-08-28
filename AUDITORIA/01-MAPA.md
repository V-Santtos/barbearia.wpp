# 01 — O mapa do sistema

## O que o sistema faz

Uma barbearia atende clientes pelo WhatsApp. Um **bot** conduz o agendamento por
botões (escolher barbeiro → dia → horário → nome → confirmar) e grava na agenda.
O **dono** acompanha tudo num painel web (PWA instalável), onde vê o calendário,
um dashboard e um CRM com as conversas do WhatsApp — e pode assumir a conversa na
mão, momento em que o bot cala.

Cliente é uma barbearia só hoje (`Lucas Costa`), mas o schema já carrega
`numero_barbearia` como discriminador de tenant.

## As peças

```
                    ┌─────────────────────────────────────┐
   WhatsApp         │  Meta Cloud API                     │
   do cliente ──────┤  (webhook + envio)                  │
                    └───────────────┬─────────────────────┘
                                    │ POST /webhook/whatsapp
                                    │ (assinatura HMAC SHA-256)
                    ┌───────────────▼─────────────────────┐
                    │  BARBEARIA/  — o bot                │
                    │  Hono + TypeScript + pg             │
                    │  porta 3333                         │
                    └──┬──────────────────────┬───────────┘
                       │ HTTP                 │ SQL direto
                       │ (nunca SQL na agenda)│
                    ┌──▼──────────────────────▼───────────┐
                    │  CALENDARIO/server.js — a API       │
                    │  Fastify + pg — porta 3334          │
                    │  2.501 linhas, 26 rotas             │
                    └──┬──────────────────────┬───────────┘
                       │                      │
                    ┌──▼────────────┐    ┌────▼────────────┐
                    │ Painel React  │    │  PostgreSQL     │
                    │ Vite, 3002    │    │  (era Supabase) │
                    │ PWA           │    │  10 tabelas     │
                    └───────────────┘    └─────────────────┘
```

### As duas pastas

| Pasta | O quê | Stack | Porta | Testes |
|---|---|---|---|---|
| `BARBEARIA/` | o bot de WhatsApp | Hono + TS + `pg` | 3333 | **195** ✅ |
| `CALENDARIO/` | API de agenda + painel do dono | Fastify + React/Vite | 3334 + 3002 | **nenhum** ⚠️ |

Essa assimetria de testes é o achado estrutural mais relevante do sistema — ver
[04-RISCOS.md](04-RISCOS.md).

## Regra de ouro da arquitetura

**O bot nunca escreve na agenda por SQL. Ele pede por HTTP à API do calendário.**
Está travado em `REGRAS.md` (2026-07-30). O motivo: a trava de double-booking
mora na API, e um segundo caminho de escrita a contornaria em silêncio.

A exceção — deliberada e documentada — é **leitura**: o bot lê as tabelas
`whatsapp_messages` / `whatsapp_contacts` direto no banco para saber se o dono
está atendendo à mão. É o mesmo banco, é dado e não regra, e uma chamada HTTP ali
cairia dentro de uma transação aberta.

## O caminho de uma mensagem, ponta a ponta

Vale a pena seguir uma vez inteiro — é o que dá o modelo mental do sistema.

**1. Chega** — `BARBEARIA/src/whatsapp/webhook.ts`
A Meta faz `POST /webhook/whatsapp`. A assinatura HMAC SHA-256 é conferida com
`META_APP_SECRET` (`src/whatsapp/assinatura.ts`) antes de qualquer coisa. O
envelope é normalizado em eventos (`src/whatsapp/eventos.ts`): `texto`, `botao`
ou `nao_suportado`.

**2. Grava e decide, tudo numa transação** — `src/db/eventos.ts` (521 linhas, o
coração do sistema)

```
BEGIN
  pg_advisory_xact_lock(hashtext(telefone))   ← serializa por contato
  INSERT webhook_eventos ... ON CONFLICT (wamid) DO NOTHING
    └─ não inseriu? é reentrega da Meta → devolve e sai
  registrarContato()      → cadastra em dados_cliente se for a 1ª mensagem
  lerBarbeirosAtivos()    → profissionais ativos
  donoAtendendo()         → o dono falou depois do último botão hoje?
  lerEtapaDoNome()        → nome em construção + reserva já fechada
  lerEscada()             → degrau de feedback + última resposta do bot
  ──> alvoDaAgenda()      → o que perguntar à API (dias? horários? marcar?)
  ──> HTTP para CALENDARIO (dentro da transação — ponytail declarado)
  ──> decidir() = rotear() → função PURA, escolhe as respostas
  UPDATE webhook_eventos SET acao = ...
COMMIT
```

**3. O estado da conversa não existe em coluna nenhuma.** Ele é *derivado* do
histórico de `webhook_eventos`: "qual foi a última coisa que o bot respondeu?".
Isso substituiu três usos de Redis do fluxo n8n antigo (estado, dedupe, lock de
rajada) sem serviço novo. É a decisão de desenho mais inteligente do sistema, e a
menos óbvia ao ler o código pela primeira vez.

Dois resets saem de graça desse desenho, sem rotina de limpeza:
- **corte no dia corrente em São Paulo** → à meia-noite tudo zera sozinho;
- **corte no último botão tocado** → tocou, voltou ao trilho, zerou o degrau.

**4. Responde** — `src/whatsapp/enviar.ts` monta o payload da Cloud API. Uma
trava de rajada (15s) cala o bot quando o cliente manda várias mensagens seguidas
— **exceto na etapa do nome**, onde calar deixaria o cliente esperando para sempre.

**5. Espelha** — `src/calendario/crm.ts` manda os dois lados da conversa para
`POST /whatsapp/events` da API, que popula o CRM do painel. **Falha em silêncio de
propósito**: painel fora do ar não pode atrapalhar o cliente.

## O caminho inverso: o dono responde à mão

Painel → `POST /whatsapp/send` (API do calendário) → `POST /mensagens` (bot,
protegido por `PAINEL_TOKEN`) → Cloud API. O bot é quem tem o token da Meta, e é
o único que fala com ela — a API do calendário não reimplementa o payload.

Quando isso acontece, `donoAtendendo()` passa a devolver `true` e o bot cala até
a meia-noite ou até o cliente tocar num botão.

## Os três pares de segredos

Este é o detalhe que mais causa erro silencioso ao montar o ambiente:

| `BARBEARIA/.env` | deve ser igual a | `CALENDARIO/.env` | protege |
|---|---|---|---|
| `CALENDARIO_WEBHOOK_TOKEN` | = | `WHATSAPP_WEBHOOK_TOKEN` | bot → calendário (espelho) |
| `PAINEL_TOKEN` | = | `BOT_PAINEL_TOKEN` | calendário → bot (envio à mão) |
| — | | `ADMIN_API_TOKEN` = `VITE_ADMIN_API_TOKEN` | painel → API |

São **três segredos distintos de propósito**: um valor só para os dois sentidos
faria um vazamento abrir as duas portas de uma vez. Está comentado no
`.env.example`, e é uma decisão boa que vale preservar.

## Onde mora o quê

**Bot** (`BARBEARIA/src/`):
- `fluxo/rotear.ts` (744 linhas) — o roteador, **função pura e síncrona**. Recebe
  contexto, devolve ações. Não toca banco nem rede. É o que torna 195 testes
  possíveis sem mock de infraestrutura.
- `fluxo/nome.ts` — leitura e junção de nome ("Victor" + "Santos" → `Victor
  Santos`; "Vicctor" + "Victor" → `Victor`, não `Vicctor Victor`).
- `fluxo/acoes.ts` — os tipos do contrato entre roteador e mundo.
- `db/eventos.ts` — a transação descrita acima.
- `whatsapp/` — assinatura, parsing, envio, webhook, rotas do painel.
- `calendario/` — cliente HTTP da API + espelho do CRM.
- `ferramentas/` — CLI de banco (`db`, `db:migrar`, `db:schema`, `db:dados`, `funil`).

**Calendário** (`CALENDARIO/`):
- `server.js` (2.501 linhas) — **a API inteira num arquivo só**, sem testes.
- `App.tsx` (1.015 linhas) — o app do painel.
- `components/` — 25 componentes + `dashboard/` (12 arquivos, CSS numerado próprio).
- `services/calendarApi.ts` (513 linhas) — cliente HTTP tipado.
- `android/` — scaffolding Capacitor, ver [05-INVENTARIO.md](05-INVENTARIO.md).

**Raiz**:
- `api/[...caminho].mjs` — adaptador que roda o Fastify como função do Vercel.
- `vercel.json` — build do painel + rewrite de SPA.
