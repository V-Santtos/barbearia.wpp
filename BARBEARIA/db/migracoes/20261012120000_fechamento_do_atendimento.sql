-- O fechamento do atendimento: o que foi feito na cadeira, com o preço do dia.
--
-- Spec: `docs/superpowers/specs/2026-09-27-fechar-atendimento-design.md`. O "Marcar
-- como feito" do painel abre um resumo (serviços, acréscimo ou desconto, total) e
-- manda tudo para `POST /agendamentos/:id/concluir`. A rota só existia no mundo de
-- teste do painel; contra o banco real, concluir falhava (12/10/2026).
--
-- ── Por que guardar o preço, e não só o serviço ─────────────────────────────
--
-- Até aqui o Financeiro achava o valor de um atendimento procurando o NOME do
-- serviço na tabela de hoje. Reajustar a tabela mudava o faturamento do passado, e
-- o cliente que fez corte e sobrancelha valia só o corte. O fechamento congela o
-- que foi cobrado (decisão de 27/09 em `REGRAS.md`). Atendimento sem fechamento —
-- todo o histórico anterior — continua lido pela tabela, como antes.
--
-- ── Por que jsonb, e não uma tabela de itens ────────────────────────────────
--
-- O formato é o que a tela já usa (`lib/fechamento.ts`):
--   { servicos: [{servicoId?, nome, preco}], ajuste: {tipo, valor, motivo?} | null,
--     total, concluidoEm }
-- Quem soma é o Financeiro, na tela; nenhuma consulta SQL lê os itens. Uma tabela
-- de itens custaria RLS, política e join sem ninguém para usá-los. Decidido com o
-- usuário em 12/10/2026.
-- ponytail: itens dentro do jsonb, upgrade para `atendimento_itens` quando algum
-- relatório precisar somar por serviço em SQL.
--
-- ── Compatibilidade ─────────────────────────────────────────────────────────
--
-- Coluna que aceita nulo e sem default: o código no ar (01/09) e o bot não a
-- conhecem e continuam inserindo como antes. A RLS de `agendamentos` já cobre a
-- coluna nova — política é por linha, não por coluna.

alter table public.agendamentos
  add column if not exists fechamento jsonb;

alter table public.agendamentos
  drop constraint if exists agendamentos_fechamento_objeto;
alter table public.agendamentos
  add constraint agendamentos_fechamento_objeto
  check (fechamento is null or jsonb_typeof(fechamento) = 'object');

comment on column public.agendamentos.fechamento is
  'Gravado ao concluir pelo painel: serviços com o preço do dia, ajuste e total. Nulo = histórico anterior a 12/10/2026, que o Financeiro lê pela tabela de serviços.';

-- Volta, se precisar:
--   alter table public.agendamentos drop constraint if exists agendamentos_fechamento_objeto;
--   alter table public.agendamentos drop column if exists fechamento;
