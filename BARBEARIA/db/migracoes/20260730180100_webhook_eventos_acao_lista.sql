-- `webhook_eventos.acao` passa de `text` para `text[]`.
--
-- Era uma simplificacao declarada (`ponytail:` em src/db/eventos.ts) valida enquanto o
-- roteador devolvia no maximo UMA acao por evento: os nomes iam concatenados por virgula
-- e as consultas comparavam por igualdade. O gatilho de upgrade previsto era "no dia em
-- que uma rota devolver duas" -- e a mensagem inicial picada (saudacao + menu) e esse dia.
--
-- Nao e cosmetico. Com duas acoes, a coluna text guardaria 'saudacao,menu_principal', e a
-- escada de feedback compara por igualdade: nenhum degrau seria reconhecido, a dica viraria
-- `undefined` e o bot cairia em silencio -- sem erro, sem log, so parando de responder.
--
-- A conversao preserva o historico de testes de hoje: string_to_array desfaz a concatenacao.

alter table public.webhook_eventos
  alter column acao type text[]
  using case when acao is null then null else string_to_array(acao, ',') end;

comment on column public.webhook_eventos.acao is
  'Nomes das respostas que o bot mandou neste evento, em ordem de envio (ex.: {saudacao,menu_principal}). Base da escada de feedback e da trava anti-repeticao.';

-- rollback:
--   alter table public.webhook_eventos
--     alter column acao type text
--     using case when acao is null then null else array_to_string(acao, ',') end;
