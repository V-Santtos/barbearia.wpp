# 01 — Inventário do banco

Estado em 2026-07-30. Schema `public`, 12 tabelas.

## As 12 tabelas

| Tabela | Linhas | Papel no sistema antigo | Quem escrevia |
|---|---|---|---|
| `profissionais` | 2 | cadastro dos barbeiros | app de calendário |
| `agenda_profissional` | 2 | horário de trabalho e duração do atendimento, 1 linha por barbeiro | app de calendário |
| `dias_bloqueados` | 1 | folga/feriado por data, com períodos | app de calendário |
| `agendamentos` | 13 | os agendamentos em si | app **e** bot n8n |
| `servicos` | 6 | catálogo de serviços com preço | app de calendário |
| `categorias_servicos` | 4 | agrupamento dos serviços | app de calendário |
| `configuracao` | 3 | chave/valor jsonb (textos do site, cópia dos serviços) | app de calendário |
| `documentos_bot` | 1 | ponteiro pro PDF da tabela de preços | manual |
| `dados_cliente` | 17 | **estado da conversa do bot** | bot n8n |
| `whatsapp_contacts` | 8 | contatos de WhatsApp | endpoint de espelhamento |
| `whatsapp_conversations` | 11 | conversas (com status open/bot/human/closed) | endpoint de espelhamento |
| `whatsapp_messages` | 165 | histórico de mensagens nas duas direções | endpoint de espelhamento |

Três blocos distintos convivendo no mesmo schema:

1. **Agenda** (`profissionais`, `agenda_profissional`, `dias_bloqueados`, `agendamentos`,
   `servicos`, `categorias_servicos`, `configuracao`, `documentos_bot`) — dono é o app de
   calendário.
2. **Estado do bot** (`dados_cliente`) — dono era o n8n.
3. **Mensageria/CRM** (`whatsapp_*`) — alimentado pelo endpoint
   `POST /whatsapp/events` do calendário.

## Mapa de relações (chaves estrangeiras reais)

```
profissionais (id)
  ├── agenda_profissional.profissional_id   (PK = FK, 1:1, ON DELETE CASCADE)
  └── dias_bloqueados.profissional_id       (1:N, ON DELETE CASCADE)

categorias_servicos (id: text)
  └── servicos.categoria_id                 (ON UPDATE CASCADE, ON DELETE RESTRICT)

whatsapp_contacts (id)
  ├── whatsapp_conversations.contact_id     (ON DELETE CASCADE)
  └── whatsapp_messages.contact_id          (ON DELETE CASCADE)

whatsapp_conversations (id)
  └── whatsapp_messages.conversation_id     (ON DELETE CASCADE)
```

**Tabelas sem nenhuma FK — ilhas:**

- `agendamentos` — não referencia `profissionais` nem `servicos`. Guarda **texto solto**
  (`profissional`, `servico`, `cliente`, `telefone`).
- `dados_cliente` — não referencia `whatsapp_contacts`. A ligação era por `telefone`, sem
  constraint. E o formato de telefone difere entre as duas (ver `04` e `05`).
- `configuracao`, `documentos_bot` — chave/valor isolados.

## Histórico de migrações

O schema **é versionado** — existe `supabase_migrations.schema_migrations` com 4 entradas,
todas de 17/05/2026:

| Versão | Nome |
|---|---|
| `20260517151944` | `booking_window_days` |
| `20260517153223` | `require_service_category` |
| `20260517153305` | `restrict_service_category_delete` |
| `20260517153717` | `unique_active_booking_slot` |

Ou seja: as tabelas originais foram criadas fora de migração (provavelmente no editor do
painel), e só essas 4 alterações posteriores passaram pelo CLI. O histórico é **parcial** —
não dá pra recriar o banco do zero a partir dele.

## Sequências / identidade

Todas as PKs `bigint` usam identidade/sequência gerada pelo Postgres, exceto:

- `categorias_servicos.id` — `text` (slug: `cabelo`, `barba`, `combos`, `outros`)
- `configuracao.chave` — `text` (`categorias`, `home`, `servicos`)
- `agenda_profissional.profissional_id` — PK que também é FK (1:1 com `profissionais`)

Nota: a tabela `documentos_bot` tem uma coluna **removida** ainda presente fisicamente
(`........pg.dropped.3........`), resquício de um `DROP COLUMN`. Inofensivo, mas indica
edição manual no painel.

## Extensões instaladas

| Extensão | Versão | Observação |
|---|---|---|
| `plpgsql` | 1.0 | padrão |
| `pgcrypto` | 1.3 | padrão do Supabase |
| `uuid-ossp` | 1.1 | padrão do Supabase |
| `pg_stat_statements` | 1.11 | métricas de query |
| `supabase_vault` | 0.3.1 | padrão do Supabase |

**Não** estão instaladas: `pg_cron`, `pg_net`, `pgvector`, `pg_graphql`. (Os event triggers
que dariam acesso a `pg_cron`/`pg_net` existem, mas as extensões não foram criadas.)

## Schemas presentes

`public`, `auth`, `storage`, `realtime`, `graphql`, `graphql_public`, `extensions`,
`vault`, `supabase_migrations` — todos padrão do Supabase, mais o `public` do projeto.

## Supabase Auth

**`auth.users` está vazio: 0 usuários.** Ninguém nunca autenticou por Supabase Auth neste
projeto. O app de calendário não usa (ou usa outro mecanismo), e o bot n8n conectava com
credencial de serviço.

## Storage

| Bucket | Público? | Objetos |
|---|---|---|
| `tabelas` | **sim** | 1 (`tabela-servicos.pdf`) |
| `FOTO` | **sim** | 1 |

O PDF da tabela de preços que o bot enviava vive em `tabelas/tabela-servicos.pdf`,
referenciado por `documentos_bot.storage_path`.
