# 02 — O banco, reconstruído a partir do código

> **Este é o arquivo mais importante do diretório.** O banco não existe mais, e o
> repositório nunca soube recriá-lo. O que está aqui foi derivado lendo cada query
> do código. É o que destrava o resto.
>
> **RESOLVIDO em 28/08.** O DDL abaixo virou migração versionada:
> `BARBEARIA/db/migracoes/20260730120000_base_do_esquema_herdado.sql`. A cadeia de
> 7 migrações foi validada contra um Postgres 17 limpo — 10 tabelas, 24 índices, 10
> com RLS — e as 21 consultas reais da aplicação rodaram em cima dela. Este arquivo
> continua sendo o **porquê** de cada coluna; a migração é o executável.

## O tamanho do buraco

O código usa **10 tabelas**. As migrações versionadas em
`BARBEARIA/db/migracoes/` cobrem:

| Tabela | Migração cria? | Origem |
|---|---|---|
| `webhook_eventos` | ✅ **cria inteira** | nasceu neste projeto (30/07) |
| `dados_cliente` | ⚠️ só `ALTER` | era a memória do n8n |
| `agenda_profissional` | ⚠️ só `ALTER` (constraint) | app anterior |
| `profissionais` | ❌ nada | app anterior |
| `servicos` | ❌ nada | app anterior |
| `agendamentos` | ❌ nada | app anterior |
| `dias_bloqueados` | ❌ nada | app anterior |
| `whatsapp_contacts` | ❌ nada | app anterior |
| `whatsapp_conversations` | ❌ nada | app anterior |
| `whatsapp_messages` | ❌ nada | app anterior |

**Sete tabelas não existem em lugar nenhum do repositório.** Elas vieram do
`github.com/V-Santtos/Aplicativo-FULL` e da era n8n, e só moravam no Supabase.
Isso não é descuido recente: o `CLAUDE.md` do projeto instituiu como *regra* não
versionar o schema ("pergunte ao banco, nunca a um markdown"). A regra defendia
contra documentação que envelhece — mas trocou esse risco pelo risco de perder o
banco, que foi o que aconteceu.

**O que fazer com essa regra:** ela continua certa para *consulta* (nunca confie
num markdown para saber o estado atual). Mas migração versionada não é
documentação, é código executável. As duas coisas convivem: migrações criam,
consulta confere.

## O DDL reconstruído

⚠️ **Leia a seção de incertezas antes de rodar isto.** É uma reconstrução por
inferência, não um dump. Serve para levantar um ambiente de trabalho, não para
restaurar dado perdido.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 1. profissionais — os barbeiros
-- ─────────────────────────────────────────────────────────────────────────
create table public.profissionais (
  id          bigint generated always as identity primary key,
  nome        text        not null,
  cor         text,                          -- hex, ex. '#8b5cf6'
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now()
);
-- `ativo = false` é soft delete: DELETE /profissionais/:id só faz UPDATE.
-- O bot lê `where ativo is true order by id` (ordem de cadastro, estável).

-- ─────────────────────────────────────────────────────────────────────────
-- 2. servicos — o catálogo
-- ─────────────────────────────────────────────────────────────────────────
create table public.servicos (
  id            bigint generated always as identity primary key,
  slug          text,
  nome          text not null,
  descricao     text,
  preco         numeric(10,2),
  categoria_id  bigint,        -- ver "incertezas": categoria nunca é lida
  ativo         boolean not null default true,
  ordem         integer
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. agenda_profissional — a configuração de agenda de cada barbeiro
--    Relação 1:1 com profissionais (ON CONFLICT (profissional_id))
-- ─────────────────────────────────────────────────────────────────────────
create table public.agenda_profissional (
  profissional_id        bigint primary key
                           references public.profissionais(id) on delete cascade,
  dias_semana            jsonb   not null default '[1,2,3,4,5,6]'::jsonb,
  hora_inicio            time    not null default '08:00',
  hora_fim               time    not null default '19:00',
  duracao_min            integer not null default 60,
  intervalo_inicio       time,
  intervalo_duracao_min  integer,
  janela_agendamento_dias integer default 10,
  atualizado_em          timestamptz,
  constraint agenda_profissional_janela_agendamento_dias_check
    check (janela_agendamento_dias >= 4 and janela_agendamento_dias <= 10)
);
-- `dias_semana` é jsonb com inteiros 0=Dom … 6=Sáb.
-- O teto de 10 na janela é o limite de linhas de uma lista do WhatsApp.
-- Sem linha aqui, a API usa DEFAULT_AGENDA (server.js:78).

-- ─────────────────────────────────────────────────────────────────────────
-- 4. dias_bloqueados — folgas e bloqueios
-- ─────────────────────────────────────────────────────────────────────────
create table public.dias_bloqueados (
  id              bigint generated always as identity primary key,
  profissional_id bigint not null references public.profissionais(id) on delete cascade,
  data            date   not null,
  motivo          text,
  periodos        text[],        -- {morning,afternoon,night}; NULL = dia inteiro
  created_at      timestamptz not null default now(),
  unique (profissional_id, data)
);
-- Regra do código: quando os TRÊS períodos são marcados, grava NULL
-- (server.js:1066) — "dia inteiro" e "os três períodos" são o mesmo estado.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. agendamentos — o registro do atendimento
-- ─────────────────────────────────────────────────────────────────────────
create table public.agendamentos (
  id            bigint generated always as identity primary key,
  telefone      text,
  cliente       text,
  profissional  text not null,   -- ATENÇÃO: o NOME, não FK. Ver nota abaixo.
  servico       text,
  dia_marcado   date not null,
  hora_marcada  time not null,
  status        text not null default 'agendado',
  source        text,            -- 'app-etapas' (padrão), 'presencial', bot…
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
-- `profissional` é TEXTO SEM FK, e isso é decisão travada em REGRAS.md
-- (2026-07-30). Todo JOIN no sistema é `a.profissional = p.nome`. A consequência:
-- renomear um barbeiro órfã os agendamentos dele em silêncio, e o nome NUNCA
-- pode ser digitado — tem que vir da tabela `profissionais`.
-- Status que contam como ocupado: 'agendado', 'reagendado', 'confirmado'.

-- ─────────────────────────────────────────────────────────────────────────
-- 6. dados_cliente — o cadastro do contato (herdada do n8n)
-- ─────────────────────────────────────────────────────────────────────────
create table public.dados_cliente (
  id          bigint generated always as identity primary key,
  telefone    text,
  nome        text,        -- era `nomewpp`; renomeada na migração de 30/07
  created_at  timestamptz not null default now()
);
create unique index dados_cliente_telefone_unico
  on public.dados_cliente (telefone) where telefone is not null;
-- REGRA: `nome` é o nome que o CLIENTE informou ao fechar um agendamento.
-- NUNCA o nome do perfil do WhatsApp. Nulo = saudação genérica.
-- Formato canônico do telefone: wa_id da Cloud API, dígitos puros com DDI
-- (ex.: 553399990011). Sem `9` artificial, sem sufixo @s.whatsapp.net.

-- ─────────────────────────────────────────────────────────────────────────
-- 7. webhook_eventos — DDL EXATA (a única que o repo já tinha)
--    Fonte: BARBEARIA/db/migracoes/20260730140000 + 20260730180100
-- ─────────────────────────────────────────────────────────────────────────
create table public.webhook_eventos (
  id                bigint generated always as identity primary key,
  wamid             text,
  numero_barbearia  text not null,
  de                text,
  tipo              text not null,     -- texto | botao | nao_suportado
  payload           jsonb not null,
  acao              text[],            -- {saudacao,menu_principal}
  recebido_em       timestamptz not null default now(),
  processado_em     timestamptz
);
create unique index webhook_eventos_wamid_unico
  on public.webhook_eventos (wamid) where wamid is not null;
create index webhook_eventos_contato_recente
  on public.webhook_eventos (de, recebido_em desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 8-10. O CRM do WhatsApp
-- ─────────────────────────────────────────────────────────────────────────
create table public.whatsapp_contacts (
  id                   bigint generated always as identity primary key,
  phone                text not null unique,
  wa_id                text,
  name                 text,
  last_message_at      timestamptz,
  service_window_until timestamptz,   -- janela de 24h da Meta
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

create table public.whatsapp_conversations (
  id              bigint generated always as identity primary key,
  contact_id      bigint not null references public.whatsapp_contacts(id) on delete cascade,
  status          text not null default 'open',  -- open | bot | human | closed
  assigned_to     text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create table public.whatsapp_messages (
  id                  bigint generated always as identity primary key,
  conversation_id     bigint not null references public.whatsapp_conversations(id) on delete cascade,
  contact_id          bigint not null references public.whatsapp_contacts(id) on delete cascade,
  direction           text not null,   -- inbound | outbound
  sender_type         text not null,   -- customer | bot | human | system
  whatsapp_message_id text,            -- o wamid
  message_type        text,
  body                text,
  media_id            text,
  status              text,
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  received_at         timestamptz,
  read_at             timestamptz
);
create unique index whatsapp_messages_wamid_unico
  on public.whatsapp_messages (whatsapp_message_id)
  where whatsapp_message_id is not null;
```

## Índices que o código pede e o DDL acima não tem

Derivados das queries mais quentes. Não são obrigatórios para subir, mas o
sistema fica lento sem eles assim que houver volume:

```sql
create index on public.agendamentos (dia_marcado, hora_marcada);
create index on public.agendamentos (profissional, dia_marcado);
create index on public.agendamentos (telefone);
create index on public.whatsapp_messages (conversation_id, created_at desc);
create index on public.whatsapp_conversations (last_message_at desc nulls last);
create index on public.dias_bloqueados (profissional_id, data);
```

## Incertezas — o que eu NÃO consigo saber lendo código

Honestidade sobre os limites desta reconstrução:

1. **Tipos exatos.** Uma query não revela se `preco` é `numeric(10,2)` ou
   `integer` em centavos. Onde havia `::text` explícito no SQL (`hora_inicio`,
   `dia_marcado`, `data`) a inferência é firme; no resto, é o palpite mais
   provável. `preco` é o mais incerto de todos.
2. **`servicos.categoria_id` aponta para uma tabela que o código nunca lê.**
   Existia uma `categorias` no app original. Deixei a coluna sem FK — se ela não
   for usada, o certo é apagar a coluna.
3. **Colunas legadas de `dados_cliente`.** A tabela é do n8n e provavelmente tinha
   mais colunas (estado do fluxo, etc.). O código atual só usa `telefone` e
   `nome`. Reconstruí o mínimo que o código exige.
4. **`agendamentos.status`** — conheço três valores (`agendado`, `reagendado`,
   `confirmado`) porque são os que contam como ocupado. Pode haver `cancelado`,
   `concluido`. Não há CHECK constraint no código.
5. **Defaults e NOT NULLs.** Marquei `not null` onde o código sempre grava valor.
   O banco original podia ser mais frouxo — foi justamente essa frouxidão que a
   migração de 30/07 corrigiu em `dados_cliente` (havia 17 linhas para 16
   telefones, ou seja, cliente duplicado por falta de UNIQUE).

**Como fechar essas incertezas:** se existir qualquer backup, dump ou branch antigo
do Supabase, ele responde tudo em minutos e vale mais que esta reconstrução. Vale
procurar antes de aceitar o DDL acima.

## A armadilha do Supabase que some fora dele

O `ANEXO_BANCO/README.md` documenta um event trigger chamado **`ensure_rls`**, que
liga Row Level Security automaticamente em toda tabela criada no schema `public`.
Tabela nova sem política **nega tudo pela API pública, em silêncio** — 0 linhas,
sem erro.

Duas consequências para agora:

- **Se voltar para Supabase:** criar as 10 tabelas vai disparar o trigger. O
  sistema continua funcionando porque bot e API usam **conexão direta com o
  usuário `postgres`**, que ignora RLS. Mas qualquer acesso via API pública do
  Supabase vai devolver vazio.
- **Se for para outro Postgres** (Neon, Railway, RDS, container local): esse
  trigger **não existe**, então nenhuma tabela terá RLS. Não é problema — só não
  se pode confiar em RLS como camada de proteção, e hoje o sistema não confia.

## Recomendação — estado em 28/08

1. ~~Procurar um dump ou backup~~ — **não existe.** Seguimos por reconstrução.
2. ~~Transformar o DDL em migração `000_base`~~ — **feito**, e validado do zero
   contra Postgres 17 limpo. Detalhes em `BARBEARIA/db/migracoes/README.md`.
3. **Seed com as patologias reais — ainda não feito.** É o próximo passo natural, e
   a recomendação continua de pé: reproduzir cliente com telefone em formato antigo,
   agendamento cujo `profissional` não bate com nenhum `profissionais.nome` (o órfão
   que a falta de FK permite) e dia com os três períodos bloqueados. Seed limpo dá
   confiança falsa.
4. Decidir onde o banco vai morar — Supabase novo, ou Postgres gerenciado. A
   migração roda igual nos dois; o que muda é o `ensure_rls` (ver acima) e o SSL.

## O que a validação de 28/08 provou, e o que não provou

**Provou:** as 7 migrações aplicam em ordem num banco vazio; o resultado tem as 10
tabelas, 24 índices e RLS em todas; as 21 consultas mais complexas da aplicação
(CTEs do bot, `LATERAL` do CRM, upserts com `GREATEST`, joins por nome) rodam sem
erro contra ele; e aplicar por `psql` ou pelo runner dá schema idêntico.

**Não provou:** que os tipos batem com os do banco perdido. `preco numeric(10,2)`
continua sendo palpite — nenhuma consulta revela a escala real. Se o sistema voltar
a receber dado de verdade e algum valor parecer errado, é o primeiro lugar a olhar.
