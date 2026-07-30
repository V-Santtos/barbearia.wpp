# Anexo: Fluxo n8n `BARBEARIA FULL` (histórico — material de espelho)

> **Este anexo não é normativo. Nada aqui é regra, decisão ou ponto de partida.**
>
> É o registro de **como o usuário resolveu o problema no n8n**, numa implementação que
> rodou em produção e hoje está aposentada. O n8n saiu; tudo será feito em código.
>
> O fluxo, a sequência de etapas, os nomes de estado, as rotas e os IDs de botão **serão
> redesenhados do zero** no nosso ambiente, com nomenclatura e ordem próprias. Este
> documento serve para consultar *o que já foi tentado e o que a realidade impôs* — não
> para ser copiado, e não para restringir o desenho novo.
>
> Se algo aqui um dia virar decisão nossa, vira em `REGRAS.md`, por decisão explícita, com
> outro nome e outra forma. Até lá, é história.

- **Fonte:** `Desktop/N8N/Fluxos/BARBEARIA FULL.json` (backup de 27/07/2026, export do
  workflow `JiaEaPilTVLKCJZW` em `n8n.autohost.shop`)
- **Data da leitura:** 2026-07-30
- **Tamanho:** 143 nós (103 funcionais + 40 sticky notes), 3 sub-fluxos
  (`Galho AGENDAMENTO`, `Galho REAGENDAMENTO`, `Galho CANCELA`)
- **Como foi lido:** direto do JSON exportado. O link do n8n não é legível por mim
  (instância atrás de login; `/workflow/<id>` devolve só o shell da SPA) e não há MCP de
  n8n configurado.

---

## 1. Achado de segurança (fato sobre o arquivo, não sobre arquitetura)

Dois segredos estão em texto puro dentro do JSON, e portanto dentro do backup no Desktop:

- **Token da Meta** (header `Authorization`) nos ~26 nós que chamam `graph.facebook.com`.
- **`x-webhook-token`** do espelhamento para `barberapi.autohost.shop`, em 6 nós
  (`Espelhamento CRM`, `Saída #1`, `Saída #`, `Saída #9`, `Saída #10`, `Saída #16`).

Implicação prática: esse JSON não deve ser commitado em repo nenhum, e o mais seguro é
rotacionar os dois — o `x-webhook-token` no `barberapi` e o token da Meta (que de todo modo
será substituído por token permanente de System User). Nenhum valor foi transcrito aqui.

## 2. O que existe do outro lado: o endpoint de espelhamento do calendário

Isto não é uma escolha de arquitetura do n8n — é um **fato sobre o app de calendário**, que
continua de pé independente do n8n. O `Aplicativo-FULL` expõe hoje:

```
POST https://barberapi.autohost.shop/whatsapp/events
header: x-webhook-token: <segredo>
body: { direction, sender_type, phone, wa_id, name, type, body }
```

O fluxo n8n alimentava esse endpoint nas duas direções (mensagem do cliente e resposta do
bot), com timeout de 3s (outbound) / 5s (inbound) e sem retry.

Quando chegarmos na integração, esse endpoint existe e o formato dele é conhecido — o que
não significa que a nossa integração será assim. Pode-se usar outro contrato, outro
transporte, ou mudar o lado do calendário. Fica só registrado que existe.

Schema do banco do calendário que apareceu nas queries: `whatsapp_contacts`
(`id`, `phone`, `wa_id`), `whatsapp_messages` (`contact_id`), `whatsapp_conversations`
(`contact_id`), `agendamentos` (`dia_marcado` date, `hora_marcada` time). Parcial — falta
ver serviços, barbeiros e horários.

## 3. Como o estado era guardado (15 nós Redis)

Três usos distintos, que no fluxo antigo eram todos Redis:

| Chave | Operação | TTL | Papel no fluxo antigo |
|---|---|---|---|
| `state:<telefone>` | GET/SET | até a meia-noite de `America/Sao_Paulo` (mín. 60s) | estado da conversa |
| `<telefone>:<wamid>` | GET/SET | 7200s | marcar evento já processado |
| `lock:first:<telefone>` | INCR | 15s | contar mensagens em rajada |

Observações do que a prática impôs ali:

- O estado expirava **no fim do dia**, não em N minutos — o nó `Tempo` calculava o TTL até
  a próxima meia-noite em São Paulo.
- Havia dedupe por `wamid` porque a Meta reentrega evento; sem isso o cliente recebia o
  menu duas vezes.
- O `INCR` com TTL de 15s existia por causa de quem manda "oi" / "bom dia" / "queria
  cortar" em rajada — o valor `1` significava primeira mensagem da janela.

Como o nosso sistema vai tratar estado, expiração, dedupe e rajada é assunto aberto, a
desenhar sem referência a essas chaves ou a esses tempos.

## 4. O estado vivia em dois lugares ao mesmo tempo

`state:<telefone>` no Redis **e** `dados_cliente.fluxo` + `.etapa` no Postgres, lidos em
pontos diferentes (`Switch #1` lia a coluna, `Verifica` lia o Redis) e escritos por 12 nós
`Atualizar #N` distintos. Os TTLs divergiam: o Redis expirava à meia-noite, a coluna não.

Registrado como observação do que aconteceu naquela implementação.

## 5. Como os estados eram nomeados (nomenclatura descartada)

Só para leitura do fluxo antigo — **estes nomes não serão reaproveitados**:

- `fluxo` (string): `MENU_PRINCIPAL_ENVIADO`, `AGENDAMENTO_CONFIRMADO`, `AGUARDANDO_NOME`,
  `CONFIRMANDO_NOME`.
- `etapa` (inteiro): sub-passo dentro do fluxo.
- `atendimento_temporario` (bool): usado para o bot se calar quando o dono assumia a
  conversa manualmente.

O terceiro item é interessante menos pelo nome e mais porque mostra que a situação
"humano assumiu a conversa" apareceu na prática.

## 6. Como os botões eram identificados (convenção descartada)

O fluxo usava `PREFIXO_ACAO`, com `|payload` quando carregava dado, e roteava comparando o
prefixo (`split('|')[0]`):

- Menu: `MENU_AGENDAR`, `MENU_REAGENDAR`, `MENU_CANCELAR`, `MENU_TABELA_PRECO`,
  `MENU_SAIR`, `MENU_MANTER`
- Agendamento: `AGENDAR_WHATSAPP`, `AGENDAR_SITE`, `BARBEIRO_<NOME>`, `DIA_<data>`
- Reagendamento: `REAG_DIA`, `REAG_HORA`, `REAG_CONTINUAR`
- Cancelamento: `CANC_DIA_<data>`, `CANC_CONTINUAR_<id>`, `CANC_MANTIDO`

Serve para entender que rotas existiam no atendimento (agendar, reagendar, cancelar,
tabela de preços, sair) — não como catálogo a herdar.

## 7. Restrições da Cloud API que apareceram no fluxo

Estas não são escolhas do n8n; são limites da API da Meta, que valem para qualquer
implementação:

- `interactive.type = "list"` (com `header`/`body`/`footer`/`action.sections.rows`) suporta
  mais de 3 opções; `interactive.type = "button"` aceita **no máximo 3** `reply` buttons.
  Foi por isso que o menu principal era lista e os submenus eram botões.
- A resposta de um toque chega como `interactive.button_reply.id` **ou**
  `interactive.list_reply.id`, dependendo do tipo enviado.
- "Marcar como lida" e "mostrar digitando" saem numa única chamada:
  `POST /messages { messaging_product, status: "read", message_id, typing_indicator: { type: "text" } }`.
- Botão antigo continua clicável. O nó `Botão Valido?` descartava clique com mais de 30
  minutos, porque o cliente abre a conversa depois e clica no menu de ontem.

## 8. Onde ficava a copy das mensagens

Fora do fluxo: uma Data Table do n8n (`Mensagem`) consultada por `(Fluxo, etapa)` devolvia
o texto da resposta. O PDF da tabela de preços seguia o mesmo desenho — registro em
`documentos_bot` (chave `nome`, ex. `tabela_precos`) apontando para arquivo no Supabase
Storage (bucket público `tabelas/`).

## 9. Telefone tinha duas representações

O nó `Dados` montava o campo `Telefone` inserindo um `9` artificial depois do DDI+DDD e
concatenando `@s.whatsapp.net`:

```js
s = s.slice(0, 4) + '9' + s.slice(4);
return `${s}@s.whatsapp.net`;
```

Isso é formato de JID da Evolution API, não da Cloud API — que entrega `wa_id` limpo. O
fluxo então carregava `Telefone` (para o banco) e `remotejid` (para enviar), e as queries no
CRM comparavam `phone` ou `wa_id`, com e sem sufixo, para achar o mesmo cliente.

## 10. Como se resetava conversa para testar

Não havia ferramenta: os nós `Delete`…`Delete5` faziam `KEYS lock:first:*` / `KEYS state:*`
e apagavam tudo (reset global, não por cliente), e os nós `SQL - Victor` / `SQL - Augusto`
eram queries `DELETE` com o telefone escrito à mão, limpando `whatsapp_messages` →
`whatsapp_conversations` → `whatsapp_contacts` daquele número.

## 11. Como o fluxo era organizado

Os três caminhos pesados eram sub-fluxos separados, chamados via `executeWorkflow`
(`Galho AGENDAMENTO`, `Galho REAGENDAMENTO`, `Galho CANCELA`), cada um recebendo
`{ botao_id, switch1, dados, webhook }`.

O que interessa agora é só o **`Galho AGENDAMENTO`**, com backup local em
`Desktop/N8N/Fluxos/Galho AGENDAMENTO.json` (workflow `B8XAEfAJNoW2SCxb`, 102 nós — 43
`httpRequest`, 12 `whatsApp`, 12 `supabase`, 11 `code`, 8 `if`, 1 `switch`, 1 `postgres`,
10 sticky notes). Reagendamento e cancelamento estão fora de escopo.

**Esse sub-fluxo foi lido em 2026-07-30 e mapeado em `ANEXO_FLUXO_N8N_AGENDAMENTO.md`.**

Havia ainda rotas de fallback e travamento (sticky notes "Faalback de estado do fluxo",
"Faalback final e travamento", "HUMANO?"), separação entre "Lead novo" e "Lead frequente",
e um "Reset Manual".

## 12. Multi-tenancy era manual

Barbeiros e clientes de teste apareciam escritos no próprio fluxo: nós `SQL - Victor` e
`SQL - Augusto` com telefone hardcoded, e IDs de botão `BARBEIRO_LUCAS_COSTA` /
`BARBEIRO_LUCAS_ELOI` fixos no JSON. Cada barbearia nova era edição de fluxo.
