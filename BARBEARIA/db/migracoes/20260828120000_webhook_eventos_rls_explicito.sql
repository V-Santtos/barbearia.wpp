-- Liga RLS em `webhook_eventos` explicitamente, sem depender do event trigger.
--
-- A migracao que criou a tabela (20260730140000) deixou o RLS por conta do event
-- trigger `ensure_rls`, e registrou isso como proposital — a tabela nega tudo pela
-- API publica e so o bot escreve, por conexao direta. A intencao estava certa; a
-- premissa e que caducou.
--
-- `ensure_rls` NAO e configuracao nossa: e hardening que existia naquele projeto do
-- Supabase. Reconstruindo o banco em 08/2026 num Postgres 17 limpo, o trigger nao
-- existe — e a conferencia mostrou 9 das 10 tabelas com RLS ligado e `webhook_eventos`
-- aberta, justo a que guarda o payload cru de toda mensagem (telefone e texto do
-- cliente). Uma tabela discordando das outras nove por causa de um trigger invisivel
-- e o tipo de diferenca que ninguem procura.
--
-- Aqui vale para qualquer host: Supabase novo, Postgres em container, Neon, RDS.
-- Onde o trigger existir, isto e no-op — ligar RLS ja ligado nao faz nada.
--
-- Continua SEM POLITICA, e isso segue proposital: sem politica, a API publica
-- (`anon`/`authenticated`) le zero linhas, enquanto bot e API entram por conexao
-- direta, que ignora RLS.

alter table public.webhook_eventos enable row level security;

-- rollback:
--   alter table public.webhook_eventos disable row level security;
