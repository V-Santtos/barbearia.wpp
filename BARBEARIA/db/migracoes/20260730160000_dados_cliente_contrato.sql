-- Da contrato minimo a `dados_cliente`, que passa a ser o cadastro de contato do bot.
--
-- A tabela e do case antigo (era a memoria de estado do n8n) e nasceu sem contrato:
-- sem unique no telefone, sem default em created_at. O resultado estava no proprio
-- dado -- 17 linhas para 16 telefones distintos, ou seja, cliente duplicado.
--
-- Duas travas resolvem, e sao de graca agora porque a tabela esta vazia:
--
--   1. UNIQUE no telefone -- e o que faz "cria so se nao existir" ser garantia do
--      banco em vez de corrida entre duas mensagens. Sem isso, duas mensagens
--      simultaneas do mesmo numero criam duas linhas, e nenhuma trava no codigo
--      resolve isso de forma confiavel.
--   2. default now() no created_at -- o legado tinha linha com created_at nulo.
--
-- FORMATO CANONICO DO TELEFONE, cravado aqui: o `wa_id` exatamente como a Cloud
-- API entrega (ex.: 553384246770 = DDI 55 + DDD 33 + numero). Sem `9` artificial
-- depois do DDD, sem sufixo @s.whatsapp.net -- os dois vinham da Evolution API do
-- fluxo antigo e produziram quatro formatos do mesmo numero no mesmo banco.
-- Cravar agora custa zero: nao ha linha para converter.

create unique index if not exists dados_cliente_telefone_unico
  on public.dados_cliente (telefone)
  where telefone is not null;

alter table public.dados_cliente
  alter column created_at set default now();

comment on column public.dados_cliente.telefone is
  'Formato canonico: wa_id da Cloud API, digitos puros com DDI (ex.: 553384246770). UNIQUE.';
