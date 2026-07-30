# 04 — `dados_cliente`: onde o estado da conversa vivia

A tabela que o bot n8n usava como memória. É a que mais interessa para o desenho novo,
porque é exatamente a função que o nosso motor vai precisar cumprir — e é a que está em
pior estado.

## Estrutura — 17 linhas

| coluna | tipo | nulo | default | papel no fluxo antigo |
|---|---|---|---|---|
| `id` | bigint | não | identidade | |
| `created_at` | timestamptz | sim | **sem default** | |
| `telefone` | text | sim | | identificador do cliente (sem unique!) |
| `nomewpp` | text | sim | | nome do cliente |
| `fluxo` | text | sim | | **o estado da máquina de estados** |
| `etapa` | integer | sim | | sub-passo dentro do fluxo |
| `data_hora` | jsonb | sim | | dia/hora escolhidos, em blob |
| `barbeiro_id` | text | sim | | `LUCAS_COSTA` / `LUCAS_ELOI` |
| `atendimento_temporario` | boolean | sim | `false` | bot se calar quando humano assume |
| `atendimento_ia` | timestamptz | sim | | não usado no fluxo lido |

Única constraint: PK em `id`. **Nenhum índice além da PK, nenhum UNIQUE em `telefone`,
nenhuma FK.**

## Os estados que o fluxo usava

Vindos do `ANEXO_FLUXO_N8N_AGENDAMENTO.md` (nomenclatura **descartada**):

`AGENDAMENTO_ESCOLHENDO_MEIO`, `AGENDAMENTO_ESCOLHENDO_BARBEIRO`,
`AGENDAMENTO_ESCOLHENDO_DIA`, `AGENDAMENTO_ESCOLHENDO_HORA`, `AGENDAMENTO_SITE`,
`AGUARDANDO_NOME`, `CONFIRMANDO_NOME`, `AGENDAMENTO_CONFIRMADO`,
`MENU_PRINCIPAL_ENVIADO`.

## O estado real hoje: praticamente vazio e inconsistente

| `fluxo` | `etapa` | linhas |
|---|---|---|
| `NULL` | `NULL` | 9 |
| `''` (string vazia) | `NULL` | 7 |
| `AGENDAMENTO_CONFIRMADO` | 1 | 1 |

**16 das 17 linhas não têm estado válido**, e o "sem estado" está representado de **duas
formas diferentes** — `NULL` em 9 e string vazia `''` em 7. Sem constraint, nada impede a
terceira, quarta e quinta representação.

## `data_hora`: coluna jsonb guardando string

A coluna é `jsonb`, mas ao checar o tipo interno:

| `jsonb_typeof(data_hora)` | linhas |
|---|---|
| `string` | 6 |
| `NULL` | 11 |

**Nenhuma linha guarda um objeto.** As 6 preenchidas guardam uma *string JSON* — ou seja,
JSON codificado duas vezes. É exatamente o motivo pelo qual o nó `Transform #2` do n8n
precisava daquele desvio:

```js
typeof etapa.data_hora === 'string' ? JSON.parse(etapa.data_hora) : etapa.data_hora
```

O formato pretendido era `{ data, hora, inicio, timezone }` (montado pelo nó
`Monta Data e hora`). O banco aceitou a string porque `jsonb` aceita qualquer JSON válido,
e `"texto"` é JSON válido.

## `telefone` sem unique — e em formato diferente do resto

Amostra (mascarada): `553332***`, `553398***`, `551199***`, `853698***`, `628598***`.

Formato aqui: **com DDI `55`**, dígitos puros. Compare:

| Tabela | formato de telefone |
|---|---|
| `dados_cliente.telefone` | `5533…` (com DDI) |
| `agendamentos.telefone` | `3398…` (sem DDI) |
| `whatsapp_contacts.phone` | `5533…` (com DDI) |
| o que o n8n montava (`Telefone`) | `5533…@s.whatsapp.net` (JID Evolution API) |

Quatro representações do mesmo número no mesmo sistema. E como não há UNIQUE em
`dados_cliente.telefone`, **o mesmo cliente pode ter várias linhas de estado** — a amostra
mostra dois registros (`id` 33 e 34) com o mesmo prefixo `628598***`, criados no mesmo
segundo.

## `atendimento_temporario`

Boolean, default `false`. Uma linha está com `true`. Era a flag para o bot ficar calado
quando o dono assumia a conversa manualmente. Convive com
`whatsapp_conversations.status='human'` (ver `05`) — **duas formas de representar o mesmo
fato**, em tabelas diferentes, sem nada as ligando.

## `created_at` sem default

Diferente de todas as outras tabelas, `dados_cliente.created_at` **não tem
`default now()`** — quem inserisse tinha que preencher. Resultado: há linha com
`created_at = NULL` (a `id=38`).

## Resumo do que essa tabela ensina

Ela mostra o que um "estado de conversa" precisa carregar na prática: quem é o cliente,
onde ele está no fluxo, o que ele já escolheu, e se o humano assumiu. Mas a implementação
não tinha contrato nenhum: sem unique no identificador, sem enum no estado, sem tipo real no
payload, sem default de data, sem índice. Todas as regras viviam nos 12 nós que escreviam
nela.
