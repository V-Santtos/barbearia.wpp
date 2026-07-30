# Anexo: sub-fluxo n8n `Galho AGENDAMENTO` (histórico — material de espelho)

> **Este anexo não é normativo. Nada aqui é regra, decisão ou ponto de partida.**
>
> É o mapeamento de **como o agendamento foi resolvido no n8n**, numa implementação que
> rodou em produção e hoje está aposentada. O fluxo novo será desenhado do zero, junto com
> o usuário, com sequência, estados e nomes próprios.
>
> Serve para saber *o que já foi tentado, o que a realidade impôs e onde aquilo doeu* — não
> para ser copiado. Se algo daqui um dia virar decisão nossa, vira em `REGRAS.md`, por
> decisão explícita, com outro nome e outra forma.

- **Fonte:** `Desktop/N8N/Fluxos/Galho AGENDAMENTO.json` (backup de 27/07/2026, export do
  workflow `B8XAEfAJNoW2SCxb` em `n8n.autohost.shop`)
- **Data da leitura:** 2026-07-30
- **Tamanho:** 102 nós — 43 `httpRequest`, 12 `whatsApp`, 12 `supabase`, 11 `code`, 8 `if`,
  2 `set`, 1 `switch`, 1 `postgres`, 1 `noOp`, 10 sticky notes (todos vazios, só molduras)
- **Complemento de:** `ANEXO_FLUXO_N8N.md` (fluxo pai `BARBEARIA FULL`), seção 11
- **Como foi lido:** direto do JSON exportado, extraindo estrutura + semântica em arquivo
  intermediário. O link do n8n não é legível por mim.

---

## 1. Segurança: o mesmo token, de novo

O **token da Meta em texto puro** aparece no header `Authorization` de todos os nós que
chamam `graph.facebook.com` neste arquivo também (~26). É o mesmo achado da seção 1 do
`ANEXO_FLUXO_N8N.md`, e reforça o mesmo encaminhamento: **não commitar esses JSON** e
rotacionar o token. Nenhum valor foi transcrito aqui.

## 2. Como o sub-fluxo era chamado e roteado

Entrada: `executeWorkflowTrigger` em modo `passthrough`, recebendo do fluxo pai
`{ botao_id, switch1, dados, webhook }` — onde `switch1` é a linha do cliente no banco
(o estado) e `webhook` é o envelope cru da Meta.

Um único `switch` (`Etapas Agendamento`) com **8 saídas** decidia a etapa. O critério de
roteamento era **híbrido e inconsistente entre as saídas**:

| Saída | Critério | O que olhava |
|---|---|---|
| `Local_do_agendamento` | `botao_id === 'MENU_AGENDAR'` | só o botão |
| `Escolher_barbeiro` | `botao_id === 'AGENDAR_WHATSAPP'` | só o botão |
| `SITE` | `botao_id === 'AGENDAR_SITE'` | só o botão |
| `DIA` | `botao_id ∈ ['BARBEIRO_LUCAS_COSTA','BARBEIRO_LUCAS_ELOI']` | só o botão (lista fixa) |
| `HORA` | `type === 'interactive'` && `botao_id` começa com `DIA_` | botão (prefixo) |
| `Nome` | `type === 'interactive'` && `botao_id` começa com `HORA_` | botão (prefixo) |
| `Confirmação` | texto livre **e** `fluxo ∈ {AGUARDANDO_NOME, CONFIRMANDO_NOME}` | estado + tipo |
| `Final` | `fluxo === 'CONFIRMANDO_NOME'` | só o estado |

Ou seja: **passos de botão eram roteados pela intenção (ignorando o estado atual)** e
passos de texto livre pelo estado guardado. Consequência prática: clique em botão antigo
pula etapa. A mitigação existia, mas **fora deste sub-fluxo** — o nó `Botão Valido?` do
fluxo pai descartava clique com mais de 30 minutos.

## 3. O caminho feliz: 7 interações do cliente

Este é o **baseline de eficiência a bater**. Contando o que o cliente precisava tocar ou
digitar, do menu até o horário marcado:

| # | Cliente faz | Bot responde | Estado gravado |
|---|---|---|---|
| 1 | toca `MENU_AGENDAR` | botões "📲 WhatsApp / 🌐 Site" | `AGENDAMENTO_ESCOLHENDO_MEIO` |
| 2 | toca `AGENDAR_WHATSAPP` | botões com os 2 barbeiros | `AGENDAMENTO_ESCOLHENDO_BARBEIRO` |
| 3 | toca `BARBEIRO_<X>` | lista de dias (`GET dias-disponiveis`) | `AGENDAMENTO_ESCOLHENDO_DIA` + `barbeiro_id` |
| 4 | toca `DIA_<data>` | "Só um momento…" + horários (`GET horarios-disponiveis`) | `AGENDAMENTO_ESCOLHENDO_HORA` |
| 5 | toca `HORA_<data>_<hhmm>` | pede "nome e sobrenome" | `AGUARDANDO_NOME` + `data_hora` |
| 6 | digita o nome | card de conferência (3 botões) | `CONFIRMANDO_NOME` + `nomewpp` |
| 7 | toca "✅ Confirmar" | `POST /agendamentos` + "Agendamento confirmado" | `AGENDAMENTO_CONFIRMADO`, `etapa=1` |

Ramo `AGENDAR_SITE`: manda link de `autohost.shop` e grava `AGENDAMENTO_SITE`. **Beco sem
saída** — nenhuma etapa posterior lê esse estado, não há volta ao WhatsApp.

Havia também um **atalho para cliente conhecido**: se o nome já estava no estado, o passo 5
pulava direto para a marcação (nós `Marca #1` / `Marca #`), sem pedir nome nem confirmar —
5 interações em vez de 7. Convivia com o caminho longo, em código separado.

## 4. O custo dominante era duplicação por barbeiro

Tudo depois de "escolher barbeiro" existia **duas vezes**, uma cópia por profissional, com
a única diferença sendo `professionalId=1` vs `professionalId=2`:

- `Escolha o Dia #1` / `#3` — mesma URL, id diferente
- `Dias Monstados #1` / `#2` — **~90 linhas de código idênticas**, duplicadas
- `Transform #1` / `#3` — idênticos
- `Escolha a hora #1` / `#2`, `Padrão dos Botões #1` / `#2` — **~120 linhas idênticas**
- ramo inteiro pós-hora: `.` / `..` → `Compara #7` / `#8` → `Marca #1` / `Marca #` →
  `Digitando`… → `Enviar Mensagem #3` / `#16` → `Atualizar #19` / `#21` → `Saída #8` / `#12`

O mapa `barbeiro_id → professionalId` estava **hardcoded em 3 nós de código diferentes**
(`Transform #4`, `Transform #2`, e implícito nas URLs). Barbeiro novo = duplicar ~20 nós e
editar 3 mapas. Barbearia nova = fluxo novo.

**Bug real causado por isso:** o nó `Marca #` (ramo do Lucas Eloi) posta
`"profissional": "Lucas Costa"` — erro de copiar-colar não percebido. No atalho de cliente
conhecido, agendar com o Eloi gravava no nome do Costa. O nó genérico `Marca #2` (caminho
longo) usa o mapa e está correto. Evidência concreta do preço da duplicação.

## 5. A marcação em si: 3 cópias, sem idempotência, sem conflito

Três nós distintos (`Marca #1`, `Marca #`, `Marca #2`) fazendo o **mesmo** POST:

```
POST barberapi.autohost.shop/agendamentos
{ telefone, cliente, profissional, servico, dia_marcado, hora_marcada,
  status: "confirmado", source: "whatsapp" }
```

O que a implementação **não** fazia:

- **Nada de idempotência.** Reentrega do mesmo evento pela Meta = risco de agendamento
  duplicado. O dedupe por `wamid` existia no fluxo pai, não aqui.
- **Nada de conflito de horário.** Entre listar os horários e o cliente confirmar, o slot
  podia ter sido tomado — a resposta do POST não era verificada, e não havia tratamento de
  "esse horário acabou de sair".
- **`servico` sempre `''`.** O fluxo **nunca perguntava o serviço**. Disponibilidade e
  duração vinham implícitas da API do calendário, com duração fixa.
- Os IDs de botão carregavam `|ts=<epoch>`, extraído em `ts_extraido`, e **nunca usado**
  para rejeitar clique velho dentro deste sub-fluxo.

## 6. Dados dentro do ID do botão (e roteamento pelo rótulo)

O card de conferência gerava:

```
CONFIRMAR_NOME_{primeiro_nome}|ts={Date.now()}   →  "✅ Confirmar"
TENTAR_NOME_NOVAMENTE|ts={...}                   →  "Corrigir nome"
TROCAR_HORARIO|ts={...}                          →  "Trocar horário"
```

E depois `Transform #2` **reconstruía o nome fazendo parse do ID do botão**
(`/^CONFIRMAR_NOME_(.+?)\|ts=/`, trocando `_` por espaço). O nome já estava no banco
(`nomewpp`) — o ID do botão era um canal paralelo de dados, limitado (256 chars no id,
20 no título) e lossy (espaço ↔ `_`, só o primeiro nome).

Pior: `Compara #2` decidia a rota comparando **o rótulo visível**:
`button_title?.trim() === '✅ Confirmar'`. Mudar a copy (ou o emoji) quebrava o
roteamento silenciosamente — o `else` ia para `No Operation`, e o clique não fazia nada.

## 7. Botões oferecidos que ninguém tratava

- **`VOLTAR_DIAS`** — gerado quando não havia horário no dia escolhido ("Escolher outro
  dia"). Não existe saída no switch que reconheça esse id. **Botão morto.**
- **`TROCAR_HORARIO`** — oferecido no card de conferência. Também sem tratamento neste
  sub-fluxo. **Botão morto.**
- `TENTAR_NOME_NOVAMENTE` — esse sim tratado (`Compara #3` devolve para "digite de novo").
- Clique fora do esperado no passo final → `No Operation`, silêncio.

Registro do que a prática mostrou: **oferecer a saída é fácil, tratar a volta é que dá
trabalho** — e a volta ficou faltando nos dois casos.

## 8. Estado: colunas + um blob JSON

Estado guardado em `dados_cliente` (Supabase), escrito por 12 nós `Atualizar #N`:

| Coluna | Uso |
|---|---|
| `fluxo` | nome da etapa (string) |
| `etapa` | inteiro, virava `1` no fim |
| `barbeiro_id` | `LUCAS_COSTA` / `LUCAS_ELOI` |
| `nomewpp` | às vezes nome completo, às vezes só o primeiro |
| `data_hora` | **blob JSON** `{ data, hora, inicio, timezone }` |

Estados vistos aqui: `AGENDAMENTO_ESCOLHENDO_MEIO`, `_ESCOLHENDO_BARBEIRO`,
`_ESCOLHENDO_DIA`, `_ESCOLHENDO_HORA`, `AGENDAMENTO_SITE`, `AGUARDANDO_NOME`,
`CONFIRMANDO_NOME`, `AGENDAMENTO_CONFIRMADO`. **Nomenclatura descartada.**

Pontos que doeram:

- `data_hora` sem tipo: `Transform #2` precisava de
  `typeof etapa.data_hora === 'string' ? JSON.parse(...) : ...` porque chegava dos dois
  jeitos.
- `nomewpp` sem contrato: uns nós gravavam nome completo, outros só o primeiro
  (`.split(/\s+/)[0]`).
- Uma escrita saía por `postgres executeQuery` cru (`Tags Banco #2`), com o nome do cliente
  interpolado na string SQL e escape manual `.replace(/'/g, "''")` — **superfície de
  injeção contornada à mão**, no meio de um fluxo que usava o nó do Supabase em todos os
  outros 11 lugares.
- `Atualizar #5` **limpava** `data_hora` no fim, sem que fique claro o porquê.

## 9. Validação de nome: a única parte que a realidade escreveu

O nó `Nome - Tratamento` acumulou regras que só existem porque gente de verdade digitou
essas coisas. Isto é conhecimento sobre o **problema**, não sobre o n8n:

- normaliza `NFC`, colapsa espaços, faz `trim`
- capitaliza cada palavra, mantendo partículas minúsculas (`da`, `de`, `do`, `das`,
  `dos`, `e`)
- rejeita: vazio, menos de 5 caracteres, qualquer dígito, caractere fora de
  `[A-Za-zÀ-ÿ\s'-]`
- exige **≥ 2 palavras reais** (partículas não contam) → cobra sobrenome
- rejeita resposta genérica: `ok`, `sim`, `nao`, `não`, `oi`, `ola`, `olá`, `bom dia`,
  `boa tarde`, `boa noite`, `confirmar`, `confirmo`
- devolve `motivo_invalido` (`vazio` / `curto` / `tem_numero` / `caracter_invalido` /
  `sem_sobrenome` / `resposta_generica`) — mas o fluxo **ignorava o motivo** e mandava
  sempre a mesma mensagem genérica de erro

## 10. Data, hora e fuso: tudo na mão

- Toda data era ancorada com o truque `new Date(\`${ymd}T12:00:00-03:00\`)` para não
  escorregar de dia por fuso.
- Offset `-03:00` fixo, escrito literalmente em vários pontos (sem tratamento de DST —
  hoje o Brasil não tem, mas é premissa embutida).
- `DateTime.now().setZone('America/Sao_Paulo')` para saber "hoje".
- Rótulo do dia: `Hoje` → nome do dia da semana se for a **mesma semana** (semana começando
  na segunda) → `Segunda 04/08` se for semana seguinte.
- Hora ida e volta: `13:00` → id `HORA_2026-08-04_1300` → parse de volta com
  `slice(0,2) + ':' + slice(2,4)`.

## 11. Limites da Cloud API que moldaram a interface

Confirmam e detalham a seção 7 do `ANEXO_FLUXO_N8N.md`:

- **`button` aceita no máximo 3 opções; `list` aceita mais.** O nó `Padrão dos Botões`
  existia só para decidir: `≤ 3 horários` → `button`, `> 3` → `list`.
- **Dias:** o código cortava em `slice(0, 7)`, e o payload cortava de novo em
  `slice(0, 10)` — dois tetos diferentes, o menor vencendo silenciosamente. Pedia 15 dias
  à API (`days=15`) e mostrava no máximo 7.
- **Horários:** `slice(0, 10)` (limite de rows por seção da Meta).
- A descrição do dia mostrava contagem: `"N horário(s) disponível(is)"` — informação que
  vinha de graça da API (`availableSlotsCount`).
- Resposta do toque chega em `button_reply.id` **ou** `list_reply.id`, sempre lidas com
  fallback entre as duas.

## 12. Custo por mensagem: 2 a 4 chamadas HTTP

Cada resposta do bot custava:

1. `Digitando #N` → marcar como lida + "digitando"
2. `Digitando #M` → **de novo, payload idêntico** (par duplicado em todos os 7 pontos)
3. envio da mensagem (Meta)
4. `Saída #N` → espelho para `barberapi.autohost.shop/whatsapp/events`

Tudo **sequencial e sem retry**. E o corpo do espelho era uma **paráfrase escrita à mão** do
texto real, então os dois divergiam — o espelho dizia
`"Qual dia você prefere? para o agendamento"` enquanto o WhatsApp dizia
`"*Qual dia você prefere?*"`. Duas fontes de verdade para a mesma frase.

## 13. Resumo em números (baseline a bater)

| Métrica | Fluxo antigo |
|---|---|
| Nós para 1 caminho de agendamento | 102 |
| Barbeiros suportados | 2, hardcoded |
| Interações do cliente (caminho longo) | 7 |
| Interações (atalho cliente conhecido) | 5 |
| Chamadas HTTP por resposta do bot | 3 a 4 |
| Escritas de estado no banco | 12 nós distintos |
| Cópias do POST de marcação | 3 |
| Serviço perguntado | nunca |
| Botões oferecidos sem tratamento | 2 (`VOLTAR_DIAS`, `TROCAR_HORARIO`) |
| Bug encontrado na leitura | 1 (profissional errado no atalho do Eloi) |

## 14. Perguntas que essa leitura levanta para o desenho novo

**Não são respostas, e não são propostas.** São as decisões que o fluxo antigo tomou por
acidente e que no nosso vão ser tomadas de propósito, com o usuário:

1. **Quantas interações o cliente deve gastar?** O antigo gastava 7. Qual é o mínimo
   aceitável, e o que pode ser cortado (o passo "WhatsApp ou site?" é necessário? o
   barbeiro precisa vir antes do dia?).
2. **Roteamento por intenção ou por estado?** O antigo misturava os dois e ficou frágil
   com botão velho. Qual regra vale, e o que acontece com clique fora de ordem.
3. **Serviço entra no fluxo?** O antigo nunca perguntou — o que só funciona com duração
   fixa. Se entrar, muda disponibilidade, preço e duração.
4. **Barbeiro é dado ou é código?** O antigo era código (2 cópias de tudo). Precisa ser
   dado para o SaaS existir, mas a forma é decisão nossa.
5. **O que acontece quando o horário é tomado no meio do caminho?** Não havia resposta.
6. **Idempotência da marcação:** qual a chave que garante que reentrega não vira dois
   agendamentos.
7. **Onde mora a copy das mensagens** e como se evita ter duas versões do mesmo texto.
8. **Como o cliente volta atrás** (trocar dia, trocar hora, corrigir nome) — e o custo de
   oferecer isso, dado que no antigo dois desses botões existiam sem funcionar.
9. **Contrato do estado:** colunas tipadas ou blob? Quem pode escrever? O antigo tinha 12
   escritores e um blob JSON sem tipo.
