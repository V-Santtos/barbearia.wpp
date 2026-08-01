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

- [ ] **1.** Decidir o alcance do chip de período — a agenda não obedece a ele
- [ ] **2.** Decidir se a Disponibilidade fica; se ficar, refazer a forma (vertical? o celular está ruim)
- [ ] **3.** Achar mais dado que valha o V1 — candidatos e bloqueios listados
- [ ] **4.** Passar a camada de design com a(s) skill(s) que o usuário vai indicar
- [ ] **5.** Desenhar a integração no CALENDARIO — estado de view + endpoint
- [ ] **6.** Acertar a barra de navegação do celular — ícones, rótulos e ordem

## Em aberto — o detalhe de cada uma

### 1. O chip de período não governa a coluna da esquerda

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

### 2. A coluna de Disponibilidade deve existir?

Dúvida levantada pelo usuário: **se o barbeiro quer ver disponibilidade, ele abre
o calendário.** O dashboard estaria repetindo, pior, o que a tela principal já faz
melhor.

Contra-argumento a pesar: o valor do painel não é *ver* a agenda, é **responder
sem navegar** — a pergunta "tem vaga sexta?" chega no WhatsApp o dia inteiro, e
sair do dashboard para o calendário para responder é o custo que ele evitaria.
Mas isso vale para "Próximos horários livres" com mais força do que para a grade
de 10 dias.

Se ficar, muda de forma. No desktop, a ideia levantada é **coluna vertical** em
vez da faixa horizontal.

**No celular está ruim, e os defeitos são concretos** (reforçado pelo usuário em
2026-08-01, com print). Hoje é uma linha por dia, com uma coluna por barbeiro:

1. **O nome do barbeiro se repete 20 vezes** — dois por linha, dez linhas. É o
   elemento mais repetido da tela para dizer a coisa menos variável dela.
2. **Domingo ocupa uma linha inteira para não dizer nada.** Os dois não trabalham,
   as duas células ficam vazias, e a linha pesa igual a um dia útil.
3. **A célula vazia significa três coisas diferentes e no celular não há como
   saber qual.** No desktop o `title` explica (não trabalha / bloqueio / fora da
   janela dele); em tela de toque **não existe hover**, então a informação
   simplesmente não chega. Foi um buraco que eu abri ao unificar os três estados
   num só símbolo — a unificação está certa para o desktop e deixou o celular sem
   a explicação.
4. **A linha fica manca quando um barbeiro sai da janela dele** — em `qua 28` e
   `qui 29` só o Eloi aparece, porque a janela do Costa é menor. Correto, mas lido
   como falha.

Direções a considerar na próxima passada: o nome do barbeiro virar cabeçalho fixo
em vez de repetir por linha; dia fechado sair da lista em vez de virar linha
vazia; e o motivo de "não dá" precisar de forma visível, não de hover.

Decisão adiada por escolha do usuário: *"eu vou fazer um questionamento na próxima
vez"*.

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
| Serviço mais pedido | **bloqueado, verificado em 2026-08-01**: o bot não manda `servico` no `POST /agendamentos`, então a coluna fica nula para tudo que vem do WhatsApp |

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

### 6. A barra de navegação do celular

Decidir ícones, rótulos, ordem e visual. E tem um problema achado em 2026-08-01:
**a barra do protótipo não é a barra do app.**

| | Protótipo | App real (`MobileBottomNav.tsx`) |
|---|---|---|
| 1ª | Agenda (calendário) | Agenda (`CalendarDays`) |
| 2ª | **Dashboard** (barras) | **Conversas** (`MessageCircle`) |
| 3ª | **Mais** (engrenagem) | **Dashboard** (`BarChart2`, `placeholder: true`) |

O protótipo **inventou uma aba "Mais"** que não existe em lugar nenhum e **perdeu
a "Conversas"**, que é funcionalidade real, com badge de não lidas. A ordem também
diverge. Validar o desenho da barra aqui, do jeito que está, é validar uma barra
que não vai existir.

O que precisa ser decidido junto:

- **Três abas ou quatro?** Se "Mais" tem razão de existir (perfil, configurações,
  sair), vira a quarta — e aí o `UserMenu` do desktop e o "Mais" do celular
  precisam contar a mesma história.
- **Onde o dashboard fica na ordem.** Hoje é o terceiro no app e o segundo no
  protótipo. Se ele vira a tela de entrada do dono, é outro assunto.
- **Os ícones.** O app usa `lucide-react`; o protótipo tem SVGs desenhados à mão
  dentro do componente `Icon`. Ao portar, o desenho tem que bater com o ícone
  correspondente do lucide, senão a barra muda de cara sozinha na integração.
- **O selo Premium.** O botão do `UserMenu` tem `Premium`; a aba do celular não
  tem nada. Ou os dois marcam, ou nenhum marca.

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
