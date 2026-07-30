# 02 — Agenda e disponibilidade

O núcleo do sistema. É daqui que sai a resposta para "que dias e horas esse barbeiro tem
livre" — a pergunta que o bot fazia via HTTP ao app de calendário.

## `profissionais` — 2 linhas

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `nome` | text | não | |
| `cor` | text | sim | |
| `ativo` | boolean | não | `true` |
| `created_at` | timestamptz | não | `now()` |

Conteúdo real:

| id | nome | cor | ativo |
|---|---|---|---|
| 1 | Lucas Costa | `#00ffcc` | true |
| 2 | Lucas Eloi | `#ff6b35` | true |

Os `professionalId=1` e `professionalId=2` que apareciam nas URLs do n8n são **estes ids**.
`cor` é para a UI do calendário. Não há campo de telefone, foto, comissão, nem vínculo com
usuário de login.

## `agenda_profissional` — 2 linhas (1:1 com profissional)

**A tabela mais importante para entender disponibilidade.** A PK é a própria FK, então cada
barbeiro tem exatamente uma configuração de agenda.

| coluna | tipo | nulo | default |
|---|---|---|---|
| `profissional_id` | bigint | não | PK + FK → `profissionais.id` (CASCADE) |
| `dias_semana` | jsonb | não | `[1,2,3,4,5,6]` |
| `hora_inicio` | time | não | `08:00:00` |
| `hora_fim` | time | não | `19:00:00` |
| `duracao_min` | integer | não | `60` |
| `intervalo_inicio` | time | sim | |
| `intervalo_duracao_min` | integer | sim | |
| `janela_agendamento_dias` | integer | não | `10` |
| `atualizado_em` | timestamptz | sim | `now()` |

Conteúdo real — **os dois barbeiros têm configuração diferente**:

| profissional | dias_semana | expediente | duração | intervalo | janela |
|---|---|---|---|---|---|
| 1 — Lucas Costa | `[1,2,3,4,5,6]` | 08:00 → **23:00** | **60 min** | 11:00 + 90 min | 10 dias |
| 2 — Lucas Eloi | `[1,2,3,4,5,6]` | 08:00 → **20:00** | **45 min** | 12:00 + 120 min | 10 dias |

**Regras embutidas como CHECK constraints:**

- `intervalo_duracao_min` só aceita `NULL`, `30`, `60`, `90` ou `120`
- `janela_agendamento_dias` só aceita valor **entre 7 e 15** (veio da migração
  `booking_window_days`)

**Convenção de `dias_semana`:** array de inteiros. `[1,2,3,4,5,6]` = segunda a sábado, o que
implica **0 = domingo** (padrão JavaScript `getDay()`), não o padrão ISO. Domingo está fora
para os dois. Não há como expressar "sábado só até meio-dia" — o expediente é único para
todos os dias.

**Nota:** o n8n chamava a API com `days=15`, mas o banco diz `janela_agendamento_dias=10`.
Quem manda é a API do calendário, não o parâmetro do bot.

## `dias_bloqueados` — 1 linha

Exceções pontuais no calendário do profissional.

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `profissional_id` | bigint | não | FK → `profissionais.id` (CASCADE) |
| `data` | date | não | |
| `motivo` | text | sim | |
| `periodos` | text[] | sim | |
| `created_at` | timestamptz | sim | `now()` |

- `UNIQUE (profissional_id, data)` — um bloqueio por dia por barbeiro
- CHECK: `periodos` só aceita `NULL` ou subconjunto de `['morning','afternoon','night']`

Conteúdo real: `profissional_id=1`, `data=2026-06-04`, `motivo='feriado'`,
`periodos=NULL`.

**Semântica de `periodos`:** `NULL` = dia inteiro bloqueado. Com valores = só aqueles
períodos. Mas **os limites de cada período (onde termina "morning") não estão no banco** —
essa regra vive no código do app de calendário.

## `agendamentos` — 13 linhas

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `telefone` | text | sim | |
| `cliente` | text | sim | |
| `profissional` | text | sim | |
| `servico` | text | sim | |
| `dia_marcado` | date | **não** | |
| `hora_marcada` | time | **não** | |
| `status` | text | sim | `'confirmado'` |
| `source` | text | sim | `'app-etapas'` |
| `created_at` | timestamptz | não | `now()` |
| `updated_at` | timestamptz | não | `now()` (trigger `set_updated_at`) |

### A trava de horário duplicado JÁ EXISTE no banco

Da migração `unique_active_booking_slot`:

```sql
CREATE UNIQUE INDEX agendamentos_slot_ativo_unique
  ON public.agendamentos (profissional, dia_marcado, hora_marcada)
  WHERE status = ANY (ARRAY['agendado','reagendado','confirmado']);
```

Índice único **parcial**: o banco recusa dois agendamentos ativos no mesmo slot do mesmo
profissional, mas libera o slot quando o status sai desse conjunto (`concluido`,
`cancelado`). É a proteção contra double-booking que faltava no fluxo n8n — e está no nível
certo, o banco.

**Consequência prática:** a chave de unicidade é `profissional` (**texto**), não
`profissional_id`. Escrever "Lucas costa" em vez de "Lucas Costa" fura a trava.

### Status e source observados

Todas as 13 linhas estão com `status='concluido'` hoje. O conjunto de status que o índice
reconhece como "ativo" é `agendado`, `reagendado`, `confirmado` — então existem **ao menos 4
valores** em uso, e provavelmente `cancelado`. Não há CHECK constraint nem enum: `status` é
`text` livre.

`source` distingue a origem:

| source | n | significado |
|---|---|---|
| `whatsapp` | 8 | criado pelo bot |
| `app-etapas` | 5 | criado dentro do app de calendário |

### Serviço só é preenchido pelo app

| servico | n |
|---|---|
| `Corte Tradicional` | 5 |
| `''` (vazio) | 8 |

Os 8 vazios são exatamente os `source='whatsapp'`: **o bot nunca perguntava o serviço.** O
app preenche, o bot não. Confirma no dado o que o fluxo n8n já mostrava.

### Tudo por texto, nada por id

`profissional`, `servico` e `cliente` são strings soltas, sem FK. Um agendamento não sabe
qual linha de `profissionais` ou `servicos` ele aponta — só o nome copiado no momento da
criação. Renomear um barbeiro não atualiza o histórico (e quebra a trava de slot para os
registros antigos).

### Formato de telefone

Dígitos puros, sem DDI: `33984246770`, `21965658611`. Diferente do formato usado em
`whatsapp_contacts` e do `Telefone` com `@s.whatsapp.net` que o n8n montava (ver `05`).
Há registros de teste com telefone inventado (`55565545444`, `65764564653`).
