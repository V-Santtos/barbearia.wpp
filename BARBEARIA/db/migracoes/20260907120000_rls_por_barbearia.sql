-- As politicas de RLS que fazem o isolamento entre barbearias existir de verdade.
--
-- ── O QUE ESTAVA ERRADO ANTES ────────────────────────────────────────────────
--
-- RLS estava LIGADA nas 10 tabelas e com ZERO politicas. Isso parece seguro e nao e:
-- e inerte. As duas metades do sistema conectam como `postgres`, que tem
-- `rolbypassrls = true` — politica nenhuma se aplica a quem ignora RLS. O isolamento
-- real era o filtro no codigo da aplicacao, e so.
--
-- Medido antes de escrever isto: `authenticated` ja tem SELECT/INSERT/UPDATE/DELETE em
-- todas as tabelas de `public` e USAGE no schema (padrao do Supabase). Entao a UNICA
-- coisa entre esse papel e o banco inteiro e a RLS. Sem politica ele le zero linhas
-- (falha fechada, que e o lado certo de falhar); com as politicas abaixo ele passa a
-- ler exatamente a propria barbearia. Nao ha GRANT a escrever aqui.
--
-- ── COMO O CONTEXTO CHEGA ────────────────────────────────────────────────────
--
-- `auth.uid()` do Supabase le `current_setting('request.jwt.claims')::jsonb->>'sub'`
-- (conferido no `prosrc`, nao assumido). Quem preenche isso e a API, por requisicao,
-- dentro da transacao:
--
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uuid do dono>"}', true);
--
-- `set local` exige transacao. E `set role` e o que faz a RLS passar a valer: o bypass
-- e propriedade do papel CORRENTE, e depois do `set role` o corrente e `authenticated`,
-- que nao tem bypass.

-- ── O papel que a API usa, e por que ele nao pode ser o `postgres` ───────────
--
-- Se a API continuasse conectando como `postgres` e so fizesse `set local role`, uma
-- rota que ESQUECESSE essa linha rodaria com bypass e devolveria o banco inteiro —
-- falha ABERTA, silenciosa, sem erro. Com um papel proprio sem bypass, a mesma
-- distracao devolve zero linhas: quebra na cara, e nao vaza.
--
-- E a diferenca entre "a RLS e a camada de seguranca" e "a RLS e a camada de seguranca
-- desde que ninguem esqueca uma linha".
--
-- SEM SENHA DE PROPOSITO. Papel com LOGIN e sem senha nao autentica, entao isto nao
-- abre porta nenhuma. A senha e segredo e nao entra em arquivo versionado: quem aplica
-- e o dono do banco, com
--
--   alter role app_api password '<senha forte>';
--
-- e depois a coloca no `.env` do calendario e nas variaveis da Vercel.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api login nobypassrls;
  end if;
end;
$$;

grant authenticated to app_api;
grant usage on schema public to app_api;

-- ── A funcao de contexto ─────────────────────────────────────────────────────
--
-- SECURITY DEFINER nao e enfeite: e o que evita RECURSAO INFINITA. A politica de
-- `barbearias` chama esta funcao, que le `barbearias` — sem definer, essa leitura
-- dispararia a politica de novo, sem fundo. Rodando como o dono (`postgres`, que tem
-- bypass), a leitura interna nao passa por politica e a recursao nao existe.
--
-- `search_path` fixo: funcao SECURITY DEFINER sem isso e um vetor classico de
-- escalonamento — quem controla o `search_path` da sessao escolhe qual `barbearias`
-- a funcao vai ler.
--
-- STABLE para o planejador avaliar uma vez por consulta, e nao uma vez por linha.
create or replace function public.barbearia_atual()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.barbearias where user_id = auth.uid()
$$;

grant execute on function public.barbearia_atual() to authenticated;

-- ── As politicas ─────────────────────────────────────────────────────────────
--
-- `for all` e nao so `for select`: sem `with check`, um dono autenticado poderia
-- INSERIR ou MOVER uma linha para OUTRA barbearia. `using` filtra o que ele enxerga;
-- `with check` filtra o que ele consegue gravar. Faltar o segundo e o erro classico —
-- a leitura fica isolada e a escrita nao.
--
-- `to authenticated` deixa `anon` de fora: quem nao fez login nao le nada por aqui. As
-- rotas publicas (site e bot) nao passam por este caminho — elas entram pela conexao de
-- servico, com o filtro por barbearia explicito no codigo, porque sao anonimas por
-- natureza e nao ha identidade em que ancorar politica.

create policy barbearias_propria on public.barbearias
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profissionais_da_barbearia on public.profissionais
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy servicos_da_barbearia on public.servicos
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy agendamentos_da_barbearia on public.agendamentos
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy dados_cliente_da_barbearia on public.dados_cliente
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy whatsapp_contacts_da_barbearia on public.whatsapp_contacts
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy whatsapp_conversations_da_barbearia on public.whatsapp_conversations
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy whatsapp_messages_da_barbearia on public.whatsapp_messages
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

create policy webhook_eventos_da_barbearia on public.webhook_eventos
  for all to authenticated
  using (barbearia_id = public.barbearia_atual())
  with check (barbearia_id = public.barbearia_atual());

-- As duas que nao tem `barbearia_id`, e nao vao ter: penduram em `profissionais` por
-- FK, e o dono sai do join. Denormalizar a coluna aqui criaria uma segunda fonte da
-- mesma verdade — e o dia em que um `update` mexesse numa e nao na outra, a agenda de
-- um barbeiro apareceria para a loja errada sem nada indicar o problema.

create policy agenda_profissional_da_barbearia on public.agenda_profissional
  for all to authenticated
  using (exists (select 1 from public.profissionais p
                  where p.id = profissional_id
                    and p.barbearia_id = public.barbearia_atual()))
  with check (exists (select 1 from public.profissionais p
                       where p.id = profissional_id
                         and p.barbearia_id = public.barbearia_atual()));

create policy dias_bloqueados_da_barbearia on public.dias_bloqueados
  for all to authenticated
  using (exists (select 1 from public.profissionais p
                  where p.id = profissional_id
                    and p.barbearia_id = public.barbearia_atual()))
  with check (exists (select 1 from public.profissionais p
                       where p.id = profissional_id
                         and p.barbearia_id = public.barbearia_atual()));

-- rollback:
--   drop policy barbearias_propria on public.barbearias;  -- e assim nas outras 10
--   drop function public.barbearia_atual();
--   revoke authenticated from app_api;  drop role app_api;
