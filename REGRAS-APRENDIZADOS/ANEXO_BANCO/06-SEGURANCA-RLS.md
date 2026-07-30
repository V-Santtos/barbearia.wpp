# 06 — Segurança: RLS, grants, funções e triggers

Estado em 2026-07-30. Esta é a parte do banco que mais interage com decisões já travadas
nossas (RLS + `tenant_id` em toda tabela, Supabase Auth) — e a que está mais frágil hoje.

## O quadro atual em uma frase

**Todas as 12 tabelas têm RLS ativado e nenhuma tem política.** Ao mesmo tempo, os papéis
`anon` e `authenticated` têm **privilégio total** (SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER) em todas elas. Ou seja: o RLS sem política é a **única** coisa
impedindo acesso público de escrita ao banco.

RLS ativado sem política nenhuma = nega tudo para `anon`/`authenticated`. Funciona como
tranca, mas é uma tranca acidental: qualquer `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
em qualquer uma das 12 tabelas expõe aquela tabela para escrita por qualquer pessoa com a
chave pública do projeto.

Por que nada quebrou até hoje: tanto o app de calendário quanto o bot n8n acessavam por
credencial de serviço (`service_role`) ou conexão direta Postgres, e **essas ignoram RLS**.

## Grants por papel

Verificado em `information_schema.role_table_grants`. Padrão idêntico nas 12 tabelas:

| papel | privilégios |
|---|---|
| `anon` | UPDATE, INSERT, SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER |
| `authenticated` | UPDATE, INSERT, SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER |
| `service_role` | UPDATE, INSERT, SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER |

É o default do Supabase para tabelas criadas no schema `public` sem revogação explícita.
Ninguém apertou nada.

## O event trigger que liga RLS sozinho

Existe um event trigger chamado **`ensure_rls`**, disparando em `ddl_command_end`, que
executa a função `public.rls_auto_enable()`:

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IN ('public') ... THEN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        ...
```

**Isso explica o "RLS ativado sem políticas" em todas as tabelas:** não foi escolha do
usuário, é automação. Toda tabela criada no schema `public` recebe RLS ligado
automaticamente, e nunca ganha política.

**Implicação direta para o nosso código:** qualquer tabela que criarmos em `public` vai
nascer com RLS ligado e negando tudo pela API pública. Isso é bom (fail-closed), mas
significa que **criar tabela e esquecer a política = tabela inacessível pela API**, com
falha silenciosa (0 linhas, sem erro).

Nota: a função é `SECURITY DEFINER` com `search_path` fixado em `pg_catalog` — feita com
cuidado, e é padrão de hardening do Supabase, não código do projeto.

## Outros event triggers (todos padrão do Supabase)

| Nome | Evento | Função |
|---|---|---|
| `issue_graphql_placeholder` | `sql_drop` | `set_graphql_placeholder` |
| `pgrst_ddl_watch` | `ddl_command_end` | `pgrst_ddl_watch` (recarrega o PostgREST) |
| `pgrst_drop_watch` | `sql_drop` | `pgrst_drop_watch` |
| `issue_pg_cron_access` | `ddl_command_end` | `grant_pg_cron_access` |
| `issue_pg_net_access` | `ddl_command_end` | `grant_pg_net_access` |
| `issue_pg_graphql_access` | `ddl_command_end` | `grant_pg_graphql_access` |
| **`ensure_rls`** | `ddl_command_end` | **`rls_auto_enable`** ← o relevante |

## Funções em `public`

Só duas:

| Função | Tipo | Observação |
|---|---|---|
| `rls_auto_enable()` | event trigger | **SECURITY DEFINER** (comentada acima) |
| `set_updated_at()` | trigger | `new.updated_at = now(); return new;` |

Nenhuma função de negócio no banco. Toda a lógica de disponibilidade (calcular dias e
horários livres a partir de `agenda_profissional` + `dias_bloqueados` + `agendamentos`)
vive **fora**, no código do app de calendário — não em função SQL.

## Triggers de tabela

| Tabela | Trigger | Função |
|---|---|---|
| `agendamentos` | `agendamentos_updated_at` | `set_updated_at()` |
| `categorias_servicos` | `set_categorias_servicos_updated_at` | `set_updated_at()` |
| `servicos` | `set_servicos_updated_at` | `set_updated_at()` |

**Só 3 das 12 tabelas mantêm `updated_at` automaticamente.** `whatsapp_contacts` e
`whatsapp_conversations` têm a coluna `updated_at` mas **não têm trigger** — o valor só muda
se o app escrever explicitamente.

## Views

Nenhuma. (Relevante porque view é um dos pontos onde RLS falha em silêncio — sem view, esse
risco não existe hoje.)

## Supabase Auth

`auth.users` tem **0 registros**. Não há usuário, então não há `auth.uid()` para basear
política de RLS. Qualquer política que a gente escreva com `(select auth.uid())` não tem
sujeito ainda — o Supabase Auth precisa ser efetivamente adotado primeiro.

## Storage

Dois buckets, **ambos públicos**:

| Bucket | Público | Objetos |
|---|---|---|
| `tabelas` | sim | 1 (`tabela-servicos.pdf`) |
| `FOTO` | sim | 1 |

Bucket público significa URL acessível por qualquer pessoa que a conheça, sem
autenticação. Para o PDF da tabela de preços isso é intencional (o bot manda o link pro
cliente). Para `FOTO`, não sabemos o conteúdo nem a intenção.

## Referência técnica adotada

A skill oficial `supabase-postgres-best-practices` (ver `docs/skills-log.md`, entrada de
2026-07-30) tem o arquivo `references/security-rls-performance.md` que vale reler antes de
escrever política: `using (auth.uid() = x)` executa a função **por linha**;
`using ((select auth.uid()) = x)` executa uma vez. E a skill `supabase` traz o checklist de
armadilhas — `user_metadata` editável pelo usuário, view sem `security_invoker`, UPDATE sem
política de SELECT falhando em silêncio, UPDATE sem `WITH CHECK` permitindo reatribuir
dono, `TO authenticated` sozinho sendo IDOR.
