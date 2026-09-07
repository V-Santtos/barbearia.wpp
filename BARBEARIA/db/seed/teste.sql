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
-- ─── DUAS BARBEARIAS, E ESSA É A PARTE QUE IMPORTA ───────────────────────────
--
-- Este seed tinha UMA loja, e com uma loja só o isolamento entre barbearias é
-- INTESTÁVEL: toda consulta devolve o dado certo por acidente, porque não existe dado
-- errado para devolver. Uma política de RLS quebrada, um `where barbearia_id` esquecido
-- numa das ~25 rotas do `server.js`, um filtro que faltou no bot — nada disso dá erro.
-- Dá a resposta certa, até o dia em que existir uma segunda loja em produção.
--
-- A segunda barbearia aqui é o instrumento de medida. O teste que ela viabiliza:
-- autenticar como o dono da loja A e conferir que a loja B **não aparece** — em
-- agendamentos, profissionais, serviços, conversas. Sem ela, "a RLS está funcionando"
-- é fé, não observação.
--
-- É a mesma lição que já estava escrita neste arquivo sobre patologias, aplicada ao
-- que o multi-tenant trouxe: seed que só tem o caso feliz dá confiança falsa.
--
-- O QUE ESTE SEED AINDA NÃO FAZ: reproduzir as patologias do banco real (telefone em
-- formato antigo, cliente duplicado). Está anotado em AUDITORIA/02-BANCO.md — não é
-- esquecimento, é escopo. (O agendamento órfão de profissional deixou de ser possível:
-- `profissional_id` agora tem FK.)

-- ─── Barbearias ──────────────────────────────────────────────────────────────
-- A loja A ('lucas-costa') nasce na migração 20260904120000 — é a barbearia real do
-- sistema, não dado de teste. Aqui só garantimos que ela existe antes de tudo que
-- depende dela, com uma mensagem legível em vez de uma violação de `not null` três
-- comandos adiante.
do $$
begin
  if not exists (select 1 from public.barbearias where slug = 'lucas-costa') then
    raise exception 'Barbearia "lucas-costa" não existe. Rode as migrações antes do seed: npm run db:migrar -- --gravar';
  end if;
end;
$$;

-- A loja B é sintética, e existe só para ser o "outro lado" dos testes de isolamento.
insert into public.barbearias (nome, slug, whatsapp_phone_number_id)
values ('Barbearia Central (teste)', 'central-teste', '999999999999999')
on conflict (slug) do nothing;

-- ─── Profissionais ───────────────────────────────────────────────────────────
-- DOIS na loja A de propósito: é o teto do plano, e é o número que exerce o passo "com
-- quem você quer cortar?". Com um só, o roteador pula essa pergunta (caminho de
-- profissional único) e esse trecho do fluxo nunca seria testado.
--
-- A loja B tem UM. Isso não é economia: é o outro caminho do roteador. Com um número
-- de WhatsApp por barbearia, a loja B exercita o atalho de profissional único enquanto
-- a A exercita a pergunta — os dois caminhos vivos no mesmo banco.
insert into public.profissionais (id, nome, cor, ativo, barbearia_id) values
  (1, 'Lucas Costa', '#8b5cf6', true, (select id from public.barbearias where slug = 'lucas-costa')),
  (2, 'Rafael Dias', '#22d3ee', true, (select id from public.barbearias where slug = 'lucas-costa')),
  (3, 'Ana Ribeiro', '#f472b6', true, (select id from public.barbearias where slug = 'central-teste'))
on conflict (id) do update
  set nome = excluded.nome, cor = excluded.cor, ativo = excluded.ativo,
      barbearia_id = excluded.barbearia_id;

-- A sequência tem que andar junto, senão o próximo insert sem id explícito
-- colide com o id que acabamos de cravar.
select setval(pg_get_serial_sequence('public.profissionais','id'),
              (select max(id) from public.profissionais));

-- ─── Agenda de cada um ───────────────────────────────────────────────────────
-- Horários DIFERENTES, também de propósito: agenda igual esconderia bug de "sempre lê
-- a configuração do primeiro".
insert into public.agenda_profissional
  (profissional_id, dias_semana, hora_inicio, hora_fim, duracao_min,
   intervalo_inicio, intervalo_duracao_min, janela_agendamento_dias, atualizado_em)
values
  -- Segunda a sábado, 09h-19h, corte de 45min, almoço 12h-13h
  (1, '[1,2,3,4,5,6]'::jsonb, '09:00', '19:00', 45, '12:00', 60, 10, now()),
  -- Terça a sábado (folga na segunda), 10h-20h, corte de 30min, sem intervalo
  (2, '[2,3,4,5,6]'::jsonb,   '10:00', '20:00', 30, null,    null, 7,  now()),
  -- Loja B: outro horário ainda, para o dado dela ser distinguível do da loja A a olho
  (3, '[1,2,3,4,5]'::jsonb,   '08:00', '17:00', 60, '11:30', 30, 10, now())
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
-- O serviço da loja B tem nome e preço próprios: se ele aparecer no painel da loja A,
-- o vazamento é visível sem consultar id nenhum.
insert into public.servicos (id, slug, nome, descricao, preco, ativo, ordem, barbearia_id) values
  (1, 'corte',       'Corte',         'Corte de cabelo na máquina ou tesoura',    45.00, true, 1, (select id from public.barbearias where slug = 'lucas-costa')),
  (2, 'barba',       'Barba',         'Barba feita na navalha, com toalha quente', 35.00, true, 2, (select id from public.barbearias where slug = 'lucas-costa')),
  (3, 'corte-barba', 'Corte + Barba', 'O combo, com desconto',                     70.00, true, 3, (select id from public.barbearias where slug = 'lucas-costa')),
  (4, 'sobrancelha', 'Sobrancelha',   'Design de sobrancelha masculina',           20.00, true, 4, (select id from public.barbearias where slug = 'lucas-costa')),
  (5, 'platinado',   'Platinado',     'SÓ DA LOJA B — se aparecer na A, vazou',   180.00, true, 1, (select id from public.barbearias where slug = 'central-teste'))
on conflict (id) do update
  set slug = excluded.slug, nome = excluded.nome, descricao = excluded.descricao,
      preco = excluded.preco, ativo = excluded.ativo, ordem = excluded.ordem,
      barbearia_id = excluded.barbearia_id;

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

-- `profissional_id` vai EXPLÍCITO, e não pelo gatilho de transição
-- (`agendamentos_resolver_profissional`). O gatilho é ponte para o código que ainda
-- manda só o nome; o seed é escrito agora e não tem por que nascer dependendo de algo
-- que já tem data para morrer. A coluna de texto continua sendo preenchida enquanto
-- ela existir — sai daqui junto com a migração B.
insert into public.agendamentos
  (telefone, cliente, profissional, profissional_id, servico, dia_marcado, hora_marcada, status, source, barbearia_id)
values
  -- ── Loja A ──
  -- Hoje, para o Dashboard e o "relógio do dia" terem o que mostrar
  ('553399990010', 'Cliente Teste 1', 'Lucas Costa', 1, 'Corte',         current_date,     '10:00', 'confirmado', 'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  ('553399990011', 'Cliente Teste 2', 'Lucas Costa', 1, 'Corte + Barba', current_date,     '14:00', 'confirmado', 'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  ('553399990001', 'João Pereira',    'Rafael Dias', 2, 'Barba',         current_date,     '16:30', 'agendado',   'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  -- Amanhã
  ('553399990002', 'Marcos Lima',     'Lucas Costa', 1, 'Corte',         current_date + 1, '09:00', 'confirmado', 'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  ('553399990003', 'Paulo Souza',     'Rafael Dias', 2, 'Corte',         current_date + 1, '11:00', 'agendado',   'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  -- Depois, para a janela de dias disponíveis não vir toda vazia
  ('553399990004', 'Bruno Alves',     'Lucas Costa', 1, 'Sobrancelha',   current_date + 2, '15:00', 'confirmado', 'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  -- Um cancelado e um concluído: o filtro de status do painel precisa de ambos,
  -- e nenhum dos dois pode ocupar horário (BOOKED_STATUSES não os inclui).
  ('553399990005', 'Diego Rocha',     'Rafael Dias', 2, 'Corte',         current_date,     '11:00', 'cancelado',  'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),
  ('553399990006', 'Tiago Nunes',     'Lucas Costa', 1, 'Barba',         current_date - 1, '17:00', 'concluido',  'seed-teste', (select id from public.barbearias where slug = 'lucas-costa')),

  -- ── Loja B ──
  -- Nomes e telefones de outra faixa, para o vazamento saltar aos olhos no painel.
  -- O de HOJE às 10:00 é deliberado: colide de propósito com o horário do Lucas na
  -- loja A. Se alguma consulta esquecer o recorte por barbearia, o sintoma aparece
  -- como horário ocupado que não deveria estar.
  ('554888880001', 'Cliente Loja B 1', 'Ana Ribeiro', 3, 'Platinado',    current_date,     '10:00', 'confirmado', 'seed-teste', (select id from public.barbearias where slug = 'central-teste')),
  ('554888880002', 'Cliente Loja B 2', 'Ana Ribeiro', 3, 'Platinado',    current_date + 1, '14:00', 'agendado',   'seed-teste', (select id from public.barbearias where slug = 'central-teste'));

-- ─── Conferência ─────────────────────────────────────────────────────────────
select b.slug as barbearia,
       (select count(*) from public.profissionais p where p.barbearia_id = b.id and p.ativo) as profissionais,
       (select count(*) from public.servicos    s where s.barbearia_id = b.id and s.ativo)   as servicos,
       (select count(*) from public.agendamentos a where a.barbearia_id = b.id and a.source = 'seed-teste') as agendamentos_seed
  from public.barbearias b
 order by b.id;
