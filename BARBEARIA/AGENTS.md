# Guia da barbearia

## Papel desta pasta

`BARBEARIA/` tem duas coisas que moram juntas por história, não por afinidade:

1. **O bot de WhatsApp** (Hono + TypeScript). Recebe o webhook da Meta, conduz o
   agendamento por botões e espelha a conversa no painel. **Está em standby**
   (`BOT_STANDBY=1`, decisão de 08/09/2026): recebe e grava, não responde — o
   agendamento é pelo site.
2. **O banco**: as migrações (`db/migracoes/`), o seed de teste e as ferramentas de
   acesso (`ferramentas/`). Servem o sistema inteiro, não só o bot.

## O bot

| Fluxo | Onde |
|---|---|
| Receber mensagens da Meta | `src/app.ts`, `src/whatsapp/webhook.ts` |
| Decidir a resposta (função pura) | `src/fluxo/rotear.ts` — o standby é a primeira linha |
| Consultar agenda e marcar | `src/calendario/api.ts`, `src/calendario/http.ts` |
| Espelhar conversas no painel | `src/calendario/crm.ts` |
| Receber a resposta manual do dono | `src/whatsapp/painel.ts` |

**Não tirar do standby sem a Fase 6.** As rotas públicas da API passaram a exigir a
barbearia, e o bot ainda não sabe mandá-la — voltaria tomando 400 em toda consulta de
agenda. A Fase 6 é o bot resolver a barbearia pelo `phone_number_id` que a Meta
entrega; o dado já é gravado em `webhook_eventos.numero_barbearia`.

Verificação: `npm test` e `npx tsc --noEmit`.

## O banco

Supabase `bbcuudayemhjanklfgtr` (Postgres 17.6), criado em 28/08/2026 — o antigo
(`sppexvjvnoganlduyjvs`) foi perdido. Acesso por conexão direta: `DATABASE_URL` no
`.env` desta pasta, usuário `postgres`, leitura e escrita. **Plano free: pausa após
~7 dias sem uso**, e o sintoma é o host do projeto sumir do DNS.

**Não existe cópia do schema no repositório, e isso é regra.** Para estrutura,
contagem ou conteúdo, pergunte ao banco, rodando de dentro desta pasta:

- `npm run db -- "<sql>"` — rollback no fim por padrão; `--gravar` efetiva.
- `npm run db:migrar` — aplica `db/migracoes/*.sql`; ensaia por padrão.
- `npm run db:schema` / `db:dados` — retrato completo (a saída fica fora do git).

Toda mudança de estrutura entra como migração — nunca DDL avulso, nunca pelo painel
do Supabase. Convenções em `db/migracoes/README.md`; armadilhas em
`../REGRAS-APRENDIZADOS/ANEXO_BANCO/README.md`.

**Antes de qualquer escrita, declarar o alvo** por duas checagens independentes: o
host da configuração, e um dado que só o banco de teste tem —
`select count(*) from agendamentos where source = 'seed-teste'` (teste > 0).

Duas armadilhas que já morderam:

- **O event trigger `ensure_rls` não existe neste projeto** — era do antigo. Toda
  tabela nova leva `enable row level security` na própria migração, e tabela com RLS
  sem política nega tudo, em silêncio.
- **`not null` em coluna nova quebra o código que está no ar.** Migração e deploy não
  são atômicos: ou a coluna nasce com default ou gatilho de transição, ou o `not null`
  espera o deploy.
