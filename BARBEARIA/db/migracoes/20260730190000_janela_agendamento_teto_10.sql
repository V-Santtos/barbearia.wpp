-- A janela de agendamento passa de 7..15 dias para 4..10.
--
-- O teto de 15 nasceu quando a agenda so era consumida pelo painel e pelo site, onde
-- cabe qualquer quantidade de dia na tela. No WhatsApp nao cabe: `interactive.type =
-- list` aceita no maximo 10 linhas por secao, e a Meta recusa a mensagem inteira acima
-- disso -- o cliente ficaria sem resposta. Com o teto em 10, o que o dono configura na
-- barra e sempre exibivel, e o bot nao precisa cortar a lista por conta propria.
--
-- Por que o piso desce de 7 para 4: o dono que quer a agenda curta hoje nao tem como
-- pedir menos de uma semana. Com o teto menor, a faixa 7..10 daria uma barra de tres
-- passos -- pouca coisa para arrastar.
--
-- Nenhuma linha e afetada: os dois profissionais ja estao em 10 (consultado antes de
-- escrever esta migracao). Se algum dia sobrar linha fora da faixa, o
-- `normalizeBookingWindowDays` do calendario ja a prende na leitura.

alter table public.agenda_profissional
  drop constraint if exists agenda_profissional_janela_agendamento_dias_check;

alter table public.agenda_profissional
  add constraint agenda_profissional_janela_agendamento_dias_check
  check (janela_agendamento_dias >= 4 and janela_agendamento_dias <= 10);

comment on column public.agenda_profissional.janela_agendamento_dias is
  'Quantos dias para frente a agenda deste profissional aceita agendamento (4 a 10). O teto de 10 e o limite de linhas de uma lista do WhatsApp -- fonte unica da janela: o bot nao manda days= e recebe esta configuracao.';

-- rollback:
--   alter table public.agenda_profissional
--     drop constraint if exists agenda_profissional_janela_agendamento_dias_check;
--   alter table public.agenda_profissional
--     add constraint agenda_profissional_janela_agendamento_dias_check
--     check (janela_agendamento_dias >= 7 and janela_agendamento_dias <= 15);
