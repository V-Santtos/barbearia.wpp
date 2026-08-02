# CONTEXTO.md

Memória de **curto prazo**: onde estamos agora e qual o próximo passo. Muda a
cada etapa. Ler primeiro ao retomar uma sessão resetada.

O que é durável não mora aqui — mora em `REGRAS-APRENDIZADOS/`. Se uma seção
deste arquivo continuar verdadeira daqui a três meses, ela está no lugar errado.

## O projeto

SaaS de agendamento para barbearias. V1 = bot de botões no WhatsApp + calendário
próprio para o dono atender. Escopo completo em `docs/superpowers/specs/`.

Duas pastas de código, e a **integração entre elas é o trabalho de agora**:

| Pasta | O quê | Porta |
|---|---|---|
| `BARBEARIA/` | o bot (Hono + TypeScript + `pg`) | 3333 |
| `CALENDARIO/` | API de agenda (Fastify) + painel do dono (React) | 3334 + 3002 |

A 3000 desta máquina é do dev server do portfólio. Os dois serviços já sobem
juntos — foram os dois na 3333 até 2026-07-30.

Os dois falam com o **mesmo banco**: Supabase `sppexvjvnoganlduyjvs`. Acesso e
armadilhas em `REGRAS-APRENDIZADOS/ANEXO_BANCO/`.

## Onde estamos (2026-08-01)

**O agendamento fecha NO CELULAR, ponta a ponta.** Testado de verdade pelo WhatsApp
em 2026-08-01: `oi` → menu → barbeiro → dia → horário → nome → cartão → Confirmar →
linha em `agendamentos` (`Victor Cardoso / Lucas Costa / 2026-08-03 16:00 /
confirmado / bot-whatsapp`), batendo com o id do botão tocado.

**Dois bugs foram achados e consertados nesse teste** — os dois na janela da etapa do
nome, em `src/db/eventos.ts`. Os porquês estão no `REGRAS.md` (2026-08-01); em uma
linha cada:

1. **Confirmar reperguntava o nome.** O corte da janela era "último botão do dia",
   feito em SQL. O toque em Confirmar é gravado ANTES de o contexto ser montado, virava
   o próprio corte, e a janela excluía o nome digitado logo antes.
2. **Corrigir nome derrubava o horário.** O mesmo corte governava nome e reserva, que
   têm vidas diferentes. Só apareceu depois que o primeiro saiu da frente.

O corte saiu do SQL e virou `inicioDaEtapa()` em TypeScript, com `lerId` — o SQL agora
só entrega o dia. **195 testes**, `npm run typecheck` limpo.

**O nome vai para `dados_cliente`** desde 2026-08-01 (`guardarNome()` em
`src/db/contatos.ts`), escrita **única** (`and nome is null`), disparada só quando a
agenda confirma. Antes disso o nome vivia só na linha do agendamento — e some quando o
agendamento for podado. É o insumo de duas coisas: pular a pergunta do nome para
cliente cadastrado e o botão personalizado com o primeiro nome. O SQL foi provado
contra o banco em modo ensaio; **o gatilho ainda não foi visto disparar numa rodada
real.**

**O dono responde pelo painel.** `POST /whatsapp/conversations/:id/send` deixou de ser
501: trava de janela → pede o envio ao bot → grava com o `wamid` na mão. Testado no
celular do usuário, com entrega confirmada pela Meta. **E o bot cala enquanto o dono
atende**, voltando sozinho no toque em botão ou na virada do dia.

**A etapa do nome está montada** — validação frouxa, cartão de conferência como trava,
junção de mensagem picada e distinção entre acréscimo e correção. **Nunca foi testada
no celular**: é o assunto da próxima sessão.

**O bot leu "não consegui abrir a agenda" com a agenda no ar (20:06), e o motivo era
conexão de banco.** O pool do `pg` fecha conexão parada em 10s (padrão), e entre dois
toques do cliente passa mais que isso — então cada chamada reabria conexão com o
Supabase (~2s). Painel fazendo polling + espelho gravando + bot perguntando os dias no
mesmo instante empilharam: 203ms de rotina viraram 1,6s → 2,2s → 4,6s → 5,5s → **8711ms**
no `dias-disponiveis`, e o bot desiste em 8000ms. Por isso funcionava antes: dependia de
a rajada coincidir. Os dois processos agora abrem o pool com `idleTimeoutMillis: 0` +
`keepAlive` e **aquecem na subida** — mesma chamada, mesma rajada, **630ms**. Os números e
o que sobrou de latência (número de idas ao banco por rota, não handshake) estão em
`REGRAS-APRENDIZADOS/ANEXO_BANCO/README.md`.

**O fluxo inteiro foi validado depois disso**, no celular dele e também contra o bot
local: `oi` → menu → barbeiro → dia → horário → nome → cartão → Confirmar → `marcado`,
com linha em `agendamentos` e o nome caindo em `dados_cliente` — a escrita nova, **vista
disparar de verdade** pela primeira vez.

## A sessão de 2026-08-02 foi no protótipo do Dashboard, não no bot

O bot não foi tocado. A sessão inteira ficou em `Dashboard/`, e a memória curta
dela é o **`Dashboard/CONTEXTO_SESSAO.md`** — ler lá, não aqui. Em uma linha: o
celular foi refeito (Disponibilidade e barra de navegação, que virou dock), o
chip de período passou a governar só o que ele muda, a skill `impeccable`
(trazida pelo usuário, adoção parcial — `docs/skills-log.md`) rodou uma vistoria
de design, e entrou o painel **"O dia"** — o dia desenhado como relógio, com um
anel por barbeiro.

**O layout do V1 fechou e foi aprovado.** Financeiro não entra nesta fase, e o
lugar dele já está decidido: seção própria no rodapé da página, sem mexer em nada
acima. **Tarefa 3 fechada.**

**Próximo passo combinado: a tarefa 5** — levar o dashboard para dentro do
`CALENDARIO` de verdade (estado de view + `GET /dashboard/resumo`, rota admin,
uma chamada só por causa do rate limit).

## PRIMEIRA COISA AO RETOMAR (deixado em 2026-08-01)

**O fluxo fecha ponta a ponta e o estado está zerado** — as cinco tabelas e o
`dados_cliente` em 0 para o `553384246770`. Dá para testar do celular sem preparar nada,
depois de subir os três serviços e o túnel (a URL do ngrok muda toda vez).

Ainda **não commitado**: o pool aquecido nos dois processos, o comentário de teto em
`src/calendario/http.ts` e as duas notas (aqui e no `ANEXO_BANCO`). Segue assim —
a sessão de 02/08 commitou só o que é do `Dashboard/`, para não assinar trabalho
que não conferiu.

**O ambiente ficou de pé** ao fim da sessão (bot 3333, API 3334, painel 3002, túnel).
Conferir antes de assumir: `curl -s -o /dev/null -w "%{http_code}" localhost:3333/saude`
e `curl -s localhost:4040/api/tunnels`. **A URL do ngrok muda toda vez que o túnel
sobe** — se ele subir de novo, entregar a URL nova com o caminho, para colar em
Webhooks → Conta comercial do WhatsApp. Subir o túnel é **meu** trabalho, nunca no
terminal dele (`Bash(ngrok:*)` está liberado; ver a seção do túnel abaixo).

**O estado foi zerado nas cinco tabelas** antes do reset, e `dados_cliente.nome`
continua `NULL` de propósito — é o ponto de partida que prova a escrita nova.

**Já validado no celular (não repetir sem motivo):**

- `oi` → menu → barbeiro → dia → horário → pergunta do nome
- Nome completo numa mensagem → cartão → Confirmar → **agendamento gravado**
- Cartão em formato `button`: **a Meta aceitou**, com cabeçalho à vista

**O que falta exercitar:**

1. **Nome picado**: mandar só o primeiro nome e depois o sobrenome — deve **fechar
   sozinho, sem toque**. Atenção: o cartão **não tem mais rodapé** (removido a pedido
   dele em 2026-08-01), então o cartão de nome incompleto ficou sem a dica "se tiver
   sobrenome, é só mandar abaixo". Ele quer ver se fica mudo demais; se ficar, o
   conserto combinado é na mensagem curta da frente, **não** trazendo o rodapé de volta.
2. **Correção**: `Vicctor` e depois `Victor` — deve **reimprimir o cartão**, não
   agendar. O caminho do botão `Corrigir nome` rodou uma vez em cima do código com o
   bug da reserva; **depois do conserto ele não voltou a rodar.**
3. **Lixo**: `ok`, `123` — recusa com a frase do motivo e o exemplo.
4. **`dados_cliente.nome`**: depois de qualquer agendamento fechar, conferir que o
   nome caiu na tabela. `npm run db -- "select telefone, nome from dados_cliente"`.

**Depois disso:** subir no GitHub e preparar o deploy na Vercel. Combinado como
próximo assunto, não aberto ainda.

### 1. Subir os três serviços e o túnel

São três processos, cada um numa pasta, mais o ngrok. **Todos em background.**

| O quê | Onde | Comando | Porta |
|---|---|---|---|
| Bot (Hono) | `BARBEARIA/` | `npm run dev` | 3333 |
| API do calendário (Fastify) | `CALENDARIO/` | `npm run server` | 3334 |
| Painel do dono (React/Vite) | `CALENDARIO/` | `npm run dev` | 3002 |

O túnel é **um só**, e aponta para o bot — só ele recebe da Meta. Subir é comigo,
**nunca pelo terminal do usuário** (processo iniciado num terminal morre quando ele
fecha a janela — foi o que aconteceu em 2026-08-01 e irritou, com razão).

`ngrok` sem extensão dá `Exec format error` no Bash (shim npm). O que executa é o
`.cmd`, em background:

```
ngrok.cmd http 3333
```

`Bash(ngrok:*)` e `Bash(ngrok.cmd:*)` estão liberados em `.claude/settings.local.json`
desde 2026-08-01. As formas antigas — `Start-Process` e `cmd.exe /c "start /b …"` —
foram barradas pelo classificador; não insistir nelas.

Pegar a URL pública em `http://127.0.0.1:4040/api/tunnels` e conferir que os três
respondem (`3333/saude` → 200, `3334/` → 200, `3002/` → 200; a raiz da 3333 dá 404,
e isso é o certo — ela só tem `/saude` e `/webhook/whatsapp`).

**A URL do ngrok muda a cada sessão.** Entregar ao usuário a URL completa, com o
caminho, para ele colar em Webhooks → Conta comercial do WhatsApp:
`<url-do-ngrok>/webhook/whatsapp`. O verify token não muda.

### 2. O reset do estado de teste — SÃO CINCO TABELAS

Foi limpo no fim da sessão de 2026-08-01. **Não precisa rodar nada** para o primeiro
teste. Para repetir um teste no mesmo dia, roda os cinco, de dentro de `BARBEARIA/`.
A ordem importa: as chaves estrangeiras exigem mensagem → conversa → contato.

```bash
npm run db -- "delete from agendamentos where telefone = '553384246770'" -- --gravar
```
```bash
npm run db -- "delete from webhook_eventos where de = '553384246770'" -- --gravar
```
```bash
npm run db -- "delete from whatsapp_messages where conversation_id in (select c.id from whatsapp_conversations c join whatsapp_contacts ct on ct.id = c.contact_id where ct.phone = '553384246770')" -- --gravar
```
```bash
npm run db -- "delete from whatsapp_conversations where contact_id in (select id from whatsapp_contacts where phone = '553384246770')" -- --gravar
```
```bash
npm run db -- "delete from whatsapp_contacts where phone = '553384246770'" -- --gravar
```

**Um comando só, com `delete from` sem `where`, é barrado pelo classificador** — e o
bloqueio está certo. Escopar no telefone passa.

**Conferir depois, sempre** — `select count(*)` nas cinco. Rodar o delete e anunciar
"zerado" sem olhar já deu errado duas vezes no mesmo dia
(`REGRAS-APRENDIZADOS/APRENDIZADOS.md`, 2026-08-01).

`webhook_eventos` é a memória do bot; as `whatsapp_*` são o espelho que alimenta a tela
de conversas do painel. **São independentes**: limpar só a primeira deixa a conversa
antiga visível no painel.

`dados_cliente` **não entra no reset** — é o cadastro, e preservá-lo é o ponto. Mas
depois que um agendamento fechar, `nome` deixa de ser `NULL`; para repetir o teste da
escrita do nome, zerar só esse campo:

```bash
npm run db -- "update dados_cliente set nome = null where telefone = '553384246770'" -- --gravar
```

## O passo DIA E HORÁRIO: feito em 2026-07-30

A lógica de disponibilidade **já existia e é boa** — está na API do calendário, não
em função SQL. Duas rotas resolvem o passo:

- `GET /agendamentos/dias-disponiveis?professionalId=` — quais dias têm vaga.
  **O bot não manda `days=` de propósito:** sem o parâmetro, a rota usa a janela que o
  dono configurou (`agenda_profissional.janela_agendamento_dias`). Uma régua só.
- `GET /agendamentos/horarios-disponiveis?professionalId=&date=` — os horários de
  um dia
- `POST /agendamentos` — marca, revalidando tudo e tratando o índice único.
  **Ainda não é chamado por ninguém** — é a próxima fatia.

A janela da agenda passou de 7–15 para **4–10 dias** (migração `20260730190000`),
porque uma lista do WhatsApp aceita 10 linhas. A barra existe em duas telas do painel
(`AgendaSettingsModal` e `Sidebar`) e as duas leem a mesma constante.

**Latência medida contra o banco real:** a primeira consulta do processo leva ~4,8s
(abre a conexão com o Supabase), as seguintes ~0,9s. A API é local, mas o banco dela
não. O teto do `fetch` é 8s por causa disso.

### Decidido em 2026-07-30: o bot fala por HTTP, e os dois rodam local

**Caminho: HTTP na API do calendário.** A regra de disponibilidade não está em
SQL — são sete funções JavaScript no `server.js`, com sutilezas (o slot tem o
tamanho da `duracao_min` *daquele* profissional; a fronteira manhã/tarde nasce do
intervalo de descanso dele). Ir direto ao banco significaria reescrever tudo isso
no bot e conviver com duas implementações da mesma regra. Elas divergiriam, e o
sintoma seria o pior tipo: painel mostrando um horário livre e bot oferecendo
outro, **sem erro e sem log**.

O contra-argumento óbvio — "amarra o bot a um segundo serviço" — não se sustenta:
o painel do dono não funciona sem essa API, então ela está no ar de qualquer
jeito. E há precedente: o site público consumia exatamente esses endpoints, por
HTTP, em produção.

**Endereço: local.** Bot na 3333, calendário na 3334, lado a lado. O bot chama
`http://localhost:3334`. Só o bot precisa de túnel, porque só ele recebe da Meta.

### Três ajustes na API, adiados com gatilho

Nenhum é urgente no teste local, e fazê-los agora seria defesa contra volume
inexistente num serviço que ninguém alcança. Ficam registrados para não virarem
"depois é nunca":

- **Rate limit barra o bot.** `POST /agendamentos` aceita 10/min por IP, e o bot é
  um IP só atendendo todos os clientes. **Gatilho:** sair de `localhost` — em
  produção o 11º cliente da hora leva 429 sem ter feito nada.
- **`POST /agendamentos` é escrita aberta, sem token.** Era assim porque o site
  marcava sem login; o site morreu e a porta ficou. **Gatilho:** a API ganhar
  endereço público.
- **Não há idempotência — e o gatilho DISPAROU em 2026-07-31**, com o passo de
  confirmar. Hoje o `409` vira "esse horário acabou de ser pego", frase que está certa
  quando o ocupante é outra pessoa e **errada quando é o próprio cliente** tocando
  duas vezes em Confirmar. O toque duplo é real desde o dia um, porque a trava de
  rajada vale só para texto (`REGRAS.md`): **toque em botão nunca é suprimido.**
  O conserto mais barato continua não sendo na API: o bot consulta se aquele cliente
  já tem agendamento naquele horário e responde "você já está marcado". **Não foi
  feito** — fica aqui para não virar "depois é nunca".

**Regra que vira explícita:** `agendamentos.profissional` é texto sem FK, e a
trava de double-booking depende do nome bater exatamente. O bot já lê
`profissionais`, então manda o nome de lá — nunca digitado à mão.

Como o passo novo se encaixou, para a próxima fatia repetir a forma:

1. Id com o contexto dentro: `1.dia?b=1&d=2026-08-04`, `1.hora?b=1&d=…&h=13:00`.
2. Rota no `switch` de `rotear.ts` + nome em `NOMES_RESPOSTA` **e no mapa `AJUDA`** —
   sem a frase de ajuda o TypeScript recusa compilar, de propósito.
3. O roteador continua puro: o que vem da API entra pelo `ContextoFluxo`, como
   `barbeiros` já entrava. Quem decide **o que buscar** é `alvoDaAgenda()` em
   `src/db/eventos.ts`, que lê o id com o mesmo `lerId` — nunca um parser paralelo.
4. Escada de feedback, cadastro de contato e dedupe valeram sem alteração.

Baseline do fluxo n8n antigo: **7 interações do cliente** para marcar (5 no atalho de
cliente conhecido). No mesmo trecho — do menu até a pergunta do nome — o n8n gastava
**5 toques** e aqui são **4**: agendar, barbeiro, dia, horário. A economia é a pergunta
"WhatsApp ou site?", que deixou de existir. Com 1 barbeiro ativo caem para 3. Ver
`ANEXO_FLUXO_N8N_AGENDAMENTO.md`.

## Armadilhas de retomar sessão

**A URL do ngrok morre a cada sessão.** Subir o túnel de novo e recolar a URL de
callback no painel da Meta. Detalhes em `ANEXO_WHATSAPP_META/README.md`.

**Resetar o estado antes de testar do celular.** O bot lembra do que falou com o
número **no dia corrente**, então retomar um teste no mesmo dia faz o cliente cair
na escada de feedback e parecer bug. **São cinco tabelas, e o comando completo está
na seção "O reset do estado de teste"** — limpar só `webhook_eventos` deixa a conversa
antiga no painel e o agendamento velho na agenda. `553384246770` é o número de teste.

**Estrutura de tabela se pergunta ao banco**, nunca a um markdown (`npm run db`).

## Pendências em aberto

- ~~`POST /whatsapp/events` sem ninguém escrevendo nele~~ — **feito em 2026-07-30.**
  Ver `src/calendario/crm.ts`.
- ~~`POST /whatsapp/conversations/:id/send` devolvendo 501~~ — **feito em 2026-07-31.**
  O dono responde pelo painel; o bot é o transporte. Ver `src/whatsapp/painel.ts`.
- **Pular a pergunta do nome para cliente já cadastrado** — decidido com o dono em
  2026-07-31, **não implementado**. Hoje a frase "como você é novo por aqui" sai para
  todo mundo, e quem já fechou um agendamento a lê de novo na segunda vez. O `ponytail:`
  está no ponto exato, em `escolherHora()` de `src/fluxo/rotear.ts`.
  **O que faltava já existe:** desde 2026-08-01 o nome é gravado em `dados_cliente`
  (`guardarNome()`), e `registrarContato()` já devolve esse nome no `ContextoFluxo`
  (`contexto.nome`). Falta só o roteador usar.
- **Corrigir o nome de um cliente já cadastrado** — não existe em lugar nenhum. Ficou
  decidido que **não** vira opção de menu no WhatsApp (ficaria na frente de 100% dos
  clientes para resolver algo raro); o lugar é um campo no painel do dono.
- **O telefone vai deixar de ser a chave** — nomes de usuário do WhatsApp + BSUID.
  Não é ideia nossa nem hipótese: está em produção desde abril/2026, é **obrigatório**
  para quem usa a plataforma, e quem adota nome de usuário some do webhook sem
  `wa_id`. Hoje o telefone é a chave de `webhook_eventos`, da trava por contato, de
  `dados_cliente`, do `UNIQUE (phone)` em `whatsapp_contacts` e de `agendamentos`.
  **Gatilho: antes do deploy em produção** — em localhost a regra dos 30 dias esconde
  o problema, porque o número de teste já conversou com a gente. Levantamento completo,
  com o formato do payload e as datas, em
  `REGRAS-APRENDIZADOS/ANEXO_WHATSAPP_META/NOMES_DE_USUARIO.md`.
- **Cutucão por inatividade** — ideia do usuário em 2026-07-30, não existe ainda.
  **Cuidado com o mal-entendido:** a escada de feedback não é por tempo, dispara
  quando o cliente digita em vez de tocar. O que ele quer é outra coisa: mensagem
  depois de um período de **silêncio**. Precisa de outbox (`envios_pendentes`) +
  Vercel Cron, porque ninguém está pedindo nada na hora em que ela sairia.
  Combinado: **aperfeiçoar mais pra frente.**
- **Teto de 2 barbeiros do plano não está travado em código.** Um terceiro ativo
  aparece na lista. Hoje é regra comercial; o lugar dela é a futura tabela de
  barbearias/plano.
- **Hospedagem definitiva** — hoje é túnel ngrok. Migrar pra Vercel quando o fluxo
  estabilizar.
- **Trocar o token de envio antes da produção** (ver `ANEXO_WHATSAPP_META/`).
- **Coexistência** — parada por decisão, com caminho em aberto. Ver
  `ANEXO_WHATSAPP_META/COEXISTENCIA.md`.
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
