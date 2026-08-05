# ANEXO — Plano de lapidação (3 frentes)

> **O que é este arquivo.** O plano das três frentes que o dono pediu em **2026-08-04**, escrito
> para ser executado numa sessão futura. **Nada aqui foi executado.** É proposta com números,
> caminhos de arquivo e decisão em aberto marcada — não é registro do que já existe.
>
> **O que NÃO é.** Não é regra durável (isso mora em `REGRAS-APRENDIZADOS/`) nem estado vivo
> (isso é `CONTEXTO.md`). Quando uma frente daqui for executada, ela sai deste arquivo e o que
> sobrar de aprendizado vai para `REGRAS-APRENDIZADOS/`.
>
> **Superfície:** o app mobile do painel do dono (`CALENDARIO/`), viewport ~390×844.

---

## 0. Onde a lapidação parou (contexto para não refazer)

Duas rodadas já foram ao ar em 2026-08-04, e as decisões abaixo estão **fechadas** — não reabrir
sem o dono pedir:

- **Conversas é o padrão da casa.** O dono validou a tela. A escala dela é a régua de todo o
  resto: título **22px**, nome de linha **16px**, controle **15px**, corpo **14px**, metadado
  **12px**, eyebrow **11px** caixa-alta. Onde outra tela discordar, Conversas ganha.
- **O roxo está saindo, um estado de cada vez.** Já saíram: aba ativa do dock, Dia/Semana/Mês da
  gaveta, pílulas Manhã/Tarde/Noite, mês ativo do `MonthPillsStrip`, os 8 contornos de campo do
  `EventModal`. O idioma que substitui é o **vidro cinza do dock** —
  `bg-white/[0.12]` + `border-white/[0.18]` + `inset 0 1px 0 rgba(255,255,255,0.14)`, valores
  literais de `.mb-dock__highlight-skin` (`10-mobile.css`).
- **Elevação em tema escuro é superfície mais clara + fio branco de 1px no topo**, nunca sombra
  preta borrada. Foi assim que a "sombra funda" do FAB foi resolvida.
- **Piso de alvo de toque: 44×44.** Já aplicado em chips, filtro de profissional, pílulas de
  período, "Marcar como Feito", botões do `EventModal` e abas do login.
- **Placeholder só aparece onde não há dado real**, com "(exemplo)" no nome e `id` negativo, e
  **não entra em contagem**. Vale para Conversas e para os cards da Noite.

---

## FRENTE 1 — Os cards do dia viram chips expansíveis

**Arquivo:** `CALENDARIO/components/DayKanban.tsx` (função `renderCard`).
**Referência de mecanismo:** os prints 2 e 3 que o dono mandou (cabeçalho de coluna fechado ↔
aberto). **Referência cromática:** o botão "+ Criar agendamento" da gaveta.

### O problema, medido

Card de hoje: `p-3` (12+12) + nome 16px + horário 14px + `mb-2` + serviço 14px + `mb-2` +
botão 40px + `mt-1` ≈ **~140px**, mais `space-y-2` de 8px. **Três agendamentos = ~445px** numa
coluna que tem ~430px úteis. Ou seja: **o terceiro card já não cabe.** Uma barbearia com 12 cortes
no dia é uma coluna de rolagem infinita de peças gigantes.

E o problema de cor: a identidade do barbeiro entra como **fundo tingido** (`${profColor}18`) +
borda esquerda de 3px + sombra colorida. Com dois barbeiros a coluna fica verde e laranja
brigando entre si — e com o roxo do "Marcar como Feito" logo abaixo. Três cores saturadas
disputando a mesma peça.

### Anatomia proposta

**Fechado (estado padrão, ~48px):**

| Zona | Conteúdo |
|---|---|
| Esquerda | Fio vertical de 3px na cor do barbeiro — **a cor vira sinal, não fundo** |
| Chevron | `>` fechado / `v` aberto, `text-white/40` |
| Miolo | **Nome do cliente**, 16px semibold, `truncate` |
| Direita | **Horário de início**, 14px `tabular-nums`, `text-white/50` |

**Aberto (o mesmo chip cresce, sem trocar de peça):** revela serviço, nome do barbeiro, horário
completo (`19:00 → 19:40`), a tag `presencial` quando for o caso, e o botão **Marcar como Feito**.

**Ganho:** 3 chips fechados = **~144px** contra os ~445px de hoje. Cabem 8 na tela sem rolar.

### Cromática — herdar o botão de vidro

O dono pediu para aproveitar o "+ Criar agendamento". Hoje essa peça vive como constantes de
módulo dentro de `HamburgerPanel.tsx` (`CASCA`, `PILULA`, `BRILHO_TOPO`, `BRILHO_BASE_INFERIOR`,
`RAMPA`, `RAMPA_CASCA`) — **anatomia de quatro camadas, documentada no topo daquele arquivo**.

**Primeiro passo obrigatório: extrair para `CALENDARIO/components/ui/vidro.ts`** e importar nos
dois lugares. Copiar os valores para o card seria a terceira cópia do mesmo material no projeto e
o começo da divergência.

No chip, a receita entra **reduzida** — o botão da gaveta tem 68px de altura e é peça única; o
chip tem 48px e aparece 8 vezes empilhado:

- Casca de vidro e a rampa `#5A5A5A → #0C0C0C`: **ficam**, é o que dá o material.
- Os **dois brilhos** (elipses borradas): **saem**. Em 48px eles viram uma faixa branca; e oito
  peças brilhando na mesma coluna é vitrine, não lista.
- A cor do barbeiro entra em **três lugares e mais nenhum**: o fio vertical de 3px, o `dot` ao
  lado do nome do barbeiro quando aberto, e o `focus-visible:ring`. Fundo tingido sai.
- **`presencial` continua se distinguindo** — hoje é fundo tingido + borda tracejada. Proposta:
  manter só a **borda esquerda tracejada** (`borderLeftStyle: dashed`), que já existe e é
  suficiente quando o fundo dos dois vira o mesmo vidro.

### "Marcar como Feito" — decisão que o redesenho força

O botão é hoje **o maior volume de roxo do app** (um por card) e some junto com o card, sem
desfazer. Dentro do chip aberto ele fica menor e menos frequente. Duas escolhas para o dono:

- **(a)** vira botão de vidro discreto com a cor do barbeiro no texto;
- **(b)** sai de dentro do card e vira **gesto de swipe** no chip fechado — que é o idioma de
  lista e resolve os 12 toques do dia cheio.

**Não decidido.**

### Detalhes de execução

- `activePeriod` / `scrollToPeriod` / o carrossel `snap-x` **não mudam** — o chip é a peça de
  dentro da coluna.
- O estado aberto/fechado é `useState<Set<number>>` no `DayKanban`, **não** por card, senão
  fechar e reabrir a coluna perde tudo.
- Abrir/fechar anima com `framer-motion` (`height: auto`), na mola do dock
  (`stiffness: 420, damping: 34, mass: 0.9`) — a lib já é dependência.
- **Um aberto por vez?** Não decidido. Acordeão exclusivo mantém a coluna curta; múltiplos abertos
  respeitam quem quer comparar dois horários.
- Os guardas de placeholder já existentes (`isPlaceholder`, `inerte`, `contarReais`) continuam
  valendo e precisam sobreviver ao redesenho.
- O clique no chip fechado hoje abre o `EventModal` (`onEventClick`). Com o chip expansível,
  **tocar passa a abrir/fechar**. Editar precisa de outra porta — o mais provável é o próprio
  botão dentro do estado aberto. **Não decidido.**

---

## FRENTE 2 — O relógio "O dia" está ambíguo

**Arquivos:** `CALENDARIO/components/dashboard/RelogioDoDia.tsx`,
`CALENDARIO/components/dashboard/modelo.ts` (`janelaDia`),
`CALENDARIO/components/dashboard/css/11-relogio.css`.

### Diagnóstico — três defeitos reais, confirmados no código

**1. A peça parece relógio e não é.** `anguloDaHora = ((t - ini) / (fim - ini)) * 360 - 90`
espalha **a janela de trabalho inteira** sobre 360°. Com a janela 8h→20h dá:

| Hora | Ângulo | Onde cai | Onde o olho espera |
|---|---|---|---|
| 8h | −90° | topo | 12h |
| 11h | 0° | direita | 3h |
| 14h | 90° | baixo | 6h |
| 17h | 180° | esquerda | 9h |

As posições estão **corretas pela regra do componente**. O problema é que a volta também dá 12
horas — só que **girada**, com a abertura no topo. O olho lê mostrador e recebe escala.

**2. Os rótulos não seguem a janela.** A regra é `rotulado = h % 3 === 2` — literalmente "horas
cujo resto por 3 é 2". Dá 8/11/14/17 **por coincidência de a barbearia abrir às 8**. Se um
barbeiro passar a abrir às 7h, `janelaDia.ini` vira 7, o topo do anel vira 7h e **o topo deixa de
ter rótulo**: o mostrador gira em silêncio e ninguém entende por quê.

**3. "agora 21:24" é uma hora que não existe no anel.** O ponteiro só desenha sob
`agora > janelaDia.ini && agora < janelaDia.fim`. Depois das 20h ele simplesmente não existe — o
cabeçalho anuncia um horário e o mostrador não tem onde marcá-lo. É o que está no print: **anel
sem ponteiro nenhum.**

### Correção proposta

O valor da peça — mostrar o **formato** do dia, não só o número — depende de a volta inteira ser a
janela de trabalho. Então **não** virar relógio de 12h de verdade; virar **escala honesta**:

- **Rótulos derivados da janela**, nunca de `h % 3`. Regra: primeira e última hora **sempre**
  rotuladas (é a abertura e o fechamento — a informação mais importante do anel), e o miolo a cada
  N horas onde `N = max(2, round(duração / 5))`, para o mostrador nunca passar de ~6 rótulos.
- **Marcar a costura.** Onde o fim do dia encosta no começo (topo) entra um **corte visível** —
  um vão de 2–3° e um traço mais forte. Hoje o anel é contínuo e sugere ciclo; ele não é ciclo, é
  uma linha enrolada, e a costura é o que impede ler 20h como se fosse 8h.
- **Estado honesto fora do expediente.** Em vez de sumir com o ponteiro: encostar o ponteiro na
  ponta correspondente, esmaecido, e o cabeçalho passar a dizer **"fechado desde 20:00"** em vez de
  "agora 21:24". A regra já existe no dado (`agora`, `janelaDia.fim`); falta a UI usá-la.
- **Rótulo de âncora.** O `8h` do topo ganha peso maior e a palavra "abre" (e o último, "fecha").
  Sem isso, ninguém descobre sozinho que o topo não é meio-dia.
- **Legenda:** quatro estados (ocupado / livre / intervalo / fora do expediente) em 11px é muita
  coisa. Depois da costura e dos rótulos novos, reavaliar se "fora do expediente" ainda precisa de
  entrada própria — ele passa a ser óbvio pela posição.

**Não decidido:** se a peça continua no Dashboard ou sobe para a Agenda. Ela responde "onde estão
os buracos do dia", que é uma pergunta boa, e hoje é **a peça mais elaborada do dashboard e a mais
abaixo da dobra** — 380px de SVG que exigem rolar até o fim para ver.

---

## FRENTE 3 — O menu dos "..." em Conversas

**Arquivo:** `CALENDARIO/components/Sidebar.tsx` (estado `showConversaPlaceholder` e o bloco
`AnimatePresence` no fim do componente).
**Referência:** o print 7 — o menu real do WhatsApp.

### O que está errado

Hoje o botão abre um **card centralizado na tela** com título e um parágrafo explicando que o menu
ainda não existe. Isso era andaime para ver a interação do botão, e virou a coisa errada: é
diálogo modal onde a referência é **menu de contexto**. Um menu não se apresenta, não tem
parágrafo, e nasce **onde o dedo tocou**.

### Anatomia correta

- **Popover ancorado no botão** — canto superior esquerdo, nascendo logo abaixo dos "...", com
  `transformOrigin` no canto de cima à esquerda. Ele **cresce a partir do botão**; é isso que diz
  ao olho de onde veio.
- **Dois itens, ícone à esquerda, sem título e sem descrição:**
  - `Selecionar conversas` — ícone de check em círculo
  - `Marcar tudo como lido` — ícone de balão com check
- Fundo escuro translúcido com `backdrop-blur`, raio grande (~26–28px, o mesmo idioma do dock),
  item de ~56px de altura, rótulo ~17px.
- **Fundo da página escurece e desfoca** — como no print 7, onde a lista atrás fica ilegível.
  Isso o placeholder atual já faz e pode ser reaproveitado.
- Fecha ao tocar fora, no `Escape`, e ao escolher um item.

### As duas ações — o que dá para ligar de verdade

- **"Marcar tudo como lido" é implementável agora.** `markWhatsAppConversationAsRead(id)` já
  existe em `services/calendarApi`; basta percorrer as conversas com `unread > 0`, zerar no estado
  local de uma vez (otimista) e disparar as chamadas. **Deve ser ligado de verdade nesta frente** —
  é a única das duas que resolve algo sozinha.
- **"Selecionar conversas" precisa de modo de seleção** (checkbox por linha, barra de ação no
  rodapé, "N selecionadas"). Isso é uma frente própria. **Enquanto não existir, o item aparece
  desabilitado** (`opacity-40`, `aria-disabled`) — nunca clicável abrindo um aviso, que é
  exatamente o erro que estamos corrigindo.

---

## FRENTE 4 — O modal "Criar Evento": campos reais e término calculado

**Arquivo:** `CALENDARIO/components/EventModal.tsx`.
**Já feito em 2026-08-04 (não refazer):** z-index acima do dock, contornos roxos dos campos
trocados por superfície + fio neutro, título 22px alinhado à esquerda, respiro 32→16px, botões de
44px, rolagem no backdrop com `my-auto`.

### 4.1 O achado que governa esta frente inteira

**`description` é UMA coluna de texto no banco.** Telefone, Serviço e Anotação não são campos —
são **linhas prefixadas dentro dela**, escritas por `composeDescription()` e lidas de volta por
regex (`PHONE_LINE_RE`, `SERVICE_LINE_RE`, `NOTES_LINE_RE`):

```
Telefone: (33) 99999-9999
Serviço: Corte + barba
Anotação: ...
```

É **por isso** que a UI agrupou os três numa caixa só chamada "Descrição": a caixa é o formato de
armazenamento vazando para a tela.

**Consequência para o plano:** separar em campos próprios é mudança **de apresentação apenas**. O
formato gravado continua o mesmo em V1 — a mesma coluna, o mesmo `composeDescription()`. O bot
escreve e lê esse texto, e mudar o esquema aqui quebraria o outro lado. Quem separa é a tela,
não o banco. Se um dia virar coluna de verdade, é migração em `BARBEARIA/db/migracoes/`, e é outra
conversa.

### 4.2 Serviço sai do V1 — oculto, nunca apagado

Serviço só existe quando houver **dashboard premium com financeiro**. Até lá:

- O campo **não renderiza** (uma constante no topo do arquivo governando, no idioma de
  "ocultar, nunca apagar" — o código fica dormente e volta ligando um valor).
- `composeDescription()` **para de emitir a linha `Serviço:`** enquanto estiver oculto.
- **`SERVICE_LINE_RE` continua parseando.** Agendamento antigo que já tem a linha gravada não pode
  perder o dado só porque a UI parou de mostrar o campo — ele continua sendo lido, e volta a
  aparecer no dia em que o campo religar.
- `getConfiguredServices()` continua existindo e sem consumidor nesta tela. Não apagar.

### 4.3 Os três viram campos próprios

| Hoje | Proposto |
|---|---|
| Caixa "Descrição" com 3 rótulos roxos por dentro | 3 campos independentes, no mesmo formato pílula dos demais |
| `Telefone:` como linha de texto | Campo **Telefone** próprio, `inputMode="tel"`, com a máscara que `formatPhoneValue()` já faz |
| `Serviço:` | **oculto** (4.2) |
| `Anotação:` | Campo **Descrição**, `textarea` de 2–3 linhas, texto livre e mais nada |

Os rótulos roxos internos (`Telefone:` / `Serviço:` / `Anotação:` em cor de marca) somem junto — é
o mesmo roxo estrutural que saiu dos contornos.

**Ordem proposta dos campos**, do mais identificador ao mais opcional:
`Nome Completo` → `Telefone` → `Profissional` → `Data` → `Início` → `Descrição`.
Telefone sobe para logo abaixo do nome porque os dois **são a pessoa**; hoje ele está enterrado no
fim, e é o campo que a validação exige (`"Complete o telefone antes de avançar."`).

### 4.4 Término deixa de ser escolha

Hoje `Início` e `Término` são dois dropdowns iguais, gerados pelo mesmo `.map()` sobre um array de
dois objetos, lado a lado num `grid-cols-2`. Os dois oferecem horário **sem olhar a agenda** — dá
para marcar em cima de um horário ocupado, e dá para escolher término antes do início.

**A peça certa já existe e não está sendo usada aqui:**

```ts
getAvailableSlots(professionalId, date) → string[]
// GET agendamentos/horarios-disponiveis?professionalId=&date=
```

Ela está em `services/calendarApi.ts` e hoje só é chamada em `App.tsx`, **e só para o dia de
hoje**. O modal nunca a chamou.

**Proposta:**

1. `Início` passa a ser alimentado por `getAvailableSlots(professionalId, date)`, refazendo a
   busca sempre que **profissional** ou **data** mudarem. Horário ocupado deixa de ser oferecido.
2. `Término` **deixa de ser controle** e vira **texto derivado**, ao lado do início:
   `término 09:40`. Não sumir com a informação — o dono precisa saber quando a cadeira vaga; o que
   ele não precisa é *escolher*.
3. A conta é `início + duracao_min`, e `duracao_min` vem de `getAgendaConfig(professionalId)` —
   **a mesma configuração que o bot usa**, junto com `hora_inicio`, `hora_fim`, `intervalo_inicio`,
   `intervalo_duracao_min` e `dias_semana`. Nada de duração escrita à mão no front.
4. O `grid-cols-2` vira coluna única — o que **devolve ~88px de altura**, que é justamente o que a
   frente 4.3 gasta.

**Estados que precisam existir** (hoje nenhum existe, porque a lista era estática):

- carregando os horários (esqueleto no lugar do dropdown);
- **nenhum horário livre** naquele dia para aquele profissional — a mensagem tem que dizer o que
  fazer ("Lucas não tem horário livre em 04/08. Escolha outra data ou outro profissional."), não
  só listar vazio;
- a busca falhar — aí sim liberar entrada manual, como escape, avisando que não deu para conferir
  a agenda.

**Ponto em aberto:** ao **editar** um evento existente, o horário atual dele não está em
`availableSlots` (ele mesmo o ocupa). O slot do próprio evento precisa ser reinserido na lista, ou
a edição fica impossível.

### 4.5 A altura — a proposta que você pediu

Conta com o modal já compactado (52px de campo + 20 de rótulo + 16 de vão ≈ **88px por linha**):

| | Hoje | Proposto |
|---|---|---|
| Linhas de campo | 4 (Início/Término dividem uma) | 5 |
| Caixa/área extra | Descrição agrupada ≈ 145px | `textarea` ≈ 116px |
| **Total do card** | **≈ 655px** | **≈ 714px** |

Num iPhone de 844px sobra folga; **num iPhone SE (667px) estoura nos dois casos**, e no proposto
estoura antes — basta a faixa de erro aparecer.

**Recomendação: as duas coisas, nesta ordem.**

- **Agora (barato):** manter a rolagem no backdrop que já foi posta em 2026-08-04. Ela resolve o
  alcance dos botões sem clipar nada.
- **Depois (o certo):** **rodapé fixo** com `Cancelar`/`Salvar` sempre visíveis e o miolo rolando
  por dentro do card. **Isto tem um pré-requisito, e ignorá-lo quebra a tela:** os três dropdowns
  (Profissional, Data, Início) são `absolute` e **escapam do card de propósito** — é por isso que
  o card é `overflow-visible`. Pôr rolagem interna sem tratar isso **clipa os três**. O pré-passo
  é renderizá-los em **portal** ancorado ao gatilho (o `WhatsAppPanel` já usa `createPortal`, o
  padrão existe no projeto) ou convertê-los em **bottom-sheet**, que no celular é o idioma certo
  para escolher entre muitos itens de qualquer jeito.

**Não decidido:** portal ou bottom-sheet. O bottom-sheet é mais trabalho e resolve mais — com a
lista de horários livres podendo ficar longa, é o caminho que eu defenderia.

---

## Backlog herdado da crítica `$impeccable` (levantado, não pedido)

Fica registrado aqui porque saiu da mesma varredura. **Não executar sem o dono escolher.**

1. **A raiz do roxo é uma linha.** `CALENDARIO/index.css` — `--color-border: rgba(168,85,247,0.25)`.
   **Toda `className="border"` sem cor explícita pinta roxo a 25%.** Enquanto esse token for roxo,
   cada componente novo reintroduz o problema sozinho. Correção: `rgba(255,255,255,0.10)` (o mesmo
   valor de `--border` em `00-tokens.css`) e `--color-ring` → `rgba(255,255,255,0.45)`. É global —
   mexe no desktop junto, por isso não foi feito.
2. **O badge de não lidas nunca aparece — P0.** `App.tsx` monta `<MobileBottomNav>` sem
   `conversationCount`; o default é `0`, então `.mb-dock__badge` nunca renderiza. É a única
   informação que o dono tira do app **sem abrir nada**, e está construída, estilizada e desligada.
3. **Nenhuma ação destrutiva tem volta.** `handleMarkAsDone`, `handleDeleteProfessional` (que apaga
   junto todos os eventos locais do profissional) e `handleDeleteEvent` — nenhum tem confirmação
   nem desfazer. O `Toaster` já está montado em `App.tsx`; o conserto é um toast com ação
   "Desfazer" de 5s adiando a chamada real.
4. **Mensagens de erro em língua de dev.** `window.alert("...Verifique a conexão com a API.")` e
   `toast.error("...Verifique se a API (porta 3333) está ativa.")` — "API" e "porta 3333" para um
   barbeiro, no momento em que o cliente está de pé na frente dele.
5. **A lupa do header da Agenda é um alvo morto** — `<button aria-label="Pesquisar">` sem
   `onClick`, permanente no canto superior direito.
6. **~120 linhas de CSS morto** em `10-mobile.css` (`.mb-status*`, `.mb-topbar*`, `.mb-avatar`,
   `.mb-filterbtn`, `.mb-bars*`, `.mb-dispo*`) que `DashboardMobile.tsx` não renderiza — e que
   ainda entram no inventário de tipos sem existir na tela.
7. **No modo dia o mês não existe em lugar nenhum.** `MonthPillsStrip` é escondido quando
   `view === 'day'`; para ir para amanhã são quatro toques.

---

## Ordem sugerida

1. **Frente 3** (menu dos "..."): é a menor, tem referência exata e uma das ações liga de verdade.
2. **Frente 4.2 + 4.3 + 4.4** (campos do modal + término calculado): mexe em **correção**, não em
   gosto — hoje dá para marcar em cima de horário ocupado. É a de maior risco real para o dono, e
   a peça que resolve (`getAvailableSlots`) já está pronta e sem uso.
3. **Frente 1** (chips): a maior, e a que mais muda a tela que o dono mais olha. Começar
   extraindo o vidro para `ui/vidro.ts`, e **pedir as três decisões em aberto antes de codar**
   (destino do "Marcar como Feito", acordeão exclusivo ou não, por onde se edita um agendamento).
4. **Frente 4.5** (rodapé fixo + portal/bottom-sheet dos dropdowns): depois da 4.4, porque é ela
   que define quantos campos o modal tem de fato.
5. **Frente 2** (relógio): depende de decidir antes se a peça fica no Dashboard.

**Decisões que travam execução** — perguntar antes de codar, não depois:
`Marcar como Feito` (botão discreto × swipe) · acordeão exclusivo × múltiplos abertos · por onde
se edita um agendamento quando o toque virar abrir/fechar · portal × bottom-sheet nos dropdowns ·
o relógio fica no Dashboard ou sobe para a Agenda.

## Como verificar antes de dizer "pronto"

O painel está atrás de login (`VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` do `.env.local`), então o
agente **não** consegue printar sozinho. O que dá para verificar sem entrar:

- `npx tsc --noEmit` de dentro de `CALENDARIO/`.
- Buscar cada módulo alterado no dev server (`http://localhost:3002/components/<Arquivo>.tsx`) —
  200 significa que compilou; erro de sintaxe devolve o erro no corpo.
- `node .claude/skills/impeccable/scripts/detect.mjs --json <alvos>` da raiz do repo.

O resto é olho do dono no aparelho.
