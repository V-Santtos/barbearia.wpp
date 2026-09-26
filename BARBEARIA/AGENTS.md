# Guia da barbearia

## Papel desta pasta nesta cópia

`BARBEARIA/` é referência de domínio e contratos antigos. O dev conduz API,
backend e Supabase no repositório atual; portanto, a postura padrão aqui é leitura.

Consulte somente o necessário para impedir que o calendário faça suposições
aleatórias:

- `src/calendario/api.ts` e `src/calendario/http.ts`: rotas e transporte;
- `src/calendario/crm.ts`: estados de conversa relevantes à interface;
- `src/db/eventos.ts`, `profissionais.ts`, `contatos.ts` e `cliente.ts`:
  formatos persistidos que aparecem no calendário;
- testes próximos desses arquivos: exemplos executáveis dos contratos.

Não trate esta implementação como arquitetura atual de produção. Não altere banco,
migrações, RLS, Supabase, webhook ou fluxo do bot sem um pedido explícito que coloque
essa frente em escopo.

