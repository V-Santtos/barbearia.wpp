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

Os dois falam com o **mesmo banco**: Supabase `sppexvjvnoganlduyjvs`. Acesso e
armadilhas em `REGRAS-APRENDIZADOS/ANEXO_BANCO/`.

## Onde estamos (2026-09-08) — casca de seções no desktop, com o banco fora

### O bloqueio: o projeto Supabase sumiu

`sppexvjvnoganlduyjvs` não responde mais. Verificado nesta sessão, e o quadro é
maior que o que o `ANEXO_BANCO` registrava:

- `db.<ref>.supabase.co` **e** `<ref>.supabase.co` dão **NXDOMAIN**, no resolver
  local e no do Google. Não é cache nem IPv6: o nome não existe. (O anexo diz que
  em 05/08 o host direto era IPv6 puro — tinha AAAA. Hoje não tem A nem AAAA.)
- O pooler de `us-west-2` responde `tenant/user postgres.<ref> not found` nas
  duas portas, 6543 e 5432.
- **Produção está igual:** `barbearia-wpp.vercel.app/api/profissionais` → 500.

Os três juntos são a assinatura de **projeto pausado por inatividade** (free tier
retira o DNS junto). O último trabalho no repo é de 05/08, mais de um mês antes.
**Despausar é no painel do Supabase, com o login do dono** — daqui não se alcança.

### O mundo de teste (é isso que está na tela hoje)

`VITE_MOCK=1` no `CALENDARIO/.env` popula o painel **inteiro** sem tocar na API.
A costura é **uma só**, no transporte (`api()` de `services/calendarApi.ts`), não
nas telas: toda função pública roda inteira — `toEvent`, `toProf`, filtros,
`catch` — sobre um corpo com o mesmo formato do Fastify. Nenhum componente tem
`if (mock)`.

| | |
|---|---|
| Onde | `CALENDARIO/services/mock/` — `mundo.ts`, `resumo.ts`, `rotas.ts` |
| Profissionais | 3, com expedientes **diferentes** de propósito (Bruno é meio-período e não trabalha segunda — é onde disponibilidade e relógio quebram) |
| Agendamentos | ~1.127, de 35 dias atrás a 21 à frente; 13 a 30 por dia |
| Conversas | 8, com os quatro estados (`bot`, `human`, `open`, `closed`) |
| Escrita | funciona (criar/editar/apagar), em memória; **F5 volta à linha de base** |

Duas propriedades pedidas pelo dono e como cada uma é obtida: **atemporal** (tudo
nasce de `new Date()`, nada cravado) e **estável ao recarregar** (sem
`Math.random()`; o sorteio tem semente fixa, então F5 reconstrói o mesmo mundo).

O `dashboard/resumo` é **calculado do mesmo mundo** que o calendário desenha —
conferido: 13 agendamentos hoje nas duas telas. Número que discorda entre elas é
o defeito que o `DashboardScreen` foi escrito para evitar.

Desligar é zerar a flag no `.env`; o Vite reinicia sozinho.

### A casca de seções (o que está sendo lapidado AGORA)

Spec da parte 1 em
[`docs/superpowers/specs/2026-09-08-casca-de-secoes-rail-e-gaveta-design.md`](docs/superpowers/specs/2026-09-08-casca-de-secoes-rail-e-gaveta-design.md).
Decisão travada: **o rail troca de seção**, não abre camadas. Agenda, Conversas,
Dashboard e Financeiro viram lugares irmãos.

Construído em `CALENDARIO/components/shell/`:

| Arquivo | O quê |
|---|---|
| `secoes.ts` | o registro (a coluna não conhece seção por nome; itera esta lista) |
| `ColunaDeSecoes.tsx` | a coluna da esquerda, que recolhe (56px) e expande (240px) |
| `GavetaDeSecao.tsx` | a moldura de 288px que desliza com o contexto da seção |
| `SecaoVazia.tsx` | o lugar honesto de uma seção ainda não migrada |

**Funciona:** recolher/expandir pela linha da marca; trocar de seção; clicar na
seção ativa alterna a gaveta; a agenda fica **montada e escondida** ao sair, então
volta com a mesma data, visualização e rolagem.

**O `+ Criar` pertence à coluna da esquerda**, não à gaveta — é a ação primária do
produto, não acessório do calendário. É **um** botão em **um** lugar, que vira só
"+" quando a coluna recolhe. Ele já mudou de casa duas vezes nesta sessão
(`Sidebar` → gaveta → coluna); se aparecer em dois lugares de novo, é regressão.

**Ainda é placeholder:** Conversas, Dashboard e Financeiro caem no `SecaoVazia`.
O `DashboardScreen` **continua sendo o modal do menu do avatar**, intocado — a
desmodalização é parte seguinte.

### Nada commitado

Tudo desta sessão está só no disco: o mundo de teste, a casca, a spec, e as
edições em `App.tsx`, `Sidebar.tsx`, `calendarApi.ts`, `vite-env.d.ts` e `.env`.
`tsc --noEmit` limpo.

### Como conferir (o dono precisa entrar à mão)

O login vive em memória quando "Lembrar-me" está desmarcado, então **recarregar
desloga** — e o agente não faz login (não preenche campo de senha). Depois de
qualquer reinício do Vite, é o dono quem entra.

## Onde estivemos (2026-08-04) — lapidação mobile, ainda sem reconferência no aparelho

**O agendamento fecha ponta a ponta pelo WhatsApp**, validado no celular de
verdade: `oi` → menu → barbeiro → dia → horário → nome → cartão → Confirmar →
linha em `agendamentos`, com o nome caindo em `dados_cliente` (escrita única,
vista disparar de verdade). O dono responde pelo painel e o bot cala enquanto
ele atende. Decisões e bugs dessa etapa estão travados em
`REGRAS-APRENDIZADOS/REGRAS.md` (entradas de 2026-08-01) — não repetir aqui.

**Ainda não commitado:** o pool de conexão aquecido na subida (bot e API do
calendário — `BARBEARIA/src/index.ts`, `src/calendario/http.ts`,
`src/db/cliente.ts`, `CALENDARIO/server.js`), conserto de uma latência que
chegou a 8,7s contra o banco real (detalhe em `ANEXO_BANCO/README.md`).

**O dashboard saiu do protótipo e está dentro do app**, em
`CALENDARIO/components/dashboard/`, lendo dado real de `GET /dashboard/resumo`
(não mock). Testado no PC e no celular real (LAN), conferido contra o banco.
**Ainda não commitado.**

A pasta `Dashboard/` (protótipo antigo) foi **apagada** em 2026-08-04 — todo o
código útil já tinha migrado para `CALENDARIO/`, confirmado por grep (nenhum
import apontava pra lá).

**O PWA está montado** (2026-08-04). A estrutura já vinha inteira do
`Aplicativo-FULL` e nunca tinha sido tocada — o trabalho foi tirar o que estava
velho: ícone da tesoura gerado por `npm run icones`, `maskable` com arquivo
próprio, `apple-touch-icon` 180 opaco, `lang: pt-BR`, cor de tema igualada ao
fundo do app e bloco `preview` alcançável na LAN. Decisões em `REGRAS.md`
(2026-08-04). **Falta só HTTPS**, que não se resolve em código — vem com o
deploy; hoje o iPhone instala pela "Tela de Início" e o Android não.

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

## Ambiente de desenvolvimento

Três processos + um túnel, todos em **background** — nunca no terminal do
usuário (processo iniciado lá morre quando ele fecha a janela).

**Com `VITE_MOCK=1` (o estado de hoje), o front não precisa de nada disso.** A
API do calendário pode até subir, mas vai responder 500 em tudo enquanto o banco
estiver pausado; o painel na 3002 se vira sozinho com o mundo de teste. O bot e o
túnel só importam quando o WhatsApp voltar a ser exercitado.

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

- **Despausar o Supabase** — bloqueia tudo que é dado real (painel, deploy, bot).
  Só o dono consegue, no painel do Supabase. Enquanto isso o `VITE_MOCK` segura o
  trabalho visual.
- **Relógio "O dia": os rótulos "abre" e "fecha" estão empilhados.** Medido no
  DOM: "abre" em x 1134→1157, "fecha" em x 1123→1152, mesma altura. É estrutural,
  não é do mock — o arco dá uma volta de `janelaDia.ini` a `janelaDia.fim`, então
  abertura e fechamento caem no mesmo ângulo, no topo. Provavelmente nasceu junto
  com a Frente 2 (deixar os dois rótulos sempre presentes). Não consertado.
- **Ordem vertical dos ícones na coluna** — nasce igual à do dock, com Financeiro
  no fim. Única pergunta que a spec da casca deixou em aberto; a resposta depende
  de o dono sentir qual seção ele mais alcança, o que só dá depois que as quatro
  existirem.
- **A gaveta precisa de um lugar definitivo.** Hoje ela é a segunda coluna, com o
  contexto da Agenda. Quando Conversas e Financeiro tiverem painel próprio, é
  preciso decidir se cada seção traz o seu ali ou se o desenho muda.
- **Divergência de ícone assumida, com fim marcado:** a coluna do desktop usa
  `Gauge` no Dashboard; o dock do celular segue com `BarChart2` até a parte que
  mexer nele (a da quarta aba). Agenda e Conversas já são iguais nos dois.
- **Segredos que vazaram na conversa desta sessão** (transcrição, não repositório):
  `BOT_PAINEL_TOKEN`, `VITE_ADMIN_API_TOKEN`, `VITE_OWNER_PASSWORD` e o e-mail do
  dono. Os `VITE_*` nunca foram barreira (viajam no bundle, já registrado), mas se
  a conversa for parar em lugar compartilhado, trocar os quatro — junto com a senha
  do banco, que já estava nesta lista desde 05/08.

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
- **Hospedagem definitiva** — painel, PWA e API **no ar e lendo o banco de verdade**
  (2026-08-05). `github.com/V-Santtos/barbearia.wpp` (branch `main`) →
  `barbearia-wpp.vercel.app`. Conferido no ar: `/api/profissionais` e
  `/api/agendamentos` respondendo 200 com dado real do Supabase.
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
