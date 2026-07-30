# 03 — Serviços, categorias e configuração

## `categorias_servicos` — 4 linhas

PK é `text` (slug legível), não número.

| id | nome | ativo | ordem |
|---|---|---|---|
| `cabelo` | Cabelo | true | 1 |
| `barba` | Barba | true | 2 |
| `combos` | Combos | true | 3 |
| `outros` | Outros | true | 4 |

Colunas: `id` (text, PK), `nome`, `ativo` (default true), `ordem` (default 0),
`created_at`, `updated_at` (trigger `set_updated_at`).

## `servicos` — 6 linhas

| coluna | tipo | nulo | observação |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `slug` | text | não | **UNIQUE** |
| `nome` | text | não | |
| `descricao` | text | não | default `''` |
| `preco` | text | não | default `''` — **texto, não numérico** |
| `categoria_id` | text | não | FK → `categorias_servicos.id` |
| `ativo` | boolean | não | true |
| `ordem` | integer | não | 0 |
| `created_at` / `updated_at` | timestamptz | não | `now()` + trigger |

Constraints das migrações de 17/05:

- `servicos_categoria_id_not_blank`: CHECK `btrim(categoria_id) <> ''` (de
  `require_service_category`)
- FK com `ON UPDATE CASCADE ON DELETE RESTRICT` (de
  `restrict_service_category_delete`) — renomear o slug da categoria propaga; apagar
  categoria com serviço vinculado é **bloqueado**

Conteúdo real:

| id | slug | nome | preço | categoria |
|---|---|---|---|---|
| 1 | `corte-tradicional` | Corte Tradicional | 35 | cabelo |
| 2 | `barba-tradicional` | Barba Tradicional | 25 | barba |
| 3 | `cabelo-e-barba-navalhado` | Cabelo e Barba navalhado | 55 | combos |
| 4 | `barboterapia` | Barboterapia | 40 | barba |
| 5 | `sobrancelha` | Sobrancelha | 16 | outros |
| 6 | `depilacao-nariz-e-ouvidos` | Depilação nariz e ouvidos | 17 | outros |

**Pontos de atenção sobre o modelo:**

- `preco` é **`text`** (`"35"`, `"16"`). Não dá pra somar, ordenar por valor nem calcular
  total sem conversão. Não guarda moeda nem centavos.
- **Não existe duração por serviço.** A duração é única por profissional
  (`agenda_profissional.duracao_min`). Então "Corte Tradicional" (35) e "Cabelo e Barba
  navalhado" (55) ocupam o mesmo tempo na agenda — o que na realidade de barbearia
  raramente é verdade.
- Não há vínculo serviço ↔ profissional: todo barbeiro "faz" todos os serviços.
- Não há preço por profissional.

## `configuracao` — 3 linhas (chave/valor jsonb)

| chave | conteúdo |
|---|---|
| `home` | `{ heroLine1: "Bem-vindo à", heroName: "Barbearia", ctaLabel: "Agendar" }` |
| `categorias` | `{ items: [4 categorias com id/label/ordem/active], filtersEnabled: false }` |
| `servicos` | array com os **6 serviços duplicados** (id, name, slug, desc, price, category) |

Colunas: `chave` (text, PK), `valor` (jsonb, não nulo), `atualizado_em` (timestamptz).

**Achado importante: os dados estão duplicados.** `configuracao['servicos']` e
`configuracao['categorias']` repetem, em jsonb, exatamente o conteúdo das tabelas
`servicos` e `categorias_servicos`. Duas fontes de verdade para a mesma informação, sem
nada que as mantenha em sincronia além de o app escrever nas duas. Os `atualizado_em` das
três chaves são do mesmo instante (16/05/2026 14:31), sugerindo escrita em bloco pelo app.

`filtersEnabled: false` e os textos de `home` são configuração de **UI do site**, não de
agendamento — o que mostra que essa tabela é o "painel de administração" do app de
calendário, não do bot.

## `documentos_bot` — 1 linha

Única tabela deste bloco criada **para o bot**, com comentário no próprio banco:
*"Documento unico usado pelo bot para enviar PDF ao cliente."*

| coluna | tipo | nulo | default |
|---|---|---|---|
| `id` | bigint | não | identidade |
| `nome` | text | não | `'tabela_precos'` |
| `storage_path` | text | não | |
| `ativo` | boolean | sim | true |
| `created_at` | timestamptz | sim | `now()` |

- Índice único parcial: `UNIQUE (nome) WHERE ativo = true` — só um documento ativo por nome
- Conteúdo: `nome='tabela_precos'`, `storage_path='tabelas/tabela-servicos.pdf'`

O arquivo está no bucket público `tabelas` do Supabase Storage. Era assim que o bot
respondia o menu "Tabela de preços": buscava o `storage_path` aqui e mandava a URL pública.

Resquício: a tabela tem uma coluna apagada fisicamente presente
(`........pg.dropped.3........`), sinal de `DROP COLUMN` feito no painel.
