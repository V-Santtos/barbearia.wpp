# CALENDARIO

A ferramenta do **dono da barbearia**: uma API (Fastify + `pg`) e um painel de
calendário (React + Vite) que leem e escrevem no mesmo Supabase que o bot de
WhatsApp usa.

Veio de `github.com/V-Santtos/Aplicativo-FULL` em 2026-07-30 e foi podada para
caber no escopo deste projeto. **A poda tem um commit próprio** — o anterior tem
a pasta intacta, e o diff entre os dois é o registro do que saiu.

## O que esta pasta NÃO é

Ela servia a três consumidores; sobrou um. Isso explica quase toda decisão aqui:

- **Não há site público de agendamento.** O `SITE-BARB-PROF-UNICO` não foi
  trazido. Com ele saíram `GET/PUT /configuracao/:chave`,
  `GET/PUT /categorias-servicos` e `PUT /servicos`.
- **Não há n8n.** Era o webhook de WhatsApp do sistema antigo, aposentado. Saíram
  a notificação a cada agendamento e o transporte de envio de mensagem.
- **Não há integração com o bot ainda.** As rotas `/whatsapp/*` estão de pé como
  a costura pronta, mas ninguém escreve nelas hoje — o painel de conversas
  aparece vazio, e isso é o esperado, não defeito.

## Como rodar

```bash
cd CALENDARIO && npm install
```

Dois processos, e o painel precisa da API no ar:

| Comando | O quê | Porta |
|---|---|---|
| `npm run server` | a API | 3334 |
| `npm run dev` | o painel | 3002 |

**A API é 3334, não 3333.** A 3333 é do bot de WhatsApp (`BARBEARIA/`), e a
integração precisa dos dois no ar ao mesmo tempo — antes eram os dois na mesma
porta e não subiam juntos. Mapa desta máquina:

| 3000 | 3002 | 3333 | 3334 |
|---|---|---|---|
| portfólio (Vite) | painel do calendário | bot de WhatsApp | esta API |

Copie `.env.example` para `.env`. As variáveis:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão Postgres do Supabase (a mesma do bot) |
| `PORT` | porta da API (3334) |
| `ADMIN_API_TOKEN` | destrava as rotas administrativas |
| `WHATSAPP_WEBHOOK_TOKEN` | destrava `POST /whatsapp/events` |
| `CORS_ORIGINS` | origens liberadas; padrão é só a 3002 |
| `VITE_CALENDAR_API_URL` | onde o painel procura a API |
| `VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` | o "login" do dono — leia a armadilha abaixo |
| `VITE_ADMIN_API_TOKEN` | token que o painel manda nas rotas admin |

Migração de estrutura **não se faz aqui**: o histórico único do projeto é
`BARBEARIA/db/migracoes/`. As duas migrações que vieram nesta pasta já estavam
aplicadas no banco e foram removidas para não criar um segundo histórico.

## As rotas

`Admin` exige `Authorization: Bearer <ADMIN_API_TOKEN>` (ou `X-Admin-Token`).
Todas passam por rate limit por IP, janela de 60s.

| Método | Rota | Acesso |
|---|---|---|
| GET | `/` | aberta |
| GET | `/profissionais` | aberta |
| POST | `/profissionais` | admin |
| PATCH | `/profissionais/:id` | admin |
| DELETE | `/profissionais/:id` | admin (soft delete) |
| GET | `/profissionais/:id/agenda` | aberta — só os dias indisponíveis, 90 dias |
| GET | `/profissionais/:id/agenda-config` | aberta |
| PUT | `/profissionais/:id/agenda-config` | admin |
| GET | `/profissionais/:id/dias-bloqueados` | aberta |
| POST | `/profissionais/:id/dias-bloqueados` | admin |
| DELETE | `/profissionais/:id/dias-bloqueados/:data` | admin |
| GET | `/agendamentos/verificar-telefone?phone=` | aberta |
| GET | `/agendamentos/horarios-disponiveis?professionalId=&date=` | aberta |
| GET | `/agendamentos/dias-disponiveis?professionalId=&days=` | aberta |
| GET | `/agendamentos?professionalId=&date=` | admin |
| POST | `/agendamentos` | **aberta** |
| PUT | `/agendamentos/:id` | admin |
| PATCH | `/agendamentos/:id/status` | admin |
| DELETE | `/agendamentos/:id` | admin (apaga de verdade) |
| GET | `/servicos` | aberta, só leitura |
| POST | `/whatsapp/events` | `WHATSAPP_WEBHOOK_TOKEN` |
| GET | `/whatsapp/conversations` | admin |
| GET | `/whatsapp/conversations/:id/messages` | admin |
| POST | `/whatsapp/conversations/:id/read` | admin |
| POST | `/whatsapp/conversations/:id/send` | admin — **responde 501** |

### O contrato das três rotas que a integração usa

Verificado por chamada real em 2026-07-30, contra o banco de verdade.

**Quais dias têm vaga** — uma chamada resolve a janela inteira, em vez de uma por dia:

```
GET /agendamentos/dias-disponiveis?professionalId=2&days=10
→ { professionalId, days,
    openDays: [{ date, availableSlotsCount, totalSlotsCount, occupancyRatio, firstSlot }],
    disabledDays: [...] }
```

**Quais horários naquele dia:**

```
GET /agendamentos/horarios-disponiveis?professionalId=1&date=2026-07-31
→ { professionalId, date, availableSlots: ["08:00","09:00","10:00","13:00", ...] }
```

Os slots já vêm filtrados por tudo: expediente, dia da semana, intervalo de
descanso, bloqueio de período, agendamento existente e antecedência mínima. Não há
nada a recalcular do lado de quem chama.

**Marcar:**

```
POST /agendamentos
{ cliente, telefone, profissional (NOME, não id), dia_marcado, hora_marcada,
  servico?, status?, source? }
→ 201 { message, event }
→ 409 se o horário caiu no meio do caminho, fora da janela ou dia bloqueado
```

O `409` é a resposta certa e esperada — a rota revalida tudo de novo e ainda
trata a corrida pelo índice único do banco. Quem chama não precisa checar antes.

**Entregar mensagem do WhatsApp no painel** (testado: 401 sem token, 201 com
token, e reenviar o mesmo `whatsapp_message_id` **não duplica**):

```
POST /whatsapp/events          Authorization: Bearer <WHATSAPP_WEBHOOK_TOKEN>
{ direction, sender_type, phone, wa_id, name, type, body,
  timestamp, whatsapp_message_id, raw }
```

O telefone atravessa **em dígitos puros** (`5533999990000`), que é o formato
canônico do bot — não vira JID. Nenhuma tradução é necessária.

## Armadilhas

O que uma consulta ao banco ou uma leitura rápida do código não entrega.

### Fuso horário — resolvido, mas saiba por quê

`isWithinBookingWindow` e `isAfterMinimumNotice` perguntam a hora ao **processo
Node**, não ao banco. Na VPS do sistema antigo isso funcionava porque a máquina
era de Brasília. Num host UTC — o padrão em plataforma de deploy — a antecedência
mínima de 15 min e a virada do dia ficariam **3 horas fora**, sem erro e sem log:
o sistema apenas ofereceria ou recusaria horário errado.

O topo do `server.js` fixa `process.env.TZ = "America/Sao_Paulo"` antes de
qualquer `new Date()`. As funções de data já estavam certas; faltava o relógio.
`TZ` vindo do ambiente continua tendo precedência, para o dia em que houver
barbearia em outro fuso.

### Manhã/tarde/noite não têm fronteira fixa

`slotPeriod` deriva o corte manhã/tarde do `intervalo_inicio` **de cada
profissional**. Só o início da noite é fixo, 18:00. Quem for perguntar "de manhã
ou à tarde?" precisa ler `agenda-config`; cravar 12:00 dá resposta errada para
quem tem intervalo em outro horário.

### `agendamentos.profissional` é texto, não FK

A trava de double-booking é um índice único parcial em
`(profissional, dia_marcado, hora_marcada)` para status ativos — e depende do
**nome bater exatamente**. "Lucas costa" e "Lucas Costa" furam a trava.

### `POST /agendamentos` é escrita aberta e sem idempotência

Não pede token; a única barreira é o rate limit de 10 por minuto por IP. E não
aceita chave de idempotência: um retry por timeout volta `409` sem distinguir
"outra pessoa pegou o horário" de "fui eu mesmo que já criei".

### O login do dono não tranca nada

`LoginScreen.tsx` compara com `VITE_OWNER_PASSWORD` — variável `VITE_*`, portanto
**embutida no bundle do navegador**, e o campo de senha ainda vem pré-preenchido
com ela. Segura contra quem abre a URL por acaso, não contra quem abre o
DevTools. Quem tranca de fato é o `ADMIN_API_TOKEN` na API. Decisão de produção,
fora do escopo desta poda.

### O painel é polling puro

Sem WebSocket: agendamentos a cada 15s, lista de conversas a cada 8s, mensagens
de uma conversa aberta a cada 5s. Escrita feita por fora aparece dentro dessas
janelas.

### `dados_cliente` é do bot, não daqui

O `POST /agendamentos` **não escreve** naquela tabela. O código antigo escrevia,
com o telefone em JID (`...@s.whatsapp.net`) e numa coluna que não existe mais —
duplicava o cliente e derrubava a rota com 500 depois de já ter criado o
agendamento. O telefone canônico do sistema é o `wa_id` em dígitos puros.

### O catálogo de serviços virou somente leitura

`GET /servicos` alimenta o dropdown do `EventModal`. Quem editava era o painel do
site, que não existe mais aqui — até haver tela nossa, edita-se pelo Supabase.
