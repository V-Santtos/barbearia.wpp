# Banco (Supabase `sppexvjvnoganlduyjvs`, PostgreSQL 17.6)

**Não existe cópia do schema neste repositório, de propósito.** Estrutura, tipos, contagem
de linhas e conteúdo de tabela se pergunta ao banco — cópia em markdown envelhece calada e
vira mentira. Aqui fica só o que uma consulta **não** responde: as armadilhas e as decisões
pendentes.

## Como enxergar

Conexão direta Postgres (`DATABASE_URL` no `BARBEARIA/.env`, usuário `postgres`, leitura e
escrita). Ferramentas em `BARBEARIA/ferramentas/`, `pg` já instalado:

```bash
cd BARBEARIA && npm run db -- "select * from agenda_profissional"
```

| Comando | Para quê |
|---|---|
| `npm run db -- "<sql>"` | consulta ou alteração avulsa — **rollback no fim**, `--gravar` efetiva |
| `npm run db:migrar` | aplica `db/migracoes/*.sql` — ensaia por padrão, `--gravar` efetiva |
| `npm run db:schema` | retrato de estrutura inteiro num arquivo (fora do git) |
| `npm run db:dados` | retrato de conteúdo, com telefone mascarado (fora do git) |

Os dois últimos são para **eu** ler de uma vez quando precisar do panorama. A saída não vai
pro git: tem dado real de cliente.

Toda mudança de estrutura entra como arquivo em `BARBEARIA/db/migracoes/` — nunca DDL
avulso, nunca pelo painel. Regras lá no `README.md` da pasta.

O MCP oficial do Supabase está em `.mcp.json` mas nunca saiu de *pending approval* (exige
sessão interativa). Não é o caminho: a conexão direta é.

---

# As armadilhas

Fatos verificados no banco em 2026-07-30 que mordem quem não sabe que existem. Datas e
contagens podem ter mudado; o comportamento, não.

## Ao criar qualquer tabela

**Um event trigger (`ensure_rls`) liga RLS sozinho em toda tabela nova de `public`.** Não é
configuração nossa, é hardening padrão. Tabela criada sem política **nega tudo pela API
pública em silêncio** — 0 linhas, sem erro, sem log. Política entra na mesma migração que
cria a tabela, sempre.

**A tranca de hoje é acidental.** As 12 tabelas têm RLS ligado e **zero políticas**,
enquanto `anon` e `authenticated` têm privilégio total (incluindo TRUNCATE). Nada quebrou
porque os consumidores entram por `service_role`/conexão direta, que ignoram RLS. Um
`DISABLE ROW LEVEL SECURITY` em qualquer tabela abre escrita pública naquela tabela.

`auth.users` está vazio — **não existe sujeito para `auth.uid()`**. Toda política que
dependa dele é teórica até o Supabase Auth ser adotado de fato.

Antes de escrever política, reler `references/security-rls-performance.md` da skill
`supabase-postgres-best-practices`: `using (auth.uid() = x)` roda a função **por linha**;
`using ((select auth.uid()) = x)` roda uma vez.

## Ao mexer em agendamento

**A trava de double-booking já existe** — índice único parcial em
`(profissional, dia_marcado, hora_marcada)` para status ativos. É o que faltava no n8n, e
está no nível certo. **Mas a chave é `profissional` como TEXTO:** escrever "Lucas costa" em
vez de "Lucas Costa" fura a trava. `agendamentos` inteira é texto solto — `profissional`,
`servico`, `cliente`, sem FK nenhuma.

**Duração é por profissional, não por serviço** (`agenda_profissional.duracao_min`).
`servicos` não tem duração: corte de R$35 e combo de R$55 ocupam o mesmo slot.

**`dias_semana` usa convenção JavaScript** — `[1..6]` = segunda a sábado, logo `0 = domingo`
(`Date.getDay()`), não ISO-8601 (onde domingo é 7). Fonte clássica de bug de fuso.

**As fronteiras de `morning`/`afternoon`/`night` não estão no banco.** `dias_bloqueados
.periodos` aceita esses valores, mas onde cada período começa e termina vive no código do
`Aplicativo-FULL`. `periodos = NULL` significa dia inteiro bloqueado.

**Não há função SQL de disponibilidade.** Calcular dia/hora livre a partir de
`agenda_profissional` + `dias_bloqueados` + `agendamentos` é código do app de calendário,
fora deste banco — e esse código a gente ainda não tem.

## Ao mexer em telefone / identidade do cliente

**Quatro formatos do mesmo número convivem:** `dados_cliente.telefone` com DDI (`5533…`),
`agendamentos.telefone` sem DDI (`3398…`), `whatsapp_contacts.phone` com DDI, e o que o n8n
montava — `5533…@s.whatsapp.net`, JID da Evolution API, **com um `9` inserido
artificialmente** depois do DDI+DDD. O `phone` e o `wa_id` do mesmo contato têm quantidade
de dígitos diferente.

**`wa_id` está corrompido em 7 de 8 contatos:** começa com `=`, o sinal das expressões do
n8n (`={{ … }}`) que vazou literal para o dado. Busca por `wa_id` exato falha nesses.

## Ao mexer em mensagem

**Dedupe por `wamid` já é garantido pelo banco** — `UNIQUE (whatsapp_message_id) WHERE NOT
NULL`. Dá para gravar primeiro e deixar o Postgres rejeitar a reentrega, em vez de dedupe em
memória.

**A janela de 24h da Meta está materializada** em `whatsapp_contacts.service_window_until`,
sempre `last_message_at + 24h`. Fora dela só se inicia conversa por **template aprovado** —
impacta direto o lembrete.

**O envelope original da Meta não existe em lugar nenhum.** `raw_payload` guarda o corpo que
o n8n montava para espelhamento, não o JSON da Cloud API com `entry`/`changes`/`value`.

**O `id` do botão não foi persistido, só o título.** `body` tem `"🔘 13:00"`, não
`HORA_2026-06-17_1300`. O identificador que dirigia todo o roteamento se perdeu — não dá
para reconstruir o que o cliente escolheu a partir do histórico.

## Ao olhar o estado de conversa antigo (`dados_cliente`)

Tabela sem contrato nenhum: sem UNIQUE em `telefone` (o mesmo cliente tem linhas
duplicadas), sem índice além da PK, sem FK, `created_at` **sem default** (há linha NULL).
"Sem estado" tem duas representações — `NULL` e `''`. E `data_hora` é `jsonb` guardando
**string JSON duplamente codificada** (por isso o n8n precisava de `JSON.parse` condicional).

"Humano assumiu" está modelado em dois lugares sem ligação:
`dados_cliente.atendimento_temporario` (usado) e `whatsapp_conversations.status='human'`
(nunca escrito).

## Ao ligar um processo novo no banco

**O pool do `pg` fecha conexão ociosa em 10s por padrão, e aqui isso custa caro.** O
Supabase está na internet, não no localhost: reabrir custa ~2s (chegou a 4,8s medido em
2026-07-30). Entre dois toques do cliente no WhatsApp passam mais de 10s com folga, então
*toda* mensagem pagava handshake novo.

**Como isso apareceu (2026-08-01):** não como lentidão — como bug. O cliente escolheu o
barbeiro e leu *"não consegui abrir a agenda"* com a agenda no ar. A API do calendário
respondeu o `dias-disponiveis` em **8711ms**; o bot desiste em 8000ms. O que empilhou foram
conexões, não consultas: painel do dono fazendo polling + espelho da conversa gravando + o
bot perguntando os dias, todos ao mesmo tempo, cada um abrindo a sua. A escada dava para ver
no log da API — 203ms de rotina, depois 1,6s, 2,2s, 4,6s, 5,5s, 8,7s.

Os dois processos (`BARBEARIA/src/db/cliente.ts` e `CALENDARIO/server.js`) agora abrem o
pool com `idleTimeoutMillis: 0` + `keepAlive: true` e **aquecem as conexões na subida**, em
paralelo, depois do `listen`. Mesma chamada, mesma rajada: **~630ms**.

O banco topa sem apertar: `idle_session_timeout` é **0** (o Supabase nunca derruba sessão
parada) e `max_connections` é **60** — o calendário segura no máximo 10 e o bot 5.

**O que sobrou, e é outra conta:** com a conexão quente, o que resta de latência é o
*número* de idas ao banco dentro de cada rota. `POST /whatsapp/events` leva ~1,25s porque
faz ~6 consultas em sequência, e o webhook inteiro fica em 5-8s (a Meta desiste por volta de
15-20s e reentrega — o dedupe absorve). Não é handshake; é ida e volta.

## Coisas que enganam

- `configuracao['servicos']` e `['categorias']` **duplicam em jsonb** o conteúdo das tabelas
  `servicos` e `categorias_servicos`. Duas fontes de verdade, sincronizadas só pelo app
  escrever nas duas.
- `servicos.preco` é **`text`** (`"35"`). Não soma, não ordena por valor, não tem centavos
  nem moeda.
- **Só 3 das 12 tabelas** atualizam `updated_at` sozinhas (trigger `set_updated_at` em
  `agendamentos`, `servicos`, `categorias_servicos`). `whatsapp_contacts` e
  `whatsapp_conversations` têm a coluna e **não** têm o trigger.
- **O histórico de migrações é parcial:** 4 entradas de 17/05/2026; as tabelas originais
  nasceram no painel. **Não dá para recriar este banco do zero a partir dele.**
- Dois buckets de Storage **públicos**: `tabelas` (o PDF de preços, intencional) e `FOTO`
  (conteúdo e intenção desconhecidos).

## O que as 165 mensagens reais (01–17/06/2026) provam

Não é hipótese, é dado: **68% das mensagens são `interactive`** — o sistema de botões
funcionou. **31 mensagens `inbound text`** — o cliente digitou fora do trilho 31 vezes, e o
único momento em que digitar era esperado é o nome. **10 mensagens `outbound human`** — o
dono assumiu conversas de verdade; "humano no meio" é requisito observado, não previsão.

---

Agenda de decisões pendentes: [`DECIDIR.md`](DECIDIR.md).
