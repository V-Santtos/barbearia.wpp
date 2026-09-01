-- Seed de TESTE — dados genéricos para exercitar o sistema ponta a ponta.
--
-- Rodar de dentro de BARBEARIA/:
--   npm run db -- -f db/seed/teste.sql              (ensaio: mostra e dá ROLLBACK)
--   npm run db -- -f db/seed/teste.sql --gravar     (efetiva)
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser. Profissionais e serviços usam
-- `on conflict`; os agendamentos são apagados e reinseridos pelo discriminador
-- abaixo.
--
-- DISCRIMINADOR: todo agendamento daqui nasce com `source = 'seed-teste'`. É o que
-- separa dado sintético de dado real sem depender de data ou de nome — e é o mesmo
-- truque que a regra de "conferir o alvo antes de escrever no banco" pede: uma
-- consulta que responde diferente em teste e em produção.
--
--   select count(*) from agendamentos where source = 'seed-teste';
--     > 0  -> tem dado de teste aqui
--     = 0  -> ou é produção, ou o seed nunca rodou
--
-- Para limpar tudo que este arquivo criou:
--   delete from agendamentos where source = 'seed-teste';
--
-- O QUE ESTE SEED NÃO FAZ: reproduzir as patologias do banco real (telefone em
-- formato antigo, agendamento órfão de profissional que a falta de FK permite,
-- cliente duplicado). Seed limpo só testa o caso feliz. Está anotado como próximo
-- passo em AUDITORIA/02-BANCO.md — não é esquecimento, é escopo.

-- ─── Profissionais ───────────────────────────────────────────────────────────
-- DOIS de propósito: é o teto do plano, e é o número que exerce o passo "com quem
-- você quer cortar?". Com um só, o roteador pula essa pergunta (caminho de
-- profissional único) e esse trecho do fluxo nunca seria testado.
insert into public.profissionais (id, nome, cor, ativo) values
  (1, 'Lucas Costa',  '#8b5cf6', true),
  (2, 'Rafael Dias',  '#22d3ee', true)
on conflict (id) do update
  set nome = excluded.nome, cor = excluded.cor, ativo = excluded.ativo;

-- A sequência tem que andar junto, senão o próximo insert sem id explícito
-- colide com o id 2 que acabamos de cravar.
select setval(pg_get_serial_sequence('public.profissionais','id'),
              (select max(id) from public.profissionais));

-- ─── Agenda de cada um ───────────────────────────────────────────────────────
-- Os dois com horários DIFERENTES, também de propósito: agenda igual esconderia
-- bug de "sempre lê a configuração do primeiro".
insert into public.agenda_profissional
  (profissional_id, dias_semana, hora_inicio, hora_fim, duracao_min,
   intervalo_inicio, intervalo_duracao_min, janela_agendamento_dias, atualizado_em)
values
  -- Segunda a sábado, 09h-19h, corte de 45min, almoço 12h-13h
  (1, '[1,2,3,4,5,6]'::jsonb, '09:00', '19:00', 45, '12:00', 60, 10, now()),
  -- Terça a sábado (folga na segunda), 10h-20h, corte de 30min, sem intervalo
  (2, '[2,3,4,5,6]'::jsonb,   '10:00', '20:00', 30, null,    null, 7,  now())
on conflict (profissional_id) do update
  set dias_semana             = excluded.dias_semana,
      hora_inicio             = excluded.hora_inicio,
      hora_fim                = excluded.hora_fim,
      duracao_min             = excluded.duracao_min,
      intervalo_inicio        = excluded.intervalo_inicio,
      intervalo_duracao_min   = excluded.intervalo_duracao_min,
      janela_agendamento_dias = excluded.janela_agendamento_dias,
      atualizado_em           = now();

-- ─── Serviços ────────────────────────────────────────────────────────────────
insert into public.servicos (id, slug, nome, descricao, preco, ativo, ordem) values
  (1, 'corte',        'Corte',          'Corte de cabelo na máquina ou tesoura', 45.00, true, 1),
  (2, 'barba',        'Barba',          'Barba feita na navalha, com toalha quente', 35.00, true, 2),
  (3, 'corte-barba',  'Corte + Barba',  'O combo, com desconto',                   70.00, true, 3),
  (4, 'sobrancelha',  'Sobrancelha',    'Design de sobrancelha masculina',         20.00, true, 4)
on conflict (id) do update
  set slug = excluded.slug, nome = excluded.nome, descricao = excluded.descricao,
      preco = excluded.preco, ativo = excluded.ativo, ordem = excluded.ordem;

select setval(pg_get_serial_sequence('public.servicos','id'),
              (select max(id) from public.servicos));

-- ─── Um dia bloqueado ────────────────────────────────────────────────────────
-- Daqui a 3 dias, só de manhã. Bloqueio PARCIAL de propósito: o de dia inteiro é
-- gravado como NULL, então um seed só com dia inteiro nunca exercitaria a leitura
-- do array de períodos.
insert into public.dias_bloqueados (profissional_id, data, motivo, periodos)
values (1, current_date + 3, 'Consulta médica', '{morning}')
on conflict (profissional_id, data) do update
  set motivo = excluded.motivo, periodos = excluded.periodos;

-- ─── Agendamentos ────────────────────────────────────────────────────────────
-- Apaga só o que este arquivo criou antes, e reinsere. Dado real fica intocado.
delete from public.agendamentos where source = 'seed-teste';

insert into public.agendamentos
  (telefone, cliente, profissional, servico, dia_marcado, hora_marcada, status, source)
values
  -- Hoje, para o Dashboard e o "relógio do dia" terem o que mostrar
  ('553399990010', 'Cliente Teste 1',      'Lucas Costa', 'Corte',         current_date,     '10:00', 'confirmado', 'seed-teste'),
  ('553399990011', 'Cliente Teste 2',  'Lucas Costa', 'Corte + Barba', current_date,     '14:00', 'confirmado', 'seed-teste'),
  ('553399990001', 'João Pereira',   'Rafael Dias', 'Barba',         current_date,     '16:30', 'agendado',   'seed-teste'),
  -- Amanhã
  ('553399990002', 'Marcos Lima',    'Lucas Costa', 'Corte',         current_date + 1, '09:00', 'confirmado', 'seed-teste'),
  ('553399990003', 'Paulo Souza',    'Rafael Dias', 'Corte',         current_date + 1, '11:00', 'agendado',   'seed-teste'),
  -- Depois, para a janela de dias disponíveis não vir toda vazia
  ('553399990004', 'Bruno Alves',    'Lucas Costa', 'Sobrancelha',   current_date + 2, '15:00', 'confirmado', 'seed-teste'),
  -- Um cancelado e um concluído: o filtro de status do painel precisa de ambos,
  -- e nenhum dos dois pode ocupar horário (BOOKED_STATUSES não os inclui).
  ('553399990005', 'Diego Rocha',    'Rafael Dias', 'Corte',         current_date,     '11:00', 'cancelado',  'seed-teste'),
  ('553399990006', 'Tiago Nunes',    'Lucas Costa', 'Barba',         current_date - 1, '17:00', 'concluido',  'seed-teste');

-- ─── Conferência ─────────────────────────────────────────────────────────────
select 'profissionais' as tabela, count(*) from public.profissionais where ativo
union all select 'agenda_profissional', count(*) from public.agenda_profissional
union all select 'servicos',            count(*) from public.servicos where ativo
union all select 'dias_bloqueados',     count(*) from public.dias_bloqueados
union all select 'agendamentos (seed)', count(*) from public.agendamentos where source = 'seed-teste';
