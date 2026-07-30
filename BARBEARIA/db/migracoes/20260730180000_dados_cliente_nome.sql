-- Renomeia `dados_cliente.nomewpp` para `nome` e crava o que a coluna guarda.
--
-- A coluna e do case antigo e o nome dela promete o oposto da regra que vale aqui:
-- `nomewpp` e o nome do PERFIL do WhatsApp, que a Meta manda de graca em toda
-- mensagem. Esse nome nao serve pra chamar cliente: e o que a pessoa escreveu no
-- proprio aparelho -- apelido, nome de loja, emoji, ou nada.
--
-- REGRA: o bot so chama alguem pelo nome quando o nome saiu da boca do cliente,
-- na etapa de nome de um agendamento fechado. Enquanto essa coluna estiver nula,
-- a saudacao e generica -- inclusive pra quem ja conversou antes e largou no meio.
--
-- Renomear custa zero agora: a tabela esta vazia (foi zerada em 30/07/2026) e o
-- unico codigo que escreve nela grava so o telefone.

alter table public.dados_cliente
  rename column nomewpp to nome;

comment on column public.dados_cliente.nome is
  'Nome informado pelo proprio cliente ao fechar um agendamento. NUNCA o nome do perfil do WhatsApp. Nulo = saudacao generica.';

-- rollback: alter table public.dados_cliente rename column nome to nomewpp;
