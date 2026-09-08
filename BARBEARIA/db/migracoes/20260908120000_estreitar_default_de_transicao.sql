-- Estreita o default `barbearia_em_transicao()` para onde ele ainda e necessario.
--
-- Ele nasceu em 20260904120100 cobrindo OITO tabelas, porque nenhum dos dois servicos
-- sabia que barbearias existiam. Era rede de seguranca para o intervalo entre migracao
-- e deploy — e rede de seguranca que fica alem do necessario deixa de ser rede e vira
-- chao falso: um INSERT novo que esqueca a coluna nao da erro, cai na loja A em
-- silencio, e ninguem descobre ate a segunda barbearia reclamar.
--
-- Tres tabelas ja nao precisam dele, porque o codigo do calendario passou a mandar a
-- barbearia explicita (08/09/2026):
--
--   agendamentos   -> `POST /agendamentos` grava `barbearia_id` e `profissional_id`
--                     resolvidos a partir do slug da requisicao
--   profissionais  -> `POST /profissionais` grava `public.barbearia_atual()`, a
--                     barbearia de quem esta logado
--   servicos       -> nao ha rota de escrita; o catalogo entra por seed/migracao, que
--                     sao explicitos por natureza
--
-- AS CINCO QUE FICAM sao todas escritas pelo BOT, que ainda nao resolve a barbearia
-- pelo `phone_number_id` — isso e a Fase 6, adiada junto com o retorno do bot. Sao
-- elas: `dados_cliente`, `whatsapp_contacts`, `whatsapp_conversations`,
-- `whatsapp_messages` e `webhook_eventos`.
--
-- GATILHO PARA REMOVER O RESTO: a Fase 6. Quando o bot passar a mandar `barbearia_id`,
-- esta funcao e os cinco defaults saem, e junto sai o gatilho
-- `agendamentos_resolver_profissional` com a coluna `agendamentos.profissional`.

alter table public.agendamentos  alter column barbearia_id drop default;
alter table public.profissionais alter column barbearia_id drop default;
alter table public.servicos      alter column barbearia_id drop default;

-- rollback:
--   alter table public.agendamentos  alter column barbearia_id set default public.barbearia_em_transicao();
--   alter table public.profissionais alter column barbearia_id set default public.barbearia_em_transicao();
--   alter table public.servicos      alter column barbearia_id set default public.barbearia_em_transicao();
