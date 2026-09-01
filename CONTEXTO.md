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
limpar depois. 2 barbeiros com agendas **diferentes** de propósito, 4 serviços, 1
bloqueio parcial, 8 agendamentos.

Foi ele que tornou o bug de fuso visível — com o banco vazio não havia horário
para faltar.

**O que ele NÃO faz:** reproduzir as patologias do banco real (telefone em formato
antigo, agendamento órfão de profissional, cliente duplicado). Seed limpo só testa
o caso feliz. É o próximo passo natural.

### O que continua em aberto

- **Não há autenticação real.** O login do painel é decorativo e o
  `ADMIN_API_TOKEN` viaja no bundle — a própria CLI da Vercel exigiu marcá-lo como
  público para aceitar. Riscos 1 e 2 de `AUDITORIA/04-RISCOS.md`, intocados. Agora
  que o banco tem dado, a porta está de fato aberta.
- **A API do calendário não tem um único teste** — 2.501 linhas, e é onde moram os
  três dos quatro bugs de hoje.
- **Rotacionar antes de produção:** senha do banco, os três tokens de integração e
  a senha do painel (hoje `123`) apareceram no chat, por decisão consciente de
  ambiente de teste.
- O ponytail de `src/db/eventos.ts` **venceu**: a chamada HTTP ao calendário
  acontece dentro da transação, e a API deixou de estar em localhost.

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
