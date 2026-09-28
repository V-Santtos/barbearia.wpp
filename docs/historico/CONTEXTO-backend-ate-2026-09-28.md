# CONTEXTO.md

Memória de **curto prazo**: onde estamos agora e qual o próximo passo. Muda a
cada etapa. Ler primeiro ao retomar uma sessão resetada.

O que é durável não mora aqui — mora em `REGRAS-APRENDIZADOS/`. Se uma seção
deste arquivo continuar verdadeira daqui a três meses, ela está no lugar errado.

## O projeto

SaaS de agendamento para barbearias. V1 = bot de botões no WhatsApp + calendário
próprio para o dono atender. Escopo completo em `docs/superpowers/specs/`.

Duas pastas de código:

| Pasta | O quê | Porta |
|---|---|---|
| `BARBEARIA/` | o bot (Hono + TypeScript + `pg`) | 3333 |
| `CALENDARIO/` | API de agenda (Fastify) + painel do dono (React) | 3334 + 3002 |

Os dois falam com o **mesmo banco**: Supabase `bbcuudayemhjanklfgtr` (projeto novo,
01/09 — ver a seção abaixo). Acesso e armadilhas em
`REGRAS-APRENDIZADOS/ANEXO_BANCO/`.

## Auditoria de entrada (2026-08-28) — `AUDITORIA/`

O projeto trocou de mão. A varredura de ponta a ponta feita na entrada está em
**`AUDITORIA/`**, e é o ponto de partida de quem chega agora: mapa do sistema,
inventário de rotas, riscos ranqueados, o que é peso morto e como levantar tudo.

**`AUDITORIA/02-BANCO.md`** foi o que destravou tudo: das dez tabelas que o código
usa, sete não tinham DDL em lugar nenhum. Ele traz o schema reconstruído a partir de
cada query, com as incertezas declaradas — e virou migração versionada em 01/09. O
banco já foi recriado; o arquivo agora vale como **o porquê de cada coluna**, e
porque as incertezas de tipo continuam de pé (`preco` é a maior).

Os riscos de `04-RISCOS.md` continuam válidos, **menos os de deploy**, resolvidos em
01/09. Os de autenticação e falta de teste seguem intocados.

## O sistema está NO AR e funcionando (2026-09-01)

**`https://barbearia-wpp-two.vercel.app`** — painel, API e bot, os três de pé,
lendo um banco reconstruído. Primeira conversa real atravessou o sistema inteiro
neste dia. Substitui a seção "o deploy está quebrado", que era o estado de 28/08.

| Peça | Estado |
|---|---|
| Painel (React/PWA) | ✅ no ar |
| API do calendário | ✅ lendo o Supabase |
| Bot de WhatsApp | ✅ atendendo, **URL de webhook fixa** |
| Banco | ✅ 10 tabelas, RLS em todas, recriável do zero |

**O banco é um projeto NOVO:** `bbcuudayemhjanklfgtr`. O antigo
(`sppexvjvnoganlduyjvs`) foi perdido, e este foi reconstruído pelas migrações
deste repositório — que agora sabem recriá-lo do zero. Detalhes e as incertezas
da reconstrução em `AUDITORIA/02-BANCO.md`.

**Vercel: conta pessoal, deploy MANUAL pelo CLI**, sem conexão com o Git (decisão
do dono). Push no GitHub **não publica nada** — são dois gestos separados:

```bash
npx vercel deploy --prod --yes --scope inadequado-3455s-projects
```

O deploy antigo (`barbearia-wpp.vercel.app`) **continua no ar, numa conta que não é
nossa** — provavelmente do desenvolvedor anterior. Está quebrado e ninguém aqui
consegue desligá-lo.

### Os quatro defeitos consertados hoje, e o que cada um ensina

1. **404 em rota aninhada.** `api/[...caminho].mjs` não era lido como catch-all
   pela Vercel — virava rota de UM segmento chamada `...caminho`. Sumiam Dashboard,
   Conversas e o webhook inteiro. Agora o roteamento é declarado no `vercel.json`;
   **não voltar a depender de inferência por nome de arquivo.**
2. **POST do webhook pendurava 30s.** A Vercel entrega o corpo já parseado e com o
   stream esgotado; o `getRequestListener` do @hono/node-server esperava bytes que
   nunca vinham. Conserto: handler no estilo Web, o que exige **métodos HTTP
   nomeados** (`export const POST`) em `api/bot.mjs`, e não `export default`.
   Remontar o corpo não era opção — a assinatura HMAC precisa dos bytes exatos.
3. **Fuso três horas errado.** `process.env.TZ = process.env.TZ || "..."` — a
   Vercel define `TZ=UTC`, que é truthy, e o fallback nunca aplicava. A barbearia
   perdia as três últimas horas de agenda todo dia, **sem erro e sem log**. `TZ` é
   nome reservado na Vercel; o fuso agora é cravado no código.
4. **Migrações não rodavam em banco novo.** O runner consultava
   `supabase_migrations.schema_migrations` antes de existir, e o modo ensaio
   revertia cada migração antes da seguinte, acusando erro falso numa cadeia.

**A lição que atravessa os quatro:** todos passaram no teste local e só apareceram
em produção. Nenhum dava erro — davam resposta errada em silêncio.

### Seed de teste

`BARBEARIA/db/seed/teste.sql`, aplicado. Idempotente; todo agendamento nasce com
`source = 'seed-teste'`, que é o discriminador para separar sintético de real e
limpar depois.

Foi ele que tornou o bug de fuso visível — com o banco vazio não havia horário
para faltar.

**Desde 04/09 ele tem DUAS barbearias**, e essa é a parte que importa: com uma loja
só, o isolamento entre barbearias é intestável — toda consulta acerta por acidente,
porque não existe dado errado para devolver. A loja B ('central-teste') é o
instrumento de medida. O serviço dela chama-se literalmente "SÓ DA LOJA B — se
aparecer na A, vazou", e ele **aparece** hoje no `GET /api/servicos`: o vazamento é
real e agora é visível, que era o objetivo.

**O que ele NÃO faz:** reproduzir as patologias do banco real (telefone em formato
antigo, cliente duplicado). Seed limpo só testa o caso feliz. (Agendamento órfão de
profissional deixou de ser possível — `profissional_id` tem FK desde 04/09.)

## Multi-tenant — Fase 1 aplicada (2026-09-04)

Plano completo em `~/.claude/plans/unified-greeting-russell.md`. Decisões travadas
com o usuário antes de codar:

1. **Tenant = barbearia** (não profissional). O painel continua sendo a visão do dono
   sobre a loja toda — é o que ele já é: gerencia equipe, alterna barbeiros, define cor.
2. **RLS de verdade via troca de role na API**, preservando as 2.501 linhas de regra
   de agenda do `server.js`.
3. **Um número de WhatsApp por barbearia.** O bot continua perguntando "com qual
   barbeiro?" — nenhuma mudança de fluxo.
4. **Login com e-mail e senha, não magic link.** A versão final é auto-serviço com
   pagamento; magic link põe uma ida à caixa de e-mail no meio do funil de pagamento,
   faz a entrega de e-mail virar caminho crítico da receita, e briga com o painel ser
   PWA `standalone` + app Android (Capacitor). Os dois convivem no mesmo `auth.users`,
   então `signInWithOtp` pode entrar depois como recuperação, sem migração.

### O que a Fase 1 fez (4 migrações, aplicadas e verificadas)

- `barbearias` criada; a loja atual cadastrada pelo `phone_number_id` que **já
  chegava** no webhook desde o primeiro dia e nunca era lido.
- `barbearia_id` em 8 tabelas. `agenda_profissional` e `dias_bloqueados` ficam de
  fora de propósito — penduram em `profissionais` por FK, e a política de RLS delas
  resolve por join; denormalizar criaria uma segunda fonte da mesma verdade.
- Os uniques globais de telefone viraram por-barbearia. Eram o vazamento mais
  concreto: um cliente falando com duas lojas virava uma linha só.
- `agendamentos.profissional_id` com FK — antes era só o **nome** copiado, sem FK.
- A trava de double-booking `agendamentos_slot_ativo_unique`, que **o `server.js`
  já tratava no `catch` e não existia no banco**. Código morto esperando um erro que
  nunca chegava; o que protegia o slot era só "consulta, depois insere", que perde a
  corrida.

### Os dois dispositivos de transição — têm data para morrer

**Migração e deploy não são atômicos entre si.** O banco muda por um comando, o
código por outro, e existe um intervalo. Ignorar isso teria derrubado o sistema no
ar: `not null` sem default quebra todo insert do código em produção, que não sabe
que barbearias existem.

- **Gatilho** `agendamentos_resolver_profissional` — deriva `profissional_id` do
  nome quando o insert não traz o id.
- **Default** `barbearia_em_transicao()` — aponta `barbearia_id` para a loja atual.

Os dois foram **verificados através do deploy real**, não só em ensaio: um `POST
/api/agendamentos` pelo código que está no ar gravou `profissional_id=1` e
`barbearia_id=1` sozinho.

**Risco conhecido enquanto existirem:** um INSERT novo que esqueça `barbearia_id`
não dá erro — cai na loja A em silêncio. É o preço de não ter janela de
indisponibilidade, e por isso não podem virar moradia. Saem no fim da Fase 4, junto
com a coluna `agendamentos.profissional` (texto).

### Fase 2 — políticas de RLS escritas e provadas (2026-09-07)

Migração `20260907120000_rls_por_barbearia.sql`. O que entrou:

- **11 políticas**, uma por tabela, `for all to authenticated` com `using` **e**
  `with check`. Faltar o `with check` é o erro clássico: a leitura fica isolada e a
  escrita não — o dono da loja A conseguiria inserir linha na loja B.
- **`barbearia_atual()`**, `security definer` com `search_path` fixo. O definer não é
  enfeite: a política de `barbearias` chama a função, que lê `barbearias` — sem ele, a
  leitura dispara a política de novo, em recursão infinita.
- **Papel `app_api`**, com LOGIN e **sem bypass**. A alternativa (seguir como
  `postgres` e só fazer `set local role`) falha ABERTO: uma rota que esquecesse a linha
  devolveria o banco inteiro, sem erro. Com papel sem bypass, a mesma distração
  devolve zero linhas — quebra na cara, e não vaza.
- **Sem GRANT nenhum:** medido antes de escrever que `authenticated` já tem
  SELECT/INSERT/UPDATE/DELETE em tudo (padrão do Supabase). A RLS já era a única coisa
  entre esse papel e o banco.

**Provado, não presumido.** Teste com dois donos sintéticos, um por loja: A vê 2
profissionais / 4 serviços / 8 agendamentos, B vê 1 / 1 / 2, nenhum vê o do outro,
A não consegue inserir na loja B (`42501`) nem editar profissional dela (0 linhas),
e `anon` vê zero. Tudo em transação com rollback.

### As políticas ainda NÃO estão protegendo nada, e isso é esperado

A RLS continua inerte para o sistema no ar: `server.js` e bot conectam como
`postgres`, que ignora política. O vazamento da loja B **segue visível** no
`GET /api/servicos` — conferido depois de aplicar.

O que falta para elas valerem é o item 2.3 do plano: `server.js` conectar como
`app_api` e fazer, por requisição, dentro de transação:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
```

Isso **depende do JWT existir**, ou seja, da Fase 3. Por isso 2.3 muda de fase: sai
da Fase 2 e entra junto com a autenticação, que é onde o `sub` passa a existir.

### Fase 3 — código pronto, esperando só a configuração (2026-09-07)

Tudo que não dependia do painel do Supabase está feito e verificado.

**Servidor** (`CALENDARIO/lib/autenticacao.js`, novo):
- verificação de JWT por JWKS (`jose`), com cache — o projeto usa **ES256
  assimétrico**, e o endpoint de chaves é público e derivável do ref, então não era
  bloqueio nenhum: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`
- `comUsuario()` — abre transação, `set local role authenticated`, injeta
  `request.jwt.claims`. É a ponte entre o JWT e a RLS
- **dois pools**: serviço (`postgres`, para as rotas públicas) e painel (`app_api`,
  sem bypass). É o que faz o esquecimento falhar FECHADO
- as **15 rotas do painel** envolvidas em `noPainel()`; 20 consultas passaram do pool
  de serviço para o cliente da transação

**Painel** (`CALENDARIO/lib/sessao.ts`, novo): `signInWithPassword`, sessão do
Supabase como fonte única (`onAuthStateChange`), credencial em toda chamada da API.
`LoginScreen` parou de comparar strings do bundle.

**Verificado, com JWT que eu mesmo assinei** (emissor local no lugar do Supabase; só
o emissor é falso — verificação, troca de papel e políticas são as reais): dono A vê
8 agendamentos e 2 profissionais, dono B vê 2 e 1, nenhum vê o do outro. Recusados:
sem token, `ADMIN_API_TOKEN` antigo, token `role=anon`, assinatura de outra chave,
token expirado. Rota pública segue aberta. `tsc` limpo, build ok.

**Segredos fora do bundle:** e-mail e senha do dono, confirmado por busca no `dist`.
O `ADMIN_API_TOKEN` só sai quando a variável deixar de ser fornecida no build —
conferido que some quando ela não existe.

### Dois helpers que continuam ignorando RLS, de propósito

`registrarMensagem` e `getAgendaConfig` usam o pool de serviço. É seguro por uma
invariante: os dois só são chamados do painel depois de uma consulta sob RLS que já
provou a posse (a rota `/send` carrega a conversa e devolve 404; o `/dashboard/resumo`
lê os profissionais antes). A invariante está escrita nos dois, porque conhecimento
implícito é como buraco nasce depois.

### Modo legado — o dispositivo que evita dia-D

Sem `SUPABASE_JWKS_URL`, servidor e painel voltam ao comportamento antigo. Existe
porque deploy e configuração são gestos separados aqui, e um guard que exigisse JWT no
instante do deploy deixaria o painel fora do ar até a última variável entrar. O
servidor **avisa no log a cada subida** enquanto estiver nesse modo. Sai quando o JWT
estiver de pé.

## Mudança de rumo: agendamento sai do WhatsApp (2026-09-08)

Decidido em duas etapas, em dois dias: primeiro o bot passaria a responder com o link
do site (07/09); no dia seguinte, **nenhuma interação** (08/09). O agendamento é pelo
site, e o bot fica calado.

**O que "calado" significa aqui:** ele continua recebendo, gravando em
`webhook_eventos` e espelhando no painel de Conversas. Standby é sobre o bot FALAR,
não sobre ele ouvir — sem isso, o cliente que escrevesse sumiria sem deixar rastro.
Quem responde é o dono, à mão, pelo painel.

**Consequência a encarar:** quem escrever no WhatsApp não recebe nada automático. Se
o dono não olhar o painel, a mensagem fica sem resposta. Antes o bot cobria isso.

**Ligado por `BOT_STANDBY=1`.** Um interruptor, e reversível: nada do fluxo foi
removido: ele está inteiro atrás de um desvio na primeira linha de `rotear()`.

### O defeito que o standby de 07/09 escondia

`alvoDaAgenda` roda **antes** do roteador, então o silêncio dele não alcançava aquela
linha. Um cliente tocando num "Confirmar" de uma conversa anterior ao standby cairia
em `{ tipo: 'marcar' }` e o bot **marcaria um agendamento de verdade** — calado. Um
horário apareceria na agenda do dono sem que ele nem o cliente tivessem marcado.

A guarda ficou dentro de `alvoDaAgenda`, que é função pura: ali o teste alcança, e um
chamador futuro não tem como esquecer. De quebra, sumiu a chamada HTTP dentro da
transação — o ponytail vencido de `registrarEDecidir`.

204 testes passando, `tsc` limpo.

### O que isso destravou

O bot era o único consumidor de `/dias-disponiveis`, `/horarios-disponiveis` e
`POST /agendamentos` além do site. Calado, ele sai do caminho — então **tornar o slug
da barbearia obrigatório nas rotas públicas deixou de ter bloqueio**. É o próximo
passo, e agora tem um consumidor só: o site.

### Plano reordenado (08/09)

| | Antes | Agora |
|---|---|---|
| Fase 3 | Autenticação | igual, esperando configuração do Supabase |
| Fase 4 | Bot multi-número | **Rotas públicas por barbearia** |
| Fase 5 | Painel | igual |
| Fase 6 | — | Bot multi-número, quando ele voltar |

O slug será **obrigatório** (400 sem ele), e não opcional com padrão: padrão silencioso
repete o problema do `barbearia_em_transicao()` no banco — quem esquecer atende a loja
errada sem erro.

## Fase 4 — rotas públicas por barbearia (2026-09-08)

As 9 rotas públicas passaram a exigir a barbearia. Elas eram o caminho crítico do
site e **nenhuma sabia de qual loja falava**.

**O slug é obrigatório** (400 sem ele), não opcional com padrão: padrão silencioso
repetiria aqui o defeito que o `barbearia_em_transicao()` tem no banco.

**Duas formas de dizer qual barbearia**, e não é indecisão — são dois chamadores com
informações diferentes: o **site** é anônimo e sabe de qual loja é (manda o slug); o
**painel** é logado e não sabe o próprio slug (quem diz é o JWT). Quatro rotas são
usadas pelos dois. O slug tem precedência quando vem.

### Três bugs achados no caminho

1. **Junção por NOME.** `horarios-disponiveis` e `dias-disponiveis` juntavam
   `agendamentos` com `profissionais` em `ON a.profissional = p.nome`. Com duas lojas,
   barbeiros homônimos casariam um com o outro — horário ocupado numa apareceria
   ocupado na outra. Agora é por `profissional_id`.
2. **`POST /agendamentos` resolvia o profissional pelo nome, globalmente**
   (`WHERE nome = $1 ... LIMIT 1` sobre a tabela inteira). O `LIMIT 1` escolhia por
   sorteio. Agora resolve dentro da barbearia, aceita `profissional_id` (preferido), e
   nome ambíguo **dentro da mesma loja** vira 409 explícito.
3. **`POST /profissionais` teria dado 42501 para o dono da loja B.** Ele inseria sem
   `barbearia_id`, caindo no default de transição (sempre loja A), e o `with check` da
   RLS recusaria. Agora grava `public.barbearia_atual()`.

### `verificar-telefone` era o vazamento mais sério

Sem recorte, ela respondia se um telefone tem horário marcado em **qualquer**
barbearia do SaaS. Um concorrente com uma lista de clientes descobriria onde cada um
corta o cabelo, uma consulta por vez, sem login.

### Default de transição estreitado

`agendamentos`, `profissionais` e `servicos` perderam o default — o calendário passou
a mandar a barbearia explícita. Sobraram as 5 tabelas que só o bot escreve, e elas
saem na Fase 6. Rede de segurança além do necessário deixa de ser rede e vira chão
falso.

**Verificado:** isolamento em todas as 9 rotas, profissional de outra loja dá 404 em
5 rotas, `verificar-telefone` não vaza, POST grava os ids explícitos, o painel resolve
pela sessão sem slug, e o dono da loja B consegue criar profissional na loja certa.

## PENDENTE: o deploy (adiado em 08/09/2026)

Tudo abaixo está **pronto e verificado localmente, e NÃO está no ar**. O banco já
mudou (Fases 1 e 2 aplicadas); o código que sabe usar essas mudanças, não. O que
segura o sistema funcionando nesse intervalo são os dois dispositivos de transição
(gatilho + default `barbearia_em_transicao()`).

### As Fases 3 e 4 agora sobem JUNTAS, com o JWT ligado

Isto mudou em 08/09 e custa uma quebra se for ignorado: quatro rotas públicas são
usadas também pelo painel (`/profissionais`, `/servicos`, `agenda-config`,
`dias-bloqueados`). O painel não manda slug — ele depende da sessão. **Em modo legado
não há sessão, e essas quatro respondem 400.**

Ou seja: `SUPABASE_JWKS_URL` e as variáveis do Supabase deixaram de ser opcionais
neste deploy. Subir o código sem elas deixa o painel meio quebrado (calendário e
dashboard funcionam; equipe, serviços e configuração de agenda, não).

Conferido no ar local, nos dois modos.

### A ordem importa, e errá-la derruba o bot

**`BOT_STANDBY=1` tem que entrar na Vercel ANTES do deploy** que exigir o slug nas
rotas públicas. Motivo: o bot em produção ainda chama `/dias-disponiveis`,
`/horarios-disponiveis` e `POST /agendamentos` **sem slug nenhum**. Com o slug
obrigatório e o bot ativo, ele passa a receber 400 em toda consulta de agenda.

Em standby ele não chama nada disso — mas só entra em standby quando a variável
existir.

### Variáveis a configurar na Vercel (são suas)

| Variável | Onde | Efeito |
|---|---|---|
| `BOT_STANDBY=1` | bot | silencia o bot. **Entra primeiro.** |
| `DATABASE_URL_APP` | calendário | conexão `app_api`, sem bypass de RLS |
| `SUPABASE_JWKS_URL` | calendário | **liga o modo JWT.** Sem ela, tudo segue no modo legado |
| `VITE_SUPABASE_URL` | painel | `https://bbcuudayemhjanklfgtr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | painel | chave publicável |
| ~~`VITE_ADMIN_API_TOKEN`~~ | painel | **APAGAR.** Só sai do bundle quando a variável some do build |
| ~~`VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD`~~ | painel | **APAGAR.** Não são mais lidos |

O JWKS não é segredo e já é conhecido:
`https://bbcuudayemhjanklfgtr.supabase.co/auth/v1/.well-known/jwks.json`

### Antes disso, no painel do Supabase

1. Authentication → Providers → Email: habilitar (e decidir sobre confirmação de
   e-mail, que exige SMTP próprio).
2. Criar o usuário do dono, e me passar o e-mail — falta ligar em
   `barbearias.user_id`, hoje `null` nas duas lojas.
3. `alter role app_api password '<senha forte>';` — a senha alimenta o `DATABASE_URL_APP`.

### Depois de subir, conferir no ar

- O log da subida diz `"modo":"jwt"` e não `"modo":"legado"`.
- Login do painel com e-mail e senha funciona; o `ADMIN_API_TOKEN` antigo é recusado.
- `GET /api/servicos` **não** devolve mais o serviço "SÓ DA LOJA B" — é o
  discriminador que prova o isolamento em produção.
- Mensagem real no WhatsApp: o bot não responde, mas a conversa aparece no painel.

### A armadilha para o dia em que o bot voltar

Tirar `BOT_STANDBY` sem antes fazer a Fase 6 (bot resolvendo a barbearia pelo
`phone_number_id`) devolve o bot ao ar **sem saber mandar o slug** — e ele tomará 400
em toda consulta de agenda. O bot volta junto com a Fase 6, não antes.

### O que continua em aberto

- **Não há autenticação real.** O login do painel é decorativo e o
  `ADMIN_API_TOKEN` viaja no bundle — a própria CLI da Vercel exigiu marcá-lo como
  público para aceitar. Riscos 1 e 2 de `AUDITORIA/04-RISCOS.md`. É a Fase 3.
- **A API do calendário não tem um único teste** — 2.501 linhas, e é onde moram os
  três dos quatro bugs de 01/09.
- **Rotacionar antes de produção:** senha do banco, os três tokens de integração e
  a senha do painel (hoje `123`) apareceram no chat, por decisão consciente de
  ambiente de teste.
- O ponytail de `src/db/eventos.ts` **venceu**: a chamada HTTP ao calendário
  acontece dentro da transação, e a API deixou de estar em localhost.
- **O site de agendamento existe fora deste repositório** e será adaptado a este
  modelo no futuro — não é código a escrever do zero.

## Onde estamos (2026-08-04)

**O agendamento fecha ponta a ponta pelo WhatsApp**, validado no celular de
verdade: `oi` → menu → barbeiro → dia → horário → nome → cartão → Confirmar →
linha em `agendamentos`, com o nome caindo em `dados_cliente` (escrita única,
vista disparar de verdade). O dono responde pelo painel e o bot cala enquanto
ele atende. Decisões e bugs dessa etapa estão travados em
`REGRAS-APRENDIZADOS/REGRAS.md` (entradas de 2026-08-01) — não repetir aqui.

O pool de conexão aquecido na subida (bot e API do calendário —
`BARBEARIA/src/index.ts`, `src/calendario/http.ts`, `src/db/cliente.ts`,
`CALENDARIO/server.js`) consertou uma latência que chegou a 8,7s contra o banco
real (detalhe em `ANEXO_BANCO/README.md`).

**O dashboard saiu do protótipo e está dentro do app**, em
`CALENDARIO/components/dashboard/`, lendo dado real de `GET /dashboard/resumo`
(não mock). Testado no PC e no celular real (LAN), conferido contra o banco.

A pasta `Dashboard/` (protótipo antigo) foi **apagada** em 2026-08-04 — todo o
código útil já tinha migrado para `CALENDARIO/`, confirmado por grep (nenhum
import apontava pra lá).

**O PWA está montado** (2026-08-04). A estrutura já vinha inteira do
`Aplicativo-FULL` e nunca tinha sido tocada — o trabalho foi tirar o que estava
velho: ícone da tesoura gerado por `npm run icones`, `maskable` com arquivo
próprio, `apple-touch-icon` 180 opaco, `lang: pt-BR`, cor de tema igualada ao
fundo do app e bloco `preview` alcançável na LAN. Decisões em `REGRAS.md`
(2026-08-04). O HTTPS que faltava **chegou com o deploy de 01/09**, então o PWA é
instalável de verdade agora — ainda não conferido no aparelho.

**Três levas de ajuste visual no mobile** rodaram a partir de prints reais do
usuário — ele manda print, eu ajusto, ele confere de novo, é assim que essa
frente avança.

**Lapidação do dock/Naviba, feita nesta sessão:** vidro translúcido de verdade
(alfa e blur baixaram juntos — blur forte deixava opaco mesmo com pouco alfa),
ícone da aba Conversas trocado para `MessageCircleMore`, pílula ativa deslizando
por `layoutId` (framer-motion) em vez de trocar de lugar, ícones brancos sem
bolha roxa nem ponto embaixo, FAB de tesoura reposicionado no canto do card do
dia (que esticou verticalmente, dock passou a flutuar levemente por cima da
borda dele) e diminuído de tamanho. Decisões em `REGRAS.md` (2026-08-04).
**A última rodada (alfa 0.08/blur 14px, ícones mais brancos, FAB mais alto e
menor) ainda não foi reconferida no celular** — primeira coisa a olhar.

**Rodada Liquid Glass no dock (2026-08-04), também não reconferida no
celular.** O dono trouxe `github.com/callstack/liquid-glass` pra melhorar o
vidro; avaliado e **rejeitado** (React Native só-iOS, sem nada extraível —
veredito completo em `docs/skills-log.md`). O que ficou foi o que a avaliação
ensinou, aplicado à mão em `10-mobile.css` + `MobileBottomNav.tsx`: anel
especular direcional na borda do dock (substituiu o `border` chapado),
`brightness(1.08)` no `backdrop-filter` (vidro devolve luz, não só desfoca), e
a animação do toque redesenhada — os botões agora **incham** no toque em vez
de encolher (`scale(.9)` era idioma Android), com um clarão radial que acende
rápido e apaga devagar, e a pílula ativa viaja entre abas com mola e
**deforma** (estica no eixo do movimento, achata no outro, desincha ao
chegar) em vez de deslizar rígida. Decisões e a armadilha de dividir a pílula
em casca+pele (pra deformação líquida não brigar com o `layoutId`) estão
travadas no `REGRAS.md` (2026-08-04). **Teto conhecido:** refração de verdade
precisa de `feDisplacementMap` via `backdrop-filter: url()`, que o WebKit não
suporta — não vale gastar rodada tentando de novo, o caminho é sempre a
aproximação (especular + toque).

## Painel de Conversas — lapidação em andamento (2026-08-04), não terminada

O header do painel mobile (`Sidebar.tsx`, `mobilePanel === "conversations"`) foi
refeito parecido com o do WhatsApp: os "..." (`MoreHorizontal`) numa linha
sozinha à esquerda, acima da seta+"Conversas" (que virou uma linha só, seta
primeiro, título ao lado, fonte maior). O rótulo antigo ("Conversas" com ícone
verde) saiu, e no lugar do aviso de lista vazia entrou uma linha de exemplo
("Maria Silva (exemplo)") com o mesmo visual de uma conversa real, só pra ver o
desenho antes de ter dado de verdade.

**De quebra, achado e corrigido:** o dock estava com `z-index` menor que o
painel de Conversas (`40` contra `50`) — a parte de cima da pílula ficava
escondida atrás do painel sempre que os dois se sobrepunham. Subiu pra `100`,
maior que qualquer overlay do app hoje. Duas armadilhas registradas em
`REGRAS.md`: `.mb-dock` tem `z-index` definido em dois arquivos CSS (só o de
`20-modal.css` vale, por vir depois na cascata), e o respiro inferior do card
do dia (`pb-16` em `App.tsx`) precisa seguir igual ao do painel de Conversas
(`bottom-16` em `Sidebar.tsx`) — divergir os dois é o mesmo defeito de novo.

**Os "..." ainda são placeholder.** Função combinada: igual ao WhatsApp,
selecionar conversas ou marcar tudo como lido — **não construída ainda**, só o
botão e um modal vazio pra ver a interação. Falta decidir o desenho de verdade
desse menu e seguir lapidando o resto da tela de conversa (o `WhatsAppPanel`
que abre ao tocar numa conversa não entrou nesta rodada).

**Nesta mesma sessão, a linha da lista de conversas cresceu** (pedido do dono:
"aproveitar mais o espaço" do placeholder) — avatar 40→52px, nome 13→16px,
prévia 12→14px, botão "..." 36→48px. Vale só pro painel mobile
(`mobilePanel === "conversations"` em `Sidebar.tsx`); a sidebar do desktop
segue com os tamanhos antigos, de propósito, porque a coluna lá é estreita.
**Também não reconferido no celular ainda.**

## Menu lateral (Hamburger) — clonado do Figma nesta sessão (2026-08-04), não visto no celular

`HamburgerPanel.tsx` (o menu que desliza da esquerda no mobile, `md:hidden`,
diferente do painel de Conversas acima) levou duas rodadas:

1. **Botão "Criar agendamento"** deixou de ser um retângulo roxo chapado e
   virou um clone do botão de vidro que o dono trouxe do Figma
   (`Liquid Glass Button — Amber Glow`, nó `1:13`, comunidade). Anatomia de
   quatro camadas copiada do arquivo (medidas reais via `get_design_context`,
   não estimativa): casca externa translúcida com brilho interno, pílula preta
   com gradiente e sombra interna, dois brilhos elípticos borrados (um fino em
   cima, um largo e fraco embaixo) e texto duplicado com cópia borrada atrás
   fazendo halo. Reduzido a ~metade da escala do arquivo (peça de botão de
   menu, não banner) mas mantendo os cantos concêntricos (raio da casca menos
   o respiro até a pílula = raio da pílula). Toque incha e acende, mesma
   linguagem travada no dock.
2. **"Dia" selecionado virou branco sólido**, não mais roxo — pedido do dono
   ("muita firula", quer o painel mais minimalista). Junto veio uma passada de
   tipografia/espaço no painel inteiro (estava "pequenininho"): header "Menu"
   14→19px, itens de visualização e lista de profissionais 14→15px, ícones e
   checkbox maiores, largura do painel de `w-72` fixo pra `82%`/teto 320px.

Decisões completas em `REGRAS-APRENDIZADOS/REGRAS.md` e o veredito do repo
`callstack/liquid-glass` (rejeitado, RN/iOS-only) em `docs/skills-log.md`
(ambos 2026-08-04). **Nada disso foi visto no celular ainda** — junto com o
dock e a lista de conversas, são três rodadas empilhadas esperando print.

## Lapidação do app mobile (2026-08-04) — plano das cinco frentes executado, nada reconferido no aparelho ainda

Duas rodadas foram aplicadas e **não reconferidas no aparelho** (o dono validou por print no
navegador; o login impede o agente de printar sozinho — ver "Como verificar" no plano).

**Rodada 1 (pedido direto do dono):** gaveta 10% mais estreita (`w-[74%] max-w-[288px]`); "Menu"
19→24px; a gaveta passa a **fechar ao trocar de aba** no dock; dock mais compacto
(`justify-content: center` — era o `space-around` quem espalhava os três botões); Conversas com
campo de busca funcional, filete entre contatos e segundo placeholder.

**Rodada 2 (a partir do `$impeccable critique`, nota 21/36):** FAB sem barra de rolagem e sem a
sombra funda; pílulas Manhã/Tarde/Noite e mês ativo saíram do roxo para o vidro do dock; cabeçalho
do Dashboard realinhado (estava a 32px enquanto todo o resto está a 16px) e a linha "atualizado há
Ns" + o pulso verde saíram do celular; varredura de tipos (17 tamanhos distintos → escala de
Conversas), com o nome do cliente subindo de 14 para 16px; `EventModal` sem os contornos roxos e
acima do dock; login com proporção corrigida; dois cards de exemplo na coluna da Noite;
`NeonCheckbox` na gaveta.

**As cinco frentes do [`ANEXO-PLANO-LAPIDACAO.md`](ANEXO-PLANO-LAPIDACAO.md) foram executadas
nesta mesma sessão**, com as decisões em aberto do plano resolvidas em conversa antes de codar
cada uma (registradas em `REGRAS-APRENDIZADOS/REGRAS.md`, entrada de 2026-08-04 "As cinco frentes
do ANEXO-PLANO-LAPIDACAO foram executadas nesta sessão"):

- **Frente 3** — menu dos "..." de Conversas virou popover ancorado no botão (não mais card
  centralizado), "Marcar tudo como lido" ligado de verdade.
- **Frente 4** — Serviço saiu de tela (oculto atrás de `SERVICO_HABILITADO`, sem perder dado de
  agendamento antigo), Telefone e Descrição viraram campos próprios, Início passou a vir da agenda
  real (`getAvailableSlots`) e Término virou texto calculado. Os três dropdowns que escapavam do
  card (Profissional/Data/Início) viraram `BottomSheet`, o que permitiu rodapé fixo
  (Cancelar/Salvar sempre alcançáveis) com o miolo rolando por dentro.
- **Frente 1** — cards do dia viraram chips de ~48px fechados (o vidro do botão da gaveta foi
  extraído pra `components/ui/vidro.ts` antes disso, e o chip herda o material). Acordeão
  exclusivo, "Marcar como Feito" virou botão de vidro discreto, editar é o lápis dentro do estado
  aberto.
- **Frente 2** — relógio "O dia" **ficou no Dashboard** (decisão do dono). Três defeitos
  corrigidos: costura visível na emenda do ciclo (fim do dia encostando no começo), rótulos de
  abertura/fechamento sempre presentes (não mais `h % 3`), ponteiro esmaecido em vez de sumir fora
  do expediente.

Verificado por `tsc --noEmit`, o detector do `impeccable` e compilação de cada módulo via dev
server — **nada disso substitui o dono olhar no celular**, que é a próxima etapa. O backlog da
crítica `$impeccable` (7 itens, fim do anexo) segue **não pedido**, não foi tocado.

⚠️ **Armadilha registrada no plano (4.1), ler antes de mexer no `EventModal`:** `description` é
**uma coluna de texto só**. Telefone, Serviço e Anotação são linhas prefixadas dentro dela
(`composeDescription()` escreve, regex lê). O bot depende desse formato — separar em colunas de
verdade é migração, não refactor de tela.

**Próximo passo:** o dono confere as cinco frentes no celular (mais as duas rodadas anteriores da
lapidação mobile, que também seguem sem reconferência) e traz ajuste por rodada de print, como de
costume. Quando as cinco frentes estiverem validadas, o `ANEXO-PLANO-LAPIDACAO.md` pode ser
esvaziado/removido — o que sobrar de aprendizado já está em `REGRAS-APRENDIZADOS/REGRAS.md`, e o
backlog não pedido no fim do anexo é o único conteúdo que ainda precisa de um lugar (ficar no
anexo, ou migrar, é decisão de quando isso for revisitado).

**Esse próximo passo é da frente de lapidação, e ela não é mais a única fila.** Desde
28/08 concorre com o deploy quebrado (seção no topo), que é a fila mais urgente — a
lapidação melhora o que o dono vê no celular, o deploy é o que decide se existe
alguma coisa no ar pra ver. Ordem é decisão dele.

## Ambiente de desenvolvimento

⚠️ **A máquina mudou (constatado em 2026-08-28).** O projeto está agora numa máquina
**Linux** (`~/Desktop/projetos/barbearia.wpp`); a tabela abaixo e o `ngrok.cmd` são do
Windows de antes. Nesta máquina, em 28/08, **não havia `node_modules` nem `.env` em
nenhuma das duas pastas** — as dependências foram instaladas nesta sessão (`npm
install` nas duas), mas **os dois `.env` continuam faltando**, e sem eles não se roda
o bot, nem a API, nem `npm run db`. Recriar a partir dos `.env.example` é passo do
dono (arquivo de segredo é dele).

Três processos + um túnel, todos em **background** — nunca no terminal do
usuário (processo iniciado lá morre quando ele fecha a janela).

| O quê | Onde | Comando | Porta |
|---|---|---|---|
| Bot (Hono) | `BARBEARIA/` | `npm run dev` | 3333 |
| API do calendário (Fastify) | `CALENDARIO/` | `npm run server` | 3334 |
| Painel do dono (React/Vite) | `CALENDARIO/` | `npm run dev` | 3002 |

Túnel aponta só para o bot, que é o único que recebe da Meta: `ngrok.cmd http
3333` em background. URL pública em `http://127.0.0.1:4040/api/tunnels` —
**muda a cada sessão**, recolar em Webhooks → Conta comercial do WhatsApp
(`<url>/webhook/whatsapp`). Conferir depois de subir: `3333/saude` → 200,
`3334/` → 200, `3002/` → 200 (raiz da 3333 dá 404, e isso é o certo).

**Reset do estado de teste** (número `553384246770`), de dentro de
`BARBEARIA/`, nesta ordem — FKs exigem mensagem → conversa → contato:

```bash
npm run db -- "delete from agendamentos where telefone = '553384246770'" -- --gravar
npm run db -- "delete from webhook_eventos where de = '553384246770'" -- --gravar
npm run db -- "delete from whatsapp_messages where conversation_id in (select c.id from whatsapp_conversations c join whatsapp_contacts ct on ct.id = c.contact_id where ct.phone = '553384246770')" -- --gravar
npm run db -- "delete from whatsapp_conversations where contact_id in (select id from whatsapp_contacts where phone = '553384246770')" -- --gravar
npm run db -- "delete from whatsapp_contacts where phone = '553384246770'" -- --gravar
```

`dados_cliente` fica de fora (é cadastro); para repetir só o teste da escrita
do nome, zerar apenas o campo:

```bash
npm run db -- "update dados_cliente set nome = null where telefone = '553384246770'" -- --gravar
```

Conferir sempre com `select count(*)` nas cinco depois de rodar — não
anunciar "zerado" sem olhar (aconteceu errado duas vezes, ver
`REGRAS-APRENDIZADOS/APRENDIZADOS.md`, 2026-08-01).

## Pendências em aberto

- **Etapa do nome — casos ainda não exercitados no celular:** nome picado
  (primeiro nome numa mensagem, sobrenome na seguinte, deve fechar sozinho sem
  toque); correção (`Vicctor` → `Victor`, deve reimprimir o cartão, não
  agendar); lixo (`ok`, `123`, deve recusar com o motivo). Conferir
  `dados_cliente.nome` depois de qualquer fechamento.
- **Pular a pergunta do nome para cliente já cadastrado** — decidido em
  2026-07-31, não implementado. O insumo já existe (`contexto.nome` vem de
  `registrarContato()`); falta o roteador usar, em `escolherHora()` de
  `src/fluxo/rotear.ts` (`ponytail:` marcado no ponto exato).
- **Correção de nome de cliente cadastrado** — vai no painel do dono, não no
  menu do WhatsApp (decisão travada, ver `REGRAS.md` 2026-07-31). Não existe
  em lugar nenhum ainda.
- **O telefone vai deixar de ser a chave** — nomes de usuário do WhatsApp já
  são obrigatórios em produção desde abril/2026. Gatilho: antes do deploy.
  Levantamento completo em `ANEXO_WHATSAPP_META/NOMES_DE_USUARIO.md`.
- **Cutucão por inatividade** — ideia do usuário (2026-07-30), não existe
  ainda. Precisa de outbox + Vercel Cron. Combinado: aperfeiçoar mais pra
  frente.
- **Teto de 2 barbeiros do plano** não está travado em código — hoje é regra
  comercial; o lugar dela é a futura tabela de barbearias/plano.
- **Hospedagem definitiva** — painel, PWA e API no ar (2026-08-05).
  `github.com/V-Santtos/barbearia.wpp` (branch `main`) → `barbearia-wpp.vercel.app`.
  **Reconferido em 2026-08-28 e o que está no ar não serve** — dois defeitos, na
  seção "O deploy está quebrado" acima. A frase antiga daqui (`/api/profissionais` e
  `/api/agendamentos` respondendo 200 com dado real) não se sustenta: hoje a primeira
  dá 500 e a segunda dá 401, que é o comportamento **certo** dela (é protegida por
  `ADMIN_API_TOKEN`) — ou seja, ela nunca foi prova de banco no ar.
  As três variáveis estão gravadas; o que quebrava era **caractere invisível no valor**
  e o **host direto do Supabase ser IPv6 puro** — os dois registrados em
  `REGRAS-APRENDIZADOS/ANEXO_DEPLOY.md` e `ANEXO_BANCO/README.md`. Ler os dois antes de
  mexer em variável de ambiente ou de subir a próxima peça.
  **Duas coisas em aberto, decisão do dono:** (a) o `DATABASE_URL` ficou gravado como
  `--no-sensitive`, ou seja, legível pelo painel/CLI — foi assim que o defeito apareceu;
  voltar pra sensitive fecha a porta mas cega o próximo diagnóstico. (b) a senha do banco
  vazou numa linha de saída durante o diagnóstico desta sessão — se a conversa for parar
  em lugar compartilhado, trocar a senha no Supabase.
  **O bot ainda não subiu** (segue em ngrok) — e quando subir precisa do pooler, não do
  host direto do `.env` local. A entrada do painel passa direto quando o build não tem
  credencial, porque `VITE_*` viaja no bundle e nunca foi barreira — fechar isso de
  verdade é etapa combinada, não esquecimento.
- **Trocar o token de envio antes da produção** — ver `ANEXO_WHATSAPP_META/`.
- **Coexistência** — parada por decisão, caminho em aberto. Ver
  `ANEXO_WHATSAPP_META/COEXISTENCIA.md`.
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
