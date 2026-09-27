# Guia da barbearia

## Papel desta pasta nesta cópia

`BARBEARIA/` implementa o bot de agendamento por WhatsApp do mesmo produto. Ele
recebe o webhook da Meta e consulta a API de `CALENDARIO/` para disponibilidade e
marcação. Não é cópia do painel nem o site público de agendamento (ausente deste
checkout). O dev conduz o backend e o bot atuais em outro ambiente. Nesta cópia,
a pasta é referência de contingência para conferir o contrato antigo, sem presumir
equivalência com o código atual dele.

## Contrato de referência

| Fluxo do bot desta cópia | Onde conferir |
|---|---|
| Receber mensagens da Meta | `src/app.ts`, `src/whatsapp/webhook.ts` |
| Consultar dias e horários, criar agendamento | `src/calendario/api.ts`, `src/calendario/http.ts` |
| Espelhar conversas para o painel | `src/calendario/crm.ts` |
| Receber a resposta manual do dono | `src/whatsapp/painel.ts` |
| Conferir exemplos executáveis | Testes ao lado desses arquivos |

A costura antiga usa `GET /agendamentos/dias-disponiveis`,
`GET /agendamentos/horarios-disponiveis` e `POST /agendamentos` na API do calendário.
Os caminhos acima documentam o espelho local; confirmar formatos e autenticação
com o dev antes de implementar integração nova.

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

