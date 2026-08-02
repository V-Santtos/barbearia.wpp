# CONTEXTO_SESSAO.md — Protótipo do Dashboard

Atualizado em: 2026-08-01

Memória curta desta pasta. Onde o protótipo está, o que já foi decidido e o que
ficou em aberto. Ler antes de mexer, para não redecidir o que já foi decidido.

---

## O que é esta pasta

Protótipo de validação visual do **Dashboard** que vai morar dentro do app
`CALENDARIO` (painel do dono, porta 3002). É um HTML standalone com dados
falsos — **não é o app real**, não fala com banco, não tem rota.

Serve para decidir desenho antes de escrever o componente de verdade. Quando o
desenho fechar, os arquivos `css/01` a `css/10` e os componentes do
`validacao-dashboard.source.jsx` migram para o `CALENDARIO`; o resto fica aqui.

---

## Como rodar

Servidor estático qualquer, de dentro de `Dashboard/`:

```bash
cd Dashboard && python -m http.server 3005
```

**Armadilha do `http.server`, achada em 2026-08-01:** ele não manda
`Cache-Control`. Sem esse cabeçalho o navegador aplica frescor heurístico (10% da
idade do arquivo pelo `Last-Modified`) e segura CSS já editado por **horas** — o
sintoma é editar o parcial, dar F5 e não mudar nada, sem erro nenhum. Custou uma
rodada inteira de depuração achando que a regra estava errada. Se acontecer:
`Ctrl+Shift+R` resolve na hora, e servir com `Cache-Control: no-store` resolve
sempre (bastam três linhas herdando `SimpleHTTPRequestHandler`).

Abrir `http://localhost:3005/validacao-dashboard.html`. O botão no topo alterna
entre a moldura de desktop e a de celular.

**Depois de editar o `.jsx`, reconstruir o bundle:**

```bash
cd Dashboard && "../CALENDARIO/node_modules/.bin/esbuild" validacao-dashboard.source.jsx --bundle --outfile=validacao-dashboard.bundle.js --charset=utf8 --loader:.jsx=jsx --platform=browser
```

O esbuild e o React vêm do `node_modules` do `CALENDARIO` — esta pasta não tem
`package.json` de propósito. (O comando antigo registrado aqui apontava para
`Trabalhos Individuais - Claud/…/Aplicativo FULL/`, pasta que não existe mais
nesta máquina; foi corrigido em 2026-08-01.)

**Editar CSS não precisa de build.** O HTML carrega `css/index.css`, que faz
`@import` dos parciais. Salvar e dar F5 basta.

---

## Os arquivos

| Arquivo | O quê |
|---|---|
| `validacao-dashboard.html` | entrada; carrega o bundle e o `css/index.css` |
| `validacao-dashboard.source.jsx` | **fonte única do JS — editar aqui** |
| `validacao-dashboard.bundle.js` | compilado; não editar |
| `css/index.css` | só `@import`s — **a ordem ali é a cascata** |
| `css/01-tokens.css` … `10-mobile.css` | o dashboard de verdade |
| `css/99-preview.css` | moldura do protótipo — **não vai para o app** |
| `uploads/ANEXO_DESIGN_SYSTEM_DASHBOARD.md` | a especificação de origem (19/05) |

O CSS era um monólito de 1.938 linhas e foi dividido em 2026-08-01. Metade dele
(847 linhas) era moldura de protótipo misturada com o dashboard real — essa
separação é o motivo principal da divisão.

---

## O que a tela mostra hoje

**Quatro KPIs:** Agendamentos · Ocupação · Horários livres · Novas marcações.

**Agenda de hoje**, com três abas que funcionam: `Próximos` (só o que ainda vai
acontecer), `Linha do tempo` (o dia inteiro, com divisor "agora" derivado) e
`Concluídos`.

**Próximos horários livres:** os dois próximos encaixes de cada barbeiro, o
segundo mais apagado por ser alternativa, não resposta.

**Disponibilidade:** um bloco por barbeiro, cada um com a janela que ele
configurou, mostrando **número de vagas** por dia.

---

## Decidido em 2026-08-01

### O que saiu, e por quê

| Saiu | Motivo |
|---|---|
| KPI "Bloqueios" | contava de volta o que o próprio dono cadastrou |
| Tags `App`/`WhatsApp` | só existe WhatsApp; a tag classificava um universo de um |
| Painel "Origem dos agendamentos" | mesma informação das tags, em donut |
| Painel "Status dos agendamentos" | na prática virava Agendado vs. Concluído |
| Setas de tendência (`+12%`) | exigem período anterior; o sistema começa do zero |
| Período "Ano" | "892 cortes em 2026" num ano que não terminou de existir |
| Painel "Histórico de cortes" | ver abaixo |

**O histórico de cortes** foi o corte mais discutido. Era curva suavizada sobre
contagem inteira de 0 a 2 — bezier entre 1 e 2 corte passa por 1,4, que não
existiu. Pior que a forma era o dado: mostrava o dia que o dono acabou de viver.
E `concluido` é escrito **pelo relógio** (`App.tsx:228` marca sozinho todo
agendamento cujo horário passou), então o gráfico mede "horários que passaram",
não "cliente que veio" — cliente que furou conta igual a cliente atendido.

Se um dia voltar, volta como **barra por dia** em 7/30 dias, ou como mapa de
dia-da-semana × faixa de horário, e o lugar dele é ao lado de onde o dono edita
a agenda — não no topo do dashboard. Gatilho: 4 a 6 semanas de dado real.

### O que entrou

**Novas marcações** — o quarto KPI. Vem de `created_at`, não de `dia_marcado`:
conta quantas vezes alguém marcou, não quantos atendimentos o dia tem. É o único
número da tela que cai na hora se o bot parar de pé.

### Regras de estilo que ficaram valendo

- **Cor só para o que se repete e exige decisão.** Sobraram quatro matizes de
  nove: roxo estrutural (marca, chip ativo, "hoje"), duas de identidade dos
  barbeiros, âmbar/vermelho para exceção. Ícone de KPI e de painel são brancos.
- **O rótulo diz a coisa; o período quem diz é o chip.** Por isso "Agendamentos"
  e não "Agendamentos hoje".
- **Estado nunca por opacidade.** Cada estado tem símbolo próprio, ou não é
  estado. Foi o erro do grid antigo de disponibilidade, onde "lotado" era o mesmo
  ponto a 25%.
- **Ausência não pode carregar significado quando ausência é um estado possível.**
  Cheguei a propor tirar a tag "Agendado" (é 80% das linhas). Não dá:
  `agendamentos.status` é nulo-permitido, então "sem tag" ficaria idêntico a
  "status não gravado". A tag ficou; o que saiu foi a cor dela.

### Números reais do banco usados no mock

Consultados em `agenda_profissional` (2026-07-31) para o mock não mentir:

| | Expediente | Slot | Intervalo | Dias | Janela |
|---|---|---|---|---|---|
| Lucas Costa | 08:00–19:00 | 60min | 11:00 (90min) | seg–sáb | 10 |
| Lucas Eloi | 08:00–20:00 | 45min | 12:00 (120min) | seg–sáb | 10 |

Isso dá **~9 vagas/dia para o Costa e ~13 para o Eloi**. É o fato que derrubou o
desenho antigo: capacidades diferentes tornam "o dia tem vaga" uma frase vazia, e
proíbem escala de cor por ocupação (5 vagas é metade para um e um terço para o
outro).

**No mock, a janela do Costa está em 8 de propósito** — no banco os dois estão em
10, e sem divergir não dava para ver o comportamento de janelas diferentes.

---

## Tarefas em aberto

Lista para bater o olho. O porquê de cada uma está logo abaixo.

- [x] **1.** Chip de período — **resolvido nas duas telas**; rótulo removido em 2026-08-02
- [x] **2.** Disponibilidade — **fica**, e virou **coluna vertical também no desktop** (02/08)
- [x] **3.** Achar mais dado que valha o V1 — **entrou o relógio do dia** (02/08)
- [x] **4.** Camada de design — **`impeccable` rodado em 2026-08-02**, ver seção abaixo
- [ ] **5.** Desenhar a integração no CALENDARIO — estado de view + endpoint
- [x] **6.** Barra de navegação do celular — **feita em 2026-08-01**, virou dock

## A passada do `impeccable` (2026-08-02)

Skill trazida pelo usuário (`pbakaus/impeccable`, adoção parcial — ver
`docs/skills-log.md`). O `critique` rodou com duas avaliações isoladas: revisão de
design e detector determinístico + medição no navegador. Relatório completo
arquivado em `.impeccable/critique/`. **Nota inicial: 16/40.**

Executado em **modo refinamento**, por decisão do usuário: *"não precisa remodelar
o dashboard inteiro, esse visual está coerente com o calendário de lá"*.

**O que foi feito:**

- **A verdade de hoje passou a sair de uma fonte só.** A tela tinha **três
  respostas diferentes** para "quantos horários livres hoje": o KPI dizia 14, a
  Disponibilidade somava 9 e a ocupação implicava 6. Agora `OCUPACAO_HOJE` e os
  KPIs de hoje são **calculados** da agenda do dia + capacidade + vagas. A
  primeira coluna do `VAGAS` mudou (3→1, 6→5) porque ela tem que bater com a
  agenda: cada barbeiro tem 9 linhas hoje, 1 cancelada.
- **O ladrilho de ícone dos cards morreu.** Ocupava 18,6% da largura no desktop e
  ~30% no celular sem carregar informação. O rótulo saiu de 10px/caixa-alta/42%
  (4,08:1, reprovado) para 13px/branco-70. **A faixa saiu da linguagem visual dos
  painéis** — sem borda, sem sombra — que é a forma de dizer que ela é resumo e
  eles são trabalho. O chip de período mora dentro dela.
- **O ícone saiu do cabeçalho dos painéis do desktop.** A causa do incômodo era
  medível: o centro óptico do ícone caía **exatamente na fresta** entre título e
  subtítulo, sem alinhar com nenhum dos dois. Título subiu para 15px/650, e a
  contagem que muda todo dia virou `meta` na linha do título. Os dois subtítulos
  que eram documentação saíram. **O celular não foi tocado.**
- **Disponibilidade:** capacidade escrita no cabeçalho de cada barbeiro
  (`9 vagas/dia`), `folga`/`bloqueio`/`—` escritos também no desktop, e o `0`
  âmbar virou **`cheio`**. A faixa por barbeiro **ficou** — a borda irregular é a
  decisão mais autoral da tela e o eixo único a mataria.
- **Piso de contraste:** `--text-muted` (.55) passa em AA com folga (6,08:1); quem
  reprovava era `--text-faint` (.32, 2,91:1) e uma família de alfas fora do token
  set. Todos trocados. `--text-faint` deixou de ser cor de texto.
- **Opacidade parou de comunicar estado na agenda** (regra travada): a barra de
  identidade não apaga mais em concluído, e cancelado fica com o risco, que já é
  símbolo.
- **Foco, movimento e semântica:** anel de foco da marca (não existia **nenhuma**
  regra de foco em folha nenhuma), `prefers-reduced-motion`, `h2` nos painéis
  (`h1`→`h3` pulava nível) e `role="tablist"` trocado por `radiogroup`/`aria-current`
  — não havia `tabpanel` nenhum para o leitor de tela encontrar.
- **Morto removido:** `.kpi--alerta`, `--kpi-grad`, `.db-pill`, `.oribadge`,
  `.db-linkbtn`, `.db-navbadge`, `.db-topbar__nav*` e o `janelaVisivel`, que era
  calculado em duas telas e usado em nenhuma.

**O detector fecha em 0 achados de produto.** Sobra só `overused-font` (Inter),
**mantido de propósito**: o `CALENDARIO` usa Inter (`index.css:4`), e trocar a
fonte aqui quebraria a coerência que é justamente o que não se pode quebrar.

**Não executado, e por quê:** o eixo único na Disponibilidade do desktop (mataria
a borda irregular), alvos de toque de 44px no desktop (mudaria a densidade da
tela toda), e as perguntas de produto que a revisão levantou — se "Ocupação" muda
alguma decisão do dono, se os dois painéis de horário livre deviam ser um só, e
qual o próximo gesto depois de ver um horário livre. Essas são da tarefa 3.

## O relógio do dia, e a Disponibilidade em pé (2026-08-02)

### O que entrou

**"O dia"** — anéis concêntricos, um por barbeiro, onde a volta inteira é
`08:00→20:00`. Arco cheio na cor de identidade = ocupado; fio âmbar = vaga;
tracejado = intervalo; trilho quase apagado = fora do expediente. Um ponteiro
marca **agora**.

O que ele faz que nenhum outro painel fazia: mostra o **formato** do dia.
`6 horários livres` é o mesmo número quando as vagas estão no meio da tarde e
quando estão empilhadas depois das 18h, e as duas situações pedem coisas opostas
do dono. No mock isso aparece: o Costa tem 1 vaga às 16:30, **cercada de
atendimento dos dois lados** — rombo que ele enche com uma mensagem. As 5 do Eloi
estão quase todas no fim do dia — não é rombo, é expediente até as 20:00 que
talvez não precise existir.

**A escala é angular e compartilhada.** Concêntrico foi descartado numa primeira
passada com o argumento errado — "o anel de dentro tem circunferência menor,
distorce". Distorce o *comprimento* do arco, mas num mostrador se lê **ângulo**,
e 16:30 cai no mesmo lugar em qualquer raio. Além de caber onde dois mostradores
não cabiam, concêntrico entrega o que dois lado a lado não entregam: **dois vãos
alinhados no mesmo raio = os dois livres na mesma hora**, que é buraco da
barbearia inteira e não de uma cadeira.

`JANELA_DIA` sai de **todos** os barbeiros, nunca dos filtrados: assim filtrar
num profissional tira um anel sem mexer a posição das horas.

**A Disponibilidade virou coluna vertical no desktop**, reusando a `DispoList`
que já existia no celular — não um terceiro layout. `DispoStrip` e o CSS
`.dstrip`/`.dblock` foram **removidos** (estão no commit `ef238ba`). A borda
irregular das janelas diferentes não se perdeu: girou junto e vira `—` no fim da
coluna mais curta. `comCapacidade` é só do desktop — a coluna do celular tem
58px e não cabe "9 vagas/dia".

### O dimensionamento das duas colunas — a regra que ficou

`.db-duo` é `auto minmax(0, 1fr)`: **a Disponibilidade encosta na própria grade
e para; toda a sobra vai para o relógio.** Medido no fim: 302px de painel para
uma grade de 268px (2px de folga) e 435px para um mostrador de 401px (2px). Os
dois no limite.

Três tentativas erradas antes de chegar aqui, e o motivo de cada uma está na
regra:

1. **Relógio pegando a sobra com `max-width: 288px` no mostrador.** Tinha a
   largura e não usava — ~100px de vazio de cada lado do anel. Folga assim não é
   respiro, é desperdício.
2. **Inverter, deixando a Disponibilidade com a sobra.** Pior: apareceu coluna
   em branco no painel. **Espaço vago dentro de uma grade não vira respiro** —
   ou a célula estica e fica um retângulo de 116px para escrever "1", ou fica
   buraco. A regra: *quem tem conteúdo de tamanho fixo pede `auto`; quem cresce
   bem fica com o `1fr`.*
3. **Coluna do dia em `1fr`.** A sobra entrava ali e jogava o número para longe
   do rótulo dele. Virou `76px` fixo — e fixo em todas as linhas, nunca `auto`,
   porque cada linha é uma grade própria e `auto` daria trilhos diferentes para
   "Hoje 20" e "domingo 25".

**O mostrador precisa de um palco.** O SVG tem `viewBox`, então o navegador
deriva altura da largura: solto, ele estourava o card e empurrava o rodapé para
fora. `.relo__palco` recebe a altura que sobrou e o SVG se ajusta dentro dela.

**Uma hora escrita, não cinco.** A primeira versão escrevia a hora de toda vaga
dentro do anel. Quebrou no primeiro teste com o Eloi filtrado: `18:30`, `19:15` e
`08:00` caem quase no mesmo ponto do mostrador — a volta é `08:00→20:00`, então o
fim do dia encosta no começo. Ficou **só o próximo encaixe**, e só com um barbeiro
em cena: uma etiqueta não tem com quem colidir, e é a que interessa.

### Ocupação FICA — e o critério que ela estabeleceu

Foi questionada e **defendida pelo usuário**: o número em porcentagem serve para
bater o olho e saber se o dia está apertado ou tem espaço. Isso afinou o critério
do V1 inteiro — não é "muda uma decisão", é **responder cliente sem navegar**,
que é o que o dono de barbearia pequena faz o dia todo com o WhatsApp na mão.

### A reescrita do mock que isso exigiu

O relógio ia desenhar uma contradição que a lista escondia: a configuração real
do banco põe o Costa em intervalo das **11:00 às 12:30**, e o mock tinha ele
atendendo às 11:00. Enquanto era lista, ninguém via.

Agora **tudo que fala de hoje nasce da grade de horários**:

- `AGENDA_CONFIG` ganhou `expediente` (início, fim, duração, intervalo) — os
  números reais de `agenda_profissional`.
- `slotsDoDia()` gera a grade com a mesma conta do `server.js`. **`capacidade`
  deixou de ser 9 e 13 escritos à mão** e virou o tamanho dessa lista.
- Cada linha da agenda mora num horário real do barbeiro dela, e o `status` é
  **derivado de `AGORA`** — escrito à mão só quando não dá para deduzir
  (cancelado, reagendado).
- `livresDoDia()` = slots sem linha viva. Cancelado devolve o horário para a rua.
- A primeira coluna de `VAGAS`, o centro do relógio e o KPI "Horários livres"
  **são o mesmo número pela mesma conta** — conferido no navegador nas duas
  cenas: 6/6/6 com os dois, 1/1/1 filtrado no Costa.
- `PROXIMOS_LIVRES` era lista escrita à mão e virou derivação das vagas que ainda
  não passaram.
- `AGORA` é um lugar só. O celular tinha `11:00` fixo no cabeçalho de "em
  atendimento".

**Defeito achado no caminho:** `1 cancelados`. A pluralização estava escondida
enquanto o número era sempre 2 — apareceu no primeiro filtro por profissional.
Corrigida, junto com o `2 profissionais ativos` que estava escrito à mão.

### A segunda ideia redonda, com gatilho

**A rosa de pétalas** (raio variável por dia da semana): qual dia enche, para
decidir folga e horário de abertura. É decisão de verdade para barbearia pequena
e **não foi feita porque exige 4 a 6 semanas de histórico** — `agendamentos` tem
1 linha. Quando houver dado, ela divide espaço com o relógio ou o substitui.
Registrada aqui para não ser reinventada do zero daqui a dois meses.

### O LAYOUT DO V1 FECHOU AQUI

Aprovado pelo usuário em 2026-08-02, com o desenho acima. **O dashboard do V1 é
este** — quatro KPIs, agenda de hoje, próximos horários livres, disponibilidade
em pé e o relógio do dia. Nada de financeiro nesta fase, e isso não é lacuna: é
o escopo.

**O lugar do financeiro já está decidido, e é por isso que a parte de baixo ficou
limpa.** Quando entrar, vira uma **seção própria no rodapé da página**, embaixo
de tudo que existe hoje — nada acima dela se mexe. A ideia registrada para
quando chegar a hora: um **preview bloqueado** ali, visível para quem não paga,
como porta de entrada do módulo financeiro pago. **Não é para construir agora.**

### Fica aberto

- **O relógio não está no celular.** Foi decisão de escopo, não esquecimento —
  o pedido era o reposicionamento do desktop. Se entrar, um anel por vez com o
  filtro governando é o caminho mais provável.
- **"Próximos horários livres" ficou redundante em quase tudo** — é a versão em
  texto de dois pontos do mesmo anel. Ficou porque carrega o caso que o relógio
  **não pode** carregar: quando hoje acaba, ele diz `Amanhã 08:00`. Decidir com
  os dois na tela.
- `_esboco-relogio.html` é rascunho de decisão, **fora do git de propósito** —
  não faz parte do protótipo. Apagar quando não servir mais.

### O próximo passo é a tarefa 5

Combinado com o usuário no fim desta sessão: **levar este dashboard para dentro
do `CALENDARIO` de verdade.** O detalhe do que já se sabe está na seção "5. Como
isso entra no CALENDARIO", mais abaixo — e agora ela ganhou um insumo que não
tinha: o protótipo deixou explícito **quais números o endpoint precisa
devolver**, porque tudo que fala de hoje aqui já nasce de uma fonte só
(`slotsDoDia` + agenda do dia).

## Em aberto — o detalhe de cada uma

### 1. O chip de período — RESOLVIDO (celular em 2026-08-01, desktop em 2026-08-02)

Saiu do cabeçalho da página e desceu para dentro da faixa de KPIs, que é a única
coisa que ele muda. O filtro de profissional ficou no nível da página, porque
esse governa mesmo a tela toda. O registro do problema, abaixo, fica porque a
lógica dele vale para qualquer controle novo que entrar.

### 1b. O problema, como estava

Clicar em `7 dias`, `15 dias` ou `30 dias` muda **só os quatro KPIs**. A "Agenda
de hoje", os "Próximos horários livres" e a "Disponibilidade" ignoram o chip.

Faz sentido que a agenda seja sempre de hoje — uma lista de 30 dias de
atendimento não se lê. O problema não é o painel: **é o chip prometendo um
alcance que não tem.** Ele está no cabeçalho da página, posição que sugere
governar tudo abaixo dele.

Duas saídas para discutir:

- **Mover o chip para dentro da faixa de KPIs**, deixando explícito que ele filtra
  números agregados e não os painéis operacionais. Resolve sem mentir.
- **Fazer os painéis obedecerem**, o que exige responder o que significa "Agenda"
  em 30 dias — e provavelmente a resposta é que não significa nada útil.

Registrado por conta desta pergunta do usuário: *"a agenda de hoje só vai aparecer
[hoje], isso faz sentido?"*

### 2. Disponibilidade — FICA, e o celular foi refeito (2026-08-01)

A dúvida era se o painel deveria existir: **se o barbeiro quer ver disponibilidade,
ele abre o calendário.** Ficou, porque o valor não é *ver* a agenda, é **responder
sem navegar** — "tem vaga sexta?" chega no WhatsApp o dia inteiro.

Os quatro defeitos do celular e o que cada um virou:

1. **Nome do barbeiro repetido 20 vezes** (dois por linha, dez linhas) → virou
   **cabeçalho de coluna**, uma vez cada. A grade (`1fr` + uma coluna fixa por
   barbeiro) alinha as células por baixo do nome; a linha do dia carrega só número.
2. **Domingo ocupando linha inteira para não dizer nada** → dia em que *nenhum*
   deles atende virou **risco fino** (`domingo 25` por extenso + régua). O teste é
   por profissional em cena, não por dia da semana: com filtro num barbeiro só, a
   folga dele também vira risco.
3. **Célula vazia com três significados e sem hover para explicar** → cada um
   ganhou **palavra na célula**: `folga`, `bloqueio`, `—`. O `title` continua no
   desktop, onde hover existe; é a prop `rotulo` do `CelulaDispo`, então a célula
   segue sendo **uma só**, compartilhada pelas duas telas.
4. **Linha manca quando um barbeiro sai da janela dele** → a coluna dele não some
   mais, mostra `—` alinhado sob o nome.

**Uma legenda explicando o `—` foi escrita e removida**, a pedido do usuário. O
motivo é o registro que importa: com `folga` e `bloqueio` virando palavra, o traço
**ficou com um significado só**, e a lista terminando na maior das duas janelas
basta para lê-lo. Se algum desses estados voltar a ser célula muda, a ambiguidade
volta com ele e a legenda faz falta de novo.

**O desktop não foi tocado** — segue a faixa horizontal por barbeiro, com o `title`
no hover. A ideia de virar **coluna vertical** ali continua aberta.

---

### 3. Que outro dado cabe no V1

O critério, para não virar vitrine: **o barbeiro olha e faz alguma coisa
diferente por causa daquilo.** Número que só descreve o que ele já viveu não
entra. Nada de financeiro nesta fase — decisão de escopo do V1.

**Já avaliados, com o porquê de estarem parados** (para não reanalisar do zero):

| Candidato | Situação |
|---|---|
| Conversas aguardando resposta | recusado **como card** — número sozinho obriga a navegar, e a aba "Conversas" já tem badge de não lidas. Pode voltar como **painel de fila** (nomes + tempo de espera); o mock `WHATSAPP_QUEUE` está pronto no arquivo |
| Tempo ocioso (buracos entre atendimentos) | ideia boa, parada por ser a mais difícil de calcular e de explicar em três linhas. Diferente de "Horários livres": 14 livres no fim do dia é normal, 14 espalhados é tempo morto |
| Clientes novos vs. retorno | parado por ruído — num dia de 32 atendimentos, oscilar entre 2 e 6 novos não diz nada. Faria sentido em 30 dias |
| Taxa de furo / no-show | **bloqueado**: ninguém marca "não compareceu". `concluido` é escrito pelo relógio |
| Serviço mais pedido | **bloqueado, reconfirmado no banco em 2026-08-02**: não existe passo de escolher serviço no fluxo do bot. A coluna `agendamentos.servico` existe e está vazia na única linha real |
| Onde o cliente desiste | **resolvido FORA do dashboard** em 2026-08-02: virou `npm run funil` (`BARBEARIA/ferramentas/funil.mjs`), ferramenta de linha de comando. Quem age sobre essa resposta somos nós, não o barbeiro — é depuração do bot, não métrica de barbearia |
| Antecedência média · cliente sumido · novos vs. retorno | **bloqueados por falta de histórico, medido em 2026-08-02**: `agendamentos` tem **1 linha** no banco. Não é só que não ajudam hoje — não dá nem para ver funcionando. O critério que ficou valendo para o V1: **tem que servir no primeiro dia de uso, com zero histórico** |

**Novos, a avaliar:**

- **Antecedência média** — distância entre `created_at` e `dia_marcado`. Responde
  uma pergunta que o dono não sabe responder e que controla uma configuração
  dele: se todo mundo marca para amanhã, a janela de 10 dias não serve para nada;
  se o pessoal quer duas semanas, a janela está **custando agendamento**. É o raro
  número que aponta direto para uma alavanca.
- **Onde o cliente desiste** — `webhook_eventos` guarda o degrau da conversa.
  Quantos chegam no menu e quantos fecham, e em qual passo somem. Num SaaS em
  validação isso vale mais que qualquer métrica de agenda — mas talvez seja tela
  nossa, não do barbeiro.
- **Cliente sumido há X** — base do "cutucão por inatividade" que já está em
  `CONTEXTO.md` da raiz como ideia. Só vira card se o cutucão existir; senão é
  informação sem ação.

### 4. Camada de design

Vai ter uma passada de vistoria com uma ou duas skills que o usuário vai indicar.
**Combinado para a próxima sessão** — não sair escolhendo skill por conta.

Antes disso, o que já está decidido e não deve ser reaberto na vistoria: a regra
de cor, o rótulo sem período, símbolo em vez de opacidade, e o formato do card
(rótulo em caixa alta, ícone isolado à esquerda, degradê padronizado em duas
variáveis no `:root`).

### 5. Como isso entra no CALENDARIO

Levantado em 2026-08-01, ainda não discutido. O que já se sabe:

- **Os dois pontos de entrada já existem, desligados.** `UserMenu.tsx:129` tem o
  botão "Dashboard" com `disabled` e selo Premium; `MobileBottomNav.tsx:14` tem a
  aba com `placeholder: true`, cujo clique é engolido.
- **Não há roteador no app.** A navegação é estado: `useState<MobileTab>` no
  `App.tsx:73`. Então "abrir o dashboard" é mais um estado de view, não uma rota —
  e no desktop não existe estado nenhum equivalente ainda.
- **Não há endpoint.** O `server.js` não tem nada que devolva os agregados; hoje
  cada número do protótipo é mock. Vai precisar de algo tipo
  `GET /dashboard/resumo`, rota **admin** (o painel já manda `ADMIN_API_TOKEN`).
- **O painel é polling puro** (agendamentos a cada 15s, conversas 8s, mensagens
  5s). O dashboard entra nesse mesmo modelo ou ganha o próprio intervalo.
- **Atenção ao rate limit** — 60s por IP em todas as rotas. Um dashboard que
  dispara várias chamadas a cada refresh precisa de uma chamada só.

### 6. A barra de navegação do celular — FEITA (2026-08-01)

O protótipo tinha **inventado uma aba "Mais"** que não existe em lugar nenhum do
app e **perdido "Conversas"**, que é tela real e a única com badge. A ordem também
divergia. Validar aquela barra era validar uma barra que não ia existir.

Agora são **as três abas do app, na ordem dele** — `Agenda · Conversas ·
Dashboard` (conferido em `MobileBottomNav.tsx`), com badge verde de não lidas em
Conversas, mockado em 3. Os três ícones são **cópia literal do `lucide-react`**
(`CalendarDays`, `MessageCircle`, `BarChart2` → hoje `chart-no-axes-column`),
copiados do `node_modules` do `CALENDARIO`. Desenhar "parecido" faria a barra mudar
de cara sozinha ao portar.

**A forma virou dock**, de uma referência que o usuário trouxe: pílula flutuante,
solta do rodapé, largura mínima **proporcional** (62%) para não encolher em
aparelho maior, ícones espalhados por `space-around`, vidro fosco. O conteúdo passa
por baixo — por isso o respiro de 104px no fim da rolagem.

**Três coisas da referência ficaram de fora, de propósito:**

- **O rótulo por tooltip.** Mesma armadilha da Disponibilidade: hover não existe
  em tela de toque. Quem diz onde você está é a cor + o ponto sob o ícone. Se um
  dia ícone pelado parecer mudo demais, o conserto barato é a **aba ativa expandir
  e mostrar o rótulo dela**, e só ela.
- **A flutuação em laço e o `rotateX`.** Graça de dock de vitrine; numa barra de
  navegação, balançar sozinha lê como bug e a perspectiva torce os ícones.
- **shadcn + framer-motion + radix.** Esta pasta não tem `package.json` de
  propósito, e o que migra para o `CALENDARIO` é o desenho. O efeito todo saiu em
  CSS puro: recuo no `:active`, fade do ponto, `backdrop-filter`.

**Ficou aberto:** o **selo Premium** — o botão do `UserMenu` no desktop tem, a aba
do celular não tem nada. Ou os dois marcam, ou nenhum marca.

### 6b. O topo do celular, na mesma passada (2026-08-01)

Dos três elementos do topo, um era invenção, um era real e um estava faltando:

- **O sino saiu, das duas telas.** Não existe notificação em lugar nenhum do
  `CALENDARIO` — `grep` por `Bell|notification|notificac` em `components/`,
  `App.tsx`, `hooks/` e `services/` não devolve uma linha. E o protótipo pendurava
  um ponto de não-lido nele: um selo que nunca poderia ser zerado.
- **O avatar entrou** no lugar dele. No app, à direita do topo mora o `UserMenu`, e
  no celular ele é a **única** porta para Perfil, Configurações e Sair. Desenho
  copiado de lá (círculo cheio na cor da marca, borda fina, halo roxo); lá são
  44px, aqui 36.
- **O hambúrguer saiu desta aba.** Ele é real — abre o `HamburgerPanel` — mas a
  gaveta dele é do calendário: Criar agendamento, Visualização dia/semana/mês,
  profissionais, Configurar agenda. Nenhum item serve ao dashboard.

**Achado que não virou tarefa:** a lupa do desktop do protótipo também é invenção
— o header de desktop do app tem só as abas de visualização e o `UserMenu`. E a
lupa do celular existe no app, mas **sem `onClick`** (`CalendarHeader.tsx:144`):
dívida do app, não do protótipo.

## Histórico — o que veio antes

**Antes de 19/05:** encoding corrigido (148 trechos de mojibake), ícones de KPI
sem caixa colorida, cores dos profissionais sincronizadas com `GET /profissionais`.

**19/05:** rodada no `DispoGrid`, que codificava disponibilidade por brilho e
opacidade (cheio = livre, 25% = lotado, anel = bloqueio). **Esse componente foi
apagado em 2026-08-01** e substituído pela faixa com número de vagas — a
codificação por opacidade era ilegível em tela de celular dentro de barbearia, e
"fechado = ponto invisível" fazia falta de dado parecer bug de renderização.

**2026-08-01:** limpeza da pasta (4,0 MB → 1,4 MB, 22 arquivos de sobra
removidos), remoção do CSS morto (252 linhas em 12 seções) e dos componentes que
nunca eram renderizados (`Heatmap`, `Sparkline`, `OcupacaoBar`, `Avatar`,
`DonutMini`, `OrigemBadge`).

---

## Referência do projeto real

```
SAAS-BARBEARIA/
  BARBEARIA/    bot de WhatsApp (Hono + TS)        porta 3333
  CALENDARIO/   API (Fastify) + painel (React)     portas 3334 e 3002
  Dashboard/    este protótipo                     sem porta fixa
```

Banco: Supabase `sppexvjvnoganlduyjvs`, o mesmo dos dois. Estrutura de tabela
**se pergunta ao banco** (`cd BARBEARIA && npm run db -- "<sql>"`), nunca a este
arquivo.

O `SITE-BARB-PROF-UNICO` citado na versão anterior deste documento **não existe
neste projeto** — ficou no `Aplicativo-FULL` de origem.
