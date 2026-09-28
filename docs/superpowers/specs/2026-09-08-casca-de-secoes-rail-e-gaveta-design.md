# Design: Casca de seções — rail e gaveta deslizante

**Data:** 2026-09-08
**Status:** Em revisão
**Parte:** 1 de N (só a casca; conteúdo de seção vem depois)

## Contexto

O painel do dono é hoje uma tela só — a agenda — com camadas por cima. O
dashboard é uma dessas camadas, aberta pelo menu do avatar, e a decisão de ele
ser camada está escrita no código (`CALENDARIO/App.tsx:95`):

> O dashboard é camada, não visualização: `view` não é tocado, então voltar
> devolve a agenda exatamente como estava.

Essa decisão é certa para uma **espiada**. Ela não sustenta o que vem: um
**Financeiro**, onde o dono senta e trabalha, e um **Chat web** mais completo
que o do celular. Nenhum dos dois é uma espiada por cima da agenda.

Duas evidências de que a casca atual já não fecha:

1. **O app discorda de si mesmo.** No celular, o dock trata Agenda, Conversas e
   Dashboard como iguais (`MobileBottomNav.tsx`). No desktop, o mesmo dashboard
   mora dentro do menu do avatar, junto de "Ver perfil", "Configurações" e
   "Sair" — que são coisas de conta, não de negócio.
2. **A coluna de 288px mistura níveis.** O `<aside w-72>` guarda contexto da
   agenda (criar, mini-calendário, profissionais) e, junto, a **lista de
   Conversas**, que não é contexto de agenda nenhum. Ela está ali por falta de
   lugar próprio.

Decisão tomada com o dono em 2026-09-08: **o rail troca de seção**, não abre
camadas. Agenda, Conversas, Dashboard e Financeiro viram lugares irmãos.

## Escopo desta parte

Esta parte entrega **só a casca**, vazia e provada com a seção que já existe.

**Entra:**

- O rail vertical fixo no desktop, com os ícones das seções.
- A gaveta deslizante (a coluna de 288px) que abre e fecha.
- O contrato de seção: como uma seção declara ícone, rótulo, painel e conteúdo.
- O estado: qual seção está ativa, gaveta aberta/fechada, e preservação do
  estado de cada seção ao trocar.
- A **Agenda** ligada como seção real (é a única que existe hoje).
- O botão `+ Criar` movido da coluna da Agenda para o topo da gaveta
  (pedido do dono em 2026-09-08, depois do corte inicial de escopo — é a
  única peça já existente que esta parte move de lugar).
- Dashboard, Conversas e Financeiro **registrados no rail como placeholder** —
  ícone presente, conteúdo vazio com um aviso de "ainda não migrado".

**Não entra** (cada um é uma parte própria, depois):

- Tirar a lista de Conversas da coluna da Agenda.
- Desmodalizar o `DashboardScreen` (ele continua abrindo pelo menu do avatar
  como está hoje, intocado).
- Qualquer conteúdo de Financeiro — inclusive o modelo de dado, que segue
  **não decidido** por escolha do dono.
- A quarta aba no dock do celular.
- Mover o avatar do cabeçalho para o rail.
- Router / link direto para seção.

O critério do corte: esta parte não mexe em nada que o dono já validou **no
celular** — o aparelho sai desta parte idêntico ao que ele conferiu. No
desktop ela move exatamente uma peça, o `+ Criar` da decisão 6, e move porque
foi pedido; fora isso, só adiciona casca em volta do que já existe.

## Decisões

### 1. O rail é fixo, a gaveta é que desliza

O rail (~56px) fica sempre visível no desktop. Ele é a âncora — sumir com ele
tira a única pista de "onde eu estou".

Quem desliza é a **gaveta**: os 288px de contexto da seção. Ela abre e fecha
para devolver largura ao calendário, que é o pedido antigo de "aproveitar mais
o espaço".

### 2. A gaveta empurra, não cobre

A gaveta continua sendo filho do flex principal, como o `<aside>` de hoje.
Fechar devolve a largura ao conteúdo em vez de revelar calendário por baixo.

Cobrir seria mais fácil de animar e errado aqui: a gaveta não é um pop-up sobre
a agenda, é uma coluna da própria seção. E cobrir reintroduz o problema que
motivou sair das camadas.

### 3. Clicar no ícone da seção ativa fecha a gaveta

- Ícone de **outra** seção → troca de seção e abre a gaveta (se aquela seção
  tiver painel).
- Ícone da seção **ativa** → alterna a gaveta (fecha/abre).

É o comportamento do VS Code. Aprende-se em um clique acidental.

### 4. Seção sem painel não tem gaveta

O Dashboard usa a largura toda. Uma seção declara `temPainel: false` e, ao
entrar nela, a gaveta fecha e o ícone dela não alterna nada.

### 5. Largura e animação reaproveitam o que já existe

- Largura da gaveta: **288px**, a mesma do `w-72` atual. Nada reflui.
- Transição: a mola do `HamburgerPanel` (`spring`, `stiffness: 340`,
  `damping: 34`). Não inventar uma segunda gramática de movimento — o app já
  tem a dele, travada em `REGRAS.md`.
- `useReducedMotion` respeitado, como o dock já faz.

### 6. O botão "Criar" sai da Agenda e sobe para o topo da gaveta

Hoje o `+ Criar` mora dentro do `<aside>` da agenda, o que o torna um acessório
do calendário. Ele não é: marcar horário é **a** ação primária do produto, e o
dono precisa dela esteja ele olhando a agenda, uma conversa ou o financeiro.

Ele passa a ser peça da casca, fixa no topo da gaveta, acima do conteúdo da
seção — a posição que o template usa para o "Quick Create".

Do template vem **só a posição**. O `Quick Create` de lá é botão sem `onClick`
(`nav-main.tsx:110`), decorativo igual ao "Add event" do calendário que já
inspecionamos. Não há comportamento para aproveitar.

**Com a gaveta fechada**, o Criar desce para o topo do rail, como ícone `Plus`
acima dos ícones de seção. É o que mantém a ação primária sempre a um clique —
que é o motivo inteiro de tirá-la da coluna da agenda. O template faz o mesmo
movimento quando colapsa a sidebar.

**"Criar o quê", nas seções que não são a Agenda:** por ora, agendamento. É a
ação primária de uma barbearia em qualquer tela, e criar um horário de dentro do
financeiro é gesto legítimo.

```
ponytail: "Criar" tem uma ação só (agendamento), em todas as seções.
Teto: no dia em que existir uma segunda coisa criável (lançamento no
financeiro, por exemplo), um botão com destino fixo passa a mentir.
Gatilho de upgrade: a segunda coisa criável. Aí ele vira menu, e a posição
não muda.
```

No celular nada muda: lá o criar já tem os caminhos dele (o FAB da tesoura e o
botão de vidro do `HamburgerPanel`), ambos validados.

### 7. Seções ficam montadas, mas o polling não

Trocar de seção **não desmonta** a anterior. É assim que a promessa do
`App.tsx:95` sobrevive: voltar para a Agenda devolve data, visualização, filtro
e posição de rolagem sem refazer nenhuma busca.

O preço, e ele é conhecido e grave: quatro seções montadas são quatro pollings
simultâneos. Foi exatamente esse empilhamento que produziu a latência de
**8.711ms** em 2026-08-01, registrada em `ANEXO_BANCO/README.md` — painel,
espelho e bot pedindo ao mesmo tempo.

Logo, regra dura desta casca: **toda seção montada e inativa passa
`enabled: false` ao `usePolling`.** O hook já suporta (`usePolling.ts`), e o
`DashboardScreen` já faz isso hoje com `enabled: ativo`. A casca só generaliza
o que já era prática.

### 8. Cada seção tem a própria cerca

`components/dashboard/LimiteDeErro.tsx` existe por causa de um susto real
(2026-08-04): um campo faltando na API estourou num `.map` e o React desmontou a
árvore inteira — o barbeiro perdeu o **calendário**, não o dashboard.

Com quatro seções irmãs esse risco multiplica. Cada seção é embrulhada na mesma
cerca, que sobe de `components/dashboard/` para `components/shell/`, sem mudar
comportamento. É movimentação de arquivo, não reescrita.

### 9. Ícones: cobertura do template, forma do app

Decidido com o dono em 2026-09-08, depois de renderizar os candidatos no
tamanho e no fundo reais.

**A regra do conjunto:** cobertura de conceitos igual à do template shadcn;
**onde o lucide oferece par redondo/quadrado, escolher o redondo.**

O porquê da regra, e é o critério que o dono levantou — coerência com o
aplicativo. O conjunto do template é retilíneo: `MessageSquare`, `CheckSquare`,
`LayoutDashboard`, `Kanban`, `Banknote`, quase tudo retângulo. Este app é o
contrário: "Criar" é pílula, FAB é círculo, avatar é círculo, a pílula do dock
desliza, os painéis têm canto de 28px. Importar a gramática retilínea inteira
brigaria com a geometria já lapidada.

O efeito colateral bom: o `MessageCircleMore` — troca deliberada do dono
registrada no `CONTEXTO.md` em 2026-08-04 — deixa de ser exceção e passa a ser
a regra do conjunto. Nada validado é desfeito.

| Seção | Ícone | Nota |
|---|---|---|
| Agenda | `CalendarDays` | já é o do dock; calendário é retângulo por natureza |
| Conversas | `MessageCircleMore` | já é o do dock, e é a variante redonda |
| Dashboard | `Gauge` | redondo; substitui o `BarChart2`, único do conjunto antigo sem forma que o contivesse |
| Financeiro | `Coins` | redondo **e** sem símbolo de moeda — o `CircleDollarSign` é cifrão de dólar num app de real, e o `Banknote` do template é retângulo |
| Configurações | `Settings` | é o que o `HamburgerPanel` já usa |
| Criar | `CirclePlus` | rima com a pílula e o FAB |

Gaveta abre/fecha: `PanelLeft` / `PanelLeftClose`, o par que o próprio template
usa. Todos verificados em 2026-09-08 contra a nossa versão do lucide (0.552.0) —
existem, e nenhuma atualização de dependência é necessária. Do template vem
**nome de ícone**, nunca código ou dependência.

**Divergência temporária, assumida:** o dock do celular fica com `BarChart2` no
Dashboard até a parte que mexer nele (a da quarta aba), quando migra para
`Gauge`. Agenda e Conversas já nascem iguais nos dois. Rail e dock não são
vistos na mesma tela, então a divergência não confunde ninguém enquanto durar —
mas ela tem fim marcado, não é definitiva.

### 10. Seção é estado, não URL

O projeto não tem router e esta parte não adiciona um.

```
ponytail: seção mora em estado do app, não na URL.
Teto: não dá para mandar link direto de uma seção, e o botão voltar do
navegador não anda entre elas. Recarregar cai na Agenda.
Gatilho de upgrade: no dia em que alguém precisar compartilhar link de seção.
```

Custa pouco hoje porque recarregar já derruba a sessão (o login vive em
memória): a volta é sempre para o começo, com ou sem router.

## Arquitetura

Quatro peças novas, todas em `CALENDARIO/components/shell/`:

| Arquivo | O que faz | Do que depende |
|---|---|---|
| `secoes.ts` | O registro: id, rótulo, ícone, `temPainel`. Uma lista só, ordenada. | lucide |
| `RailDeSecoes.tsx` | Desenha o rail e emite a troca. Não sabe o que cada seção faz. | `secoes.ts` |
| `GavetaDeSecao.tsx` | A coluna que desliza. Recebe conteúdo como `children`. | framer-motion |
| `LimiteDeErro.tsx` | A cerca, vinda de `components/dashboard/`. | — |

E um hook, `hooks/useSecaoAtiva.ts`: guarda seção ativa + gaveta aberta, e
devolve o alternador da decisão 3.

O `App.tsx` compõe: `<RailDeSecoes>` + `<GavetaDeSecao>` + a área de conteúdo.
O `<Sidebar>` atual passa a ser **o conteúdo da gaveta quando a seção é
Agenda** — não muda por dentro nesta parte.

Fronteira que segura tudo isso: **o rail não conhece nenhuma seção pelo nome.**
Ele itera o registro. Adicionar o Financeiro depois é uma linha em `secoes.ts`,
não uma edição no rail.

## Celular

Nada muda nesta parte. O rail é `hidden md:flex`; o dock segue com as três abas
que estão validadas. A quarta aba entra junto com a seção que ela abre — botão
que leva a lugar vazio é pior que botão ausente.

## Como verificar

O login impede o agente de printar sozinho (o dono entra à mão), então a
verificação desta parte é:

1. `tsc --noEmit` limpo.
2. Com `VITE_MOCK=1`, o dono confere no desktop: trocar de seção e voltar para a
   Agenda devolve **a mesma data, a mesma visualização e o mesmo filtro**; a
   gaveta abre e fecha na mola certa; o calendário ganha largura com ela
   fechada.
3. Confirmar no DevTools que a seção inativa **parou** de pedir — é a decisão 7,
   e é a que protege contra a latência de 2026-08-01.
4. O celular continua idêntico ao que ele já validou.

## Perguntas em aberto

1. **Ordem vertical dos ícones no rail** — nasce igual à do dock (Agenda,
   Conversas, Dashboard) com Financeiro no fim. Revisável quando as quatro
   seções existirem de verdade e o dono sentir qual ele mais alcança.
