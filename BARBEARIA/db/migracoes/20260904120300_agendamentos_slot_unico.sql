-- A trava de double-booking que o codigo ja acreditava existir.
--
-- `server.js` trata o erro `23505` com constraint `agendamentos_slot_ativo_unique` e
-- devolve 409 "Horario indisponivel". O bot trata esse 409 como estado de primeira
-- classe e tem frase propria pro cliente ("esse horario acabou de ser pego"). Todo esse
-- caminho estava construido — e o indice NAO EXISTIA no banco. Conferido em
-- `pg_indexes` antes de escrever isto: `catch` morto, esperando um erro que nunca
-- chegava.
--
-- O que protegia o slot, entao, era so o "consulta os ocupados, depois insere" da
-- rota. Entre a consulta e o insert cabe outra requisicao: dois clientes tocando no
-- mesmo horario ao mesmo tempo — o bot pelo WhatsApp e o dono lancando a mao, por
-- exemplo — passam os dois pela checagem e gravam os dois. O sintoma nao aparece no
-- log; aparece na cadeira, com duas pessoas na mesma hora.
--
-- O nome do indice e EXATAMENTE o que o `server.js` procura. Nao e coincidencia
-- estetica: e o que faz o `catch` existente virar codigo vivo sem tocar nele.
--
-- Recorte parcial pelos status ativos: os mesmos tres de `BOOKED_STATUSES`
-- (`server.js:94`). Cancelado nao ocupa cadeira, entao um horario cancelado tem que
-- poder ser remarcado — sem o `where`, o cancelamento envenenaria o slot pra sempre.
--
-- Nao leva `barbearia_id`: `profissional_id` ja pertence a uma barbearia so, entao o
-- par (profissional, horario) ja e unico dentro do sistema inteiro. Acrescentar a
-- coluna seria redundancia com cara de rigor.
--
-- Conferido antes de criar: zero colisoes nos dados atuais.

create unique index if not exists agendamentos_slot_ativo_unique
  on public.agendamentos (profissional_id, dia_marcado, hora_marcada)
  where status in ('agendado', 'reagendado', 'confirmado');

-- rollback:
--   drop index public.agendamentos_slot_ativo_unique;
