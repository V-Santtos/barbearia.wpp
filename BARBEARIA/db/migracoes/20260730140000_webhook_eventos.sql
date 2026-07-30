-- Registro de todo evento que a Meta entrega no webhook.
--
-- Uma linha por evento recebido, imutavel. Uma tabela so, servindo a quatro coisas:
--   1. dedupe -- a Meta reentrega evento por design; `wamid` unico rejeita a segunda vez;
--   2. anti-repeticao em rajada -- "ja respondi isso pra esse contato agora ha pouco?";
--   3. replay pra depurar -- o payload cru fica (retencao de log de plataforma e curta);
--   4. prova do que aconteceu, pras proximas fatias do fluxo.
--
-- Substitui os tres usos de Redis do fluxo n8n antigo (state, dedupe e lock de rajada)
-- sem servico novo pra manter.
--
-- RLS: o event trigger `ensure_rls` liga row level security nesta tabela sozinho, e nao
-- existe politica. Isso e PROPOSITAL: a tabela nega tudo pela API publica (anon e
-- authenticated) e so o bot escreve, por conexao direta. Nao "consertar" isso depois.

create table if not exists public.webhook_eventos (
  id                bigint      generated always as identity primary key,
  wamid             text,
  numero_barbearia  text        not null,
  de                text,
  tipo              text        not null,
  payload           jsonb       not null,
  acao              text,
  recebido_em       timestamptz not null default now(),
  processado_em     timestamptz
);

comment on table public.webhook_eventos is
  'Eventos crus do webhook da Cloud API. Imutavel, um registro por evento recebido.';
comment on column public.webhook_eventos.numero_barbearia is
  'phone_number_id da Meta. Discriminador de tenant enquanto nao existe tabela barbearias.';
comment on column public.webhook_eventos.de is
  'wa_id de quem mandou. Formato canonico do sistema novo: o que a Cloud API entrega, limpo.';
comment on column public.webhook_eventos.tipo is
  'texto | botao | nao_suportado. Recibo de entrega (status) nao e gravado nesta fatia.';
comment on column public.webhook_eventos.acao is
  'Nome da resposta que o bot mandou (ex.: menu_principal). Base da trava anti-repeticao.';

-- Dedupe. Parcial porque wamid pode ser nulo em evento que nao seja mensagem.
create unique index if not exists webhook_eventos_wamid_unico
  on public.webhook_eventos (wamid)
  where wamid is not null;

-- Serve a pergunta "ja respondi X pra esse contato nos ultimos N segundos?".
create index if not exists webhook_eventos_contato_recente
  on public.webhook_eventos (de, recebido_em desc);
