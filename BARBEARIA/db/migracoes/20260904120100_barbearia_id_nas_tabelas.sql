-- Da dono a cada linha do sistema: `barbearia_id` nas oito tabelas de tenant.
--
-- Ate aqui "de quem e este dado?" nao tinha resposta no banco — tinha uma suposicao no
-- codigo, a de que so existe uma barbearia. Esta migracao troca a suposicao por uma
-- coluna, que e a diferenca entre um isolamento que o Postgres pode garantir e um que
-- depende de todo autor de query lembrar do filtro.
--
-- DUAS TABELAS FICAM DE FORA, E ISSO E DESENHO, NAO ESQUECIMENTO:
-- `agenda_profissional` e `dias_bloqueados` penduram em `profissionais` por FK, e a
-- politica de RLS delas (Fase 2) resolve por join. Denormalizar `barbearia_id` ali
-- criaria uma segunda fonte da mesma verdade — e o dia em que um `update` mexesse numa
-- e nao na outra, a agenda de um barbeiro ficaria visivel pra loja errada sem nada
-- indicar o problema.
--
-- ORDEM DAS OPERACOES, por tabela: adiciona nullable -> backfill -> `set not null`.
-- Adicionar ja com `not null` exigiria um default, e default aqui seria mentira: a
-- barbearia certa de cada linha e coisa que se descobre, nao que se assume. O
-- `set not null` no fim e o que transforma "o backfill funcionou" de esperanca em
-- garantia — se sobrou linha orfa, a migracao para aqui em vez de deixar buraco.

-- ── A loja de todo o dado que ja existe ──────────────────────────────────────
--
-- Uma barbearia so existe hoje, entao o backfill e trivial. `webhook_eventos` e a
-- excecao: la o dono NAO e assumido, e derivado do `numero_barbearia` que a Meta
-- mandou. Isso e de proposito — e o primeiro exercicio real da resolucao
-- `phone_number_id -> barbearia` que o bot vai fazer a cada mensagem (Fase 4). Se essa
-- juncao deixar alguma linha de fora, o `set not null` acusa aqui, na migracao, e nao
-- em producao com um cliente esperando resposta.

alter table public.profissionais          add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.servicos               add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.agendamentos           add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.dados_cliente          add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.whatsapp_contacts      add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.whatsapp_conversations add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.whatsapp_messages      add column if not exists barbearia_id bigint references public.barbearias (id);
alter table public.webhook_eventos        add column if not exists barbearia_id bigint references public.barbearias (id);

update public.profissionais          set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.servicos               set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.agendamentos           set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.dados_cliente          set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.whatsapp_contacts      set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.whatsapp_conversations set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;
update public.whatsapp_messages      set barbearia_id = (select id from public.barbearias where slug = 'lucas-costa') where barbearia_id is null;

update public.webhook_eventos e
   set barbearia_id = b.id
  from public.barbearias b
 where b.whatsapp_phone_number_id = e.numero_barbearia
   and e.barbearia_id is null;

-- ── O DEFAULT DE TRANSICAO, sem o qual esta migracao derruba o sistema no ar ──
--
-- `not null` sem default quebra TODO INSERT do codigo que esta em producao neste
-- momento: o `server.js` grava agendamento sem esta coluna, e o bot grava
-- `webhook_eventos`, `dados_cliente`, `whatsapp_contacts`, `whatsapp_conversations` e
-- `whatsapp_messages` sem ela. Nenhum desses caminhos sabe que barbearias existem.
--
-- Migracao e deploy nao sao atomicos entre si: o banco muda por um comando, o codigo
-- por outro, e existe um intervalo entre os dois. Sem o default, esse intervalo e o
-- sistema inteiro fora do ar — cliente sem resposta no WhatsApp, painel sem conseguir
-- marcar. Com ele, o codigo velho continua gravando na unica barbearia que ele conhece,
-- que e a certa, e o codigo novo sobrescreve com o valor explicito.
--
-- Uma FUNCAO e nao um literal `default 1`: ela se explica sozinha ao aparecer num
-- `\d+`, e nao depende de a identity ter comecado onde a gente imagina.
--
-- TEM DATA PRA MORRER. Sai junto com o gatilho de transicao de `profissional_id`,
-- depois que bot e calendario passarem a mandar `barbearia_id` explicito (Fase 4).
-- Enquanto existir, ele tem um risco proprio e conhecido: um INSERT novo que ESQUECA a
-- coluna nao da erro — cai na loja A em silencio. E o preco de nao ter janela de
-- indisponibilidade, e por isso ele nao pode virar moradia.
create or replace function public.barbearia_em_transicao()
returns bigint
language sql
stable
as $$ select id from public.barbearias where slug = 'lucas-costa' $$;

alter table public.profissionais          alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.servicos               alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.agendamentos           alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.dados_cliente          alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.whatsapp_contacts      alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.whatsapp_conversations alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.whatsapp_messages      alter column barbearia_id set default public.barbearia_em_transicao();
alter table public.webhook_eventos        alter column barbearia_id set default public.barbearia_em_transicao();

alter table public.profissionais          alter column barbearia_id set not null;
alter table public.servicos               alter column barbearia_id set not null;
alter table public.agendamentos           alter column barbearia_id set not null;
alter table public.dados_cliente          alter column barbearia_id set not null;
alter table public.whatsapp_contacts      alter column barbearia_id set not null;
alter table public.whatsapp_conversations alter column barbearia_id set not null;
alter table public.whatsapp_messages      alter column barbearia_id set not null;
alter table public.webhook_eventos        alter column barbearia_id set not null;

-- `numero_barbearia` FICA, e nao vira coluna redundante. Ele e o dado BRUTO que a Meta
-- entregou; `barbearia_id` e a resolucao dele naquele momento. Guardar os dois e o que
-- permite reprocessar um evento antigo depois de um cadastro mudar de numero — com so
-- a resolucao gravada, o historico passaria a mentir retroativamente.

-- ── Os uniques globais que viram por-barbearia ───────────────────────────────
--
-- Estes dois eram o vazamento mais concreto do modelo antigo, e nao davam erro nenhum:
-- um cliente que falasse com DUAS barbearias viraria uma linha so. No caso de
-- `whatsapp_contacts` isso significa a conversa dele aparecendo no painel dos dois
-- donos. No de `dados_cliente`, o nome dado a uma loja saudando ele na outra.
--
-- `dados_cliente` mantem o recorte parcial `where telefone is not null` do indice
-- original: a coluna e nullable, e em Postgres varios NULL nao conflitam entre si — mas
-- o `on conflict` do `registrarContato` precisa que o alvo case EXATAMENTE com o
-- indice, clausula parcial inclusive. Trocar isso aqui sem trocar la quebra o cadastro
-- de contato na primeira mensagem.

alter table public.whatsapp_contacts drop constraint if exists whatsapp_contacts_phone_key;
create unique index if not exists whatsapp_contacts_barbearia_phone
  on public.whatsapp_contacts (barbearia_id, phone);

drop index if exists public.dados_cliente_telefone_unico;
create unique index if not exists dados_cliente_barbearia_telefone
  on public.dados_cliente (barbearia_id, telefone)
  where telefone is not null;

-- ── Indices para o filtro que passa a existir em toda consulta ───────────────
--
-- So nas tres tabelas que crescem sem teto. Com uma barbearia so, `barbearia_id =
-- <x>` casa com tudo e o planejador ignora o indice de qualquer jeito; ele passa a
-- valer quando houver dezenas de lojas, e ai ja sera tarde pra criar indice em tabela
-- grande sem incomodar ninguem. Cadastro (`profissionais`, `servicos`) fica de fora:
-- sao dezenas de linhas por loja, varredura resolve.

create index if not exists agendamentos_barbearia      on public.agendamentos (barbearia_id);
create index if not exists webhook_eventos_barbearia   on public.webhook_eventos (barbearia_id);
create index if not exists whatsapp_messages_barbearia on public.whatsapp_messages (barbearia_id);

-- rollback:
--   drop index public.dados_cliente_barbearia_telefone;
--   create unique index dados_cliente_telefone_unico on public.dados_cliente (telefone) where telefone is not null;
--   drop index public.whatsapp_contacts_barbearia_phone;
--   alter table public.whatsapp_contacts add constraint whatsapp_contacts_phone_key unique (phone);
--   alter table public.profissionais drop column barbearia_id;   -- e assim nas outras sete
