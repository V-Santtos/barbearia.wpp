# 03 — Todas as rotas HTTP

Levantado lendo `CALENDARIO/server.js` (26 rotas) e `BARBEARIA/src/` (3 rotas),
uma a uma, incluindo qual `preHandler` protege cada uma.

## API do calendário — `CALENDARIO/server.js`, porta 3334

Prefixo no deploy: `/api`. Local: raiz.

### Públicas — sem token nenhum

| Método | Rota | O que devolve | Limite |
|---|---|---|---|
| GET | `/` | health check | — |
| GET | `/profissionais` | id, nome, cor, ativo dos barbeiros ativos | — |
| GET | `/profissionais/:id/agenda` | datas bloqueadas do barbeiro | — |
| GET | `/profissionais/:id/agenda-config` | config de agenda (horários, janela) | — |
| GET | `/profissionais/:id/dias-bloqueados` | bloqueios com motivo e períodos | — |
| GET | `/agendamentos/horarios-disponiveis` | horários livres num dia | — |
| GET | `/agendamentos/dias-disponiveis` | dias com vaga na janela | — |
| GET | `/servicos` | catálogo ativo | — |
| **GET** | **`/agendamentos/verificar-telefone`** | **agendamentos de um telefone** | 20/min |
| **POST** | **`/agendamentos`** | **cria agendamento** | 10/min |

As duas últimas merecem atenção — ver [04-RISCOS.md](04-RISCOS.md):

- **`verificar-telefone`** devolve `servico, profissional, dia_marcado,
  hora_marcada, source` para qualquer telefone informado, sem autenticação. Quem
  tiver o número de uma pessoa descobre quando e com quem ela corta o cabelo.
- **`POST /agendamentos`** é público **por necessidade de desenho**: é assim que o
  bot marca, e o bot não carrega o token de admin. A trava real contra abuso é o
  rate limit de 10/min por IP — e, em serverless, o IP vem de `x-forwarded-for`.

### Protegidas por `ADMIN_API_TOKEN`

| Método | Rota |
|---|---|
| PUT | `/profissionais/:id/agenda-config` |
| POST · DELETE | `/profissionais/:id/dias-bloqueados[/:data]` |
| POST · PATCH · DELETE | `/profissionais[/:id]` |
| GET | `/agendamentos` (a lista completa — nome e telefone de todo cliente) |
| PUT · PATCH · DELETE | `/agendamentos/:id` |
| GET | `/whatsapp/conversations` |
| GET | `/whatsapp/conversations/:id/messages` |
| POST | `/whatsapp/conversations/:id/read` |
| POST | `/whatsapp/conversations/:id/send` |
| GET | `/dashboard/resumo` |

### Protegida por `WHATSAPP_WEBHOOK_TOKEN`

| Método | Rota | Quem chama |
|---|---|---|
| POST | `/whatsapp/events` | o bot, espelhando a conversa |

## Bot — `BARBEARIA/src/`, porta 3333

| Método | Rota | Proteção |
|---|---|---|
| GET | `/saude` | nenhuma (health check) |
| GET | `/webhook/whatsapp` | `WHATSAPP_VERIFY_TOKEN` (handshake da Meta) |
| POST | `/webhook/whatsapp` | **assinatura HMAC SHA-256** com `META_APP_SECRET` |
| POST | `/mensagens` | `PAINEL_TOKEN` |

A verificação de assinatura do webhook (`src/whatsapp/assinatura.ts`) é feita
antes de qualquer processamento e tem testes próprios. É a peça de segurança mais
bem-feita do sistema.

## Como o token é conferido

`buildTokenGuard()` (server.js:150) faz três coisas certas:

1. **Sem a variável configurada, responde 503** — e não 500 nem "passa direto".
   Falha aberta seria pior; falha fechada com mensagem clara é o correto.
2. **`timingSafeEqual`** — comparação em tempo constante, contra ataque de timing.
3. Aceita o token por header `Authorization: Bearer` ou `x-admin-token`.

O guard, isolado, está bem escrito. **O problema não é o guard — é que o segredo
que ele confere viaja público no bundle do painel.** Ver [04-RISCOS.md](04-RISCOS.md).

## Rate limiting

Em memória (`Map` no processo), com baldes por rota e por IP:

| Balde | Teto | Motivo do valor |
|---|---|---|
| `booking` (POST /agendamentos) | 10/min | rota pública de escrita |
| `phone-check` | 20/min | rota pública de leitura |
| `whatsapp-webhook` | 600/min | um IP só (o bot) atende todos os clientes |
| `whatsapp-read` | 240/min | polling do painel, várias abas |
| `whatsapp-write` | 40/min | balde separado para o polling não starvar o envio |
| `admin-write` / `admin-read` | 30/min | configurável por env |

A separação leitura/escrita do CRM é um cuidado real e bem pensado.

**Limitação estrutural:** o balde vive na memória do processo. Em serverless, cada
instância tem o seu — com N instâncias o teto efetivo é N×. E um restart zera
tudo. Não é defeito de implementação, é o teto da abordagem; vale saber antes de
confiar nele como proteção séria.
