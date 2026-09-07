-- `agendamentos` passa a apontar para o profissional por CHAVE, e nao por nome.
--
-- Ate aqui a coluna era `profissional text` — o nome do barbeiro, copiado. Sem FK,
-- entao nada impedia um agendamento apontar pra um profissional que nao existe, e
-- renomear um barbeiro no cadastro orfanava em silencio todo o historico dele. A
-- AUDITORIA ja nomeava isso; o multi-tenant transforma de defeito em risco, porque
-- nome que se repete entre duas lojas passaria a casar com a linha errada.
--
-- ── O GATILHO DE TRANSICAO, que e a parte nao-obvia deste arquivo ────────────
--
-- A ordem ingenua (adiciona -> backfill -> `set not null`) QUEBRA O SISTEMA no
-- instante em que roda: o `server.js` que esta no ar hoje monta o INSERT com
-- `profissional` (texto) e nada mais. Coluna nova, `not null`, sem default = todo
-- agendamento novo falha, pelo bot e pelo painel, ate o codigo subir.
--
-- Migracao e deploy nao sao atomicos entre si — o banco muda por um comando, o codigo
-- por outro, e existe um intervalo. Uma migracao que so funciona se o deploy certo
-- acontecer no minuto certo e uma armadilha esperando o dia de pressa.
--
-- O gatilho abaixo resolve o intervalo: quando o INSERT nao traz `profissional_id`, ele
-- deriva do nome, dentro da MESMA barbearia. Assim a coluna e confiavel desde o
-- primeiro instante, o `not null` e honesto, o indice unico de slot (proxima migracao)
-- pode existir, e o codigo velho continua funcionando sem saber de nada.
--
-- E TRANSITORIO E TEM DATA PRA MORRER: ele sai junto com a coluna `profissional`, na
-- migracao B, depois que o codigo passar a mandar o id. Gatilho que resolve dado
-- silenciosamente e otimo como ponte e pessimo como moradia — enquanto ele existir, um
-- nome errado vira `null` e o `not null` acusa, em vez de gravar torto.

alter table public.agendamentos
  add column if not exists profissional_id bigint references public.profissionais (id);

-- Backfill por nome, DENTRO da barbearia. O recorte por `barbearia_id` nao muda nada
-- hoje (ha uma loja so) e e exatamente o ponto: e a forma certa de escrever a juncao,
-- e escrever certo agora custa uma linha — descobrir depois custa um incidente.
--
-- `profissionais.nome` nao e unico. Com dois barbeiros de mesmo nome na mesma loja, o
-- Postgres escolhe um arbitrariamente aqui — a mesma fragilidade que o `LIMIT 1` do
-- `server.js` ja tem hoje ao resolver o nome. Nao criamos unique pra tapar isso: e um
-- problema que DEIXA de existir quando a coluna de texto morrer, e constraint que a
-- gente pretende nao precisar e peso morto nascendo.
update public.agendamentos a
   set profissional_id = p.id
  from public.profissionais p
 where p.nome = a.profissional
   and p.barbearia_id = a.barbearia_id
   and a.profissional_id is null;

create or replace function public.agendamentos_resolver_profissional()
returns trigger
language plpgsql
as $$
begin
  if new.profissional_id is null and new.profissional is not null then
    select p.id into new.profissional_id
      from public.profissionais p
     where p.nome = new.profissional
       and p.barbearia_id = new.barbearia_id
     limit 1;
  end if;
  return new;
end;
$$;

create trigger agendamentos_resolver_profissional
  before insert or update on public.agendamentos
  for each row execute function public.agendamentos_resolver_profissional();

alter table public.agendamentos alter column profissional_id set not null;

-- O irmao por id do `agendamentos_prof_dia`, que continua sendo por nome. Os dois
-- convivem durante a transicao; o de nome sai na migracao B com a coluna.
create index if not exists agendamentos_prof_id_dia
  on public.agendamentos (profissional_id, dia_marcado);

-- rollback:
--   drop trigger agendamentos_resolver_profissional on public.agendamentos;
--   drop function public.agendamentos_resolver_profissional();
--   alter table public.agendamentos drop column profissional_id;
