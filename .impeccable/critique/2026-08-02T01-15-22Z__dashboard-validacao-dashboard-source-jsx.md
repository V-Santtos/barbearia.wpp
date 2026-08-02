---
target: Dashboard do dono (desktop)
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-02T01-15-22Z
slug: dashboard-validacao-dashboard-source-jsx
---
Método: dual-agent (A: revisão de design · B: detector + evidência de navegador), isoladas, sem verem a saída uma da outra.

## Nota de saúde do design

| # | Heurística | Nota | Questão-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 2 | Chip ativo e "atualizado há 24s" existem; o chip governa 4 dos 8 blocos e nada marca a fronteira. Sem estado de carregando, erro ou dado velho. |
| 2 | Sistema ↔ mundo real | 3 | Vocabulário de barbearia acertado (encaixe, vaga, folga, bloqueio). Escorrega em "Ocupação 78%" e quebra a data: `capitalize` produz "Terça-Feira, 20 De Maio". |
| 3 | Controle e liberdade | 2 | Nada é destrutivo porque nada é acionável. O menu de profissional não fecha no `Esc` nem devolve o foco. |
| 4 | Consistência e padrões | 2 | Dois segmentados com desenhos diferentes; `calendar` em três papéis; opacidade comunicando estado contra regra travada; raio 16px contra 24px do spec. |
| 5 | Prevenção de erro | 1 | Três respostas diferentes para "quantos horários livres hoje" na mesma tela. Uma célula com três significados. |
| 6 | Reconhecer > lembrar | 1 | Capacidade diária de cada barbeiro, significado de célula vazia e escopo do chip: os três moram fora da tela. |
| 7 | Flexibilidade e eficiência | 1 | Nenhum atalho, nenhuma linha clicável, nenhum estilo de foco próprio em todo o CSS. |
| 8 | Estética e minimalismo | 2 | Quatro ladrilhos de ícone decorativos, quatro ícones de painel decorativos, degradê invisível, data escrita três vezes acima da dobra. |
| 9 | Diagnosticar e recuperar erro | 1 | Não existe estado de erro. O único vazio é "Nada por aqui.", que não diz o que fazer. |
| 10 | Ajuda e documentação | 1 | O `title` do hover é a única ajuda, e é o canal mais frágil que existe. |
| **Total** | | **16/40** | **Poor — a UX precisa de reforma, não de polimento** |

A nota é mais baixa que a impressão visual sugere, e isso é informação: o acabamento gráfico está bem acima de 16/40. Heurística mede comportamento, não polimento. Boa parte do que puxa para baixo (3, 7, 9) destrava sozinho quando a tela virar app de verdade — mas 5, 6 e 10 são de desenho, e essas não se consertam com fiação.

## Veredito de especificidade

**Composição genérica, conteúdo autoral.**

O esqueleto é o output padrão de qualquer template de dashboard: topbar com logo + breadcrumb + lupa + avatar, título com chips à direita, faixa de quatro cards iguais com ladrilho de ícone arredondado, split de duas colunas. Troque "Agendamentos" por "Tickets" e "Lucas Costa" por "Squad A" e você tem um helpdesk. A especificação de origem antecipou o risco na terceira linha — "sem virar um template SaaS generico" — e o build ficou do lado errado da linha.

O que é autoral existe e é bom: o vocabulário, a borda irregular da faixa de disponibilidade nascida da janela que cada barbeiro configurou, a recusa disciplinada de setas de tendência e donut. Mas tudo isso vive no **conteúdo**, não na **composição** — e autoria de conteúdo não sobrevive a um print.

**Scan determinístico.** 6 achados no CLI sobre `Dashboard/` (2 no alvo pedido). No navegador: 55 achados em 52 elementos no desktop (50 de produto, 5 de moldura) e 43 em 41 no mobile (37 de produto). O maior grupo é `undersized-ui-text`: 35 ocorrências no desktop, 20 no mobile. Depois `nested-cards`: 6 e 8. `overused-font` marca Inter em 99% do texto do desktop e 100% do mobile — Inter em tudo é o tell nº 1 de UI gerada por IA, e o detector viu o que a revisão não citou.

## Impressão geral

A tela está bem desenhada e mal hierarquizada. Cada peça isolada é competente; juntas, todas têm o mesmo peso, e por isso a tela não tem pergunta principal.

A maior oportunidade é uma só, e não é cor: **separar visualmente "resumo" de "trabalho"**. Hoje os quatro KPIs e os três painéis usam o mesmo fundo, a mesma borda, o mesmo raio e a mesma sombra. A distinção que mais importa — número agregado que obedece ao chip versus painel operacional que ignora o chip — é a única que não tem forma.

## O que está funcionando

1. **O vocabulário é de barbearia, não de dashboard.** "Encaixe", "vaga", "folga", "bloqueio". O dono lê uma vez e nunca mais traduz.
2. **A borda irregular da faixa de disponibilidade.** Costa acaba em "ter 27", Eloi segue até "qui 29", e o vazio não é preenchido com célula morta. Afirma a verdade: a janela é configuração do barbeiro, não do sistema.
3. **A cor de identidade em posição fixa e nunca sozinha.** Barra na margem + ponto antes do nome, sempre no mesmo lugar, sempre com o nome escrito ao lado. Canal duplo por construção.

## Problemas prioritários

### P0 — Três números diferentes para "horários livres hoje", na mesma tela
KPI diz 14 ("de 23 horários no dia"). A Disponibilidade, 40px à direita, soma 3+6 = 9 para hoje. `OCUPACAO_HOJE` implica 6. E "Próximos horários livres" diz que o segundo encaixe do Costa é Amanhã 09:00, enquanto a célula "hoje" dele diz 3 vagas.
**Por que importa:** o protótipo existe para decidir se esses números merecem ser construídos. Duas respostas para a mesma pergunta destroem a confiança na tela inteira, e desconfiança não é reversível.
**Conserto:** derivar tudo de uma fonte só no mock — `VAGAS` × `AGENDA_CONFIG.capacidade` produz `slotsLivres`, o "de N horários" e o `proximosLivres`.

### P1 — Célula de disponibilidade muda, três significados, explicada só no hover
`folga`, `bloqueio` e `fora da janela` renderizam pixels idênticos. No mock há duas dessas células adjacentes com significados opostos. Viola as duas regras travadas do projeto no exato painel para o qual elas foram escritas. O componente `CelulaDispo` já aceita a prop `rotulo` que resolve — ela só não é passada no desktop.

### P1 — O chip de período governa metade da tela sem marcar a fronteira
O mobile resolveu isso; o desktop ficou para trás com o chip no cabeçalho da página.

### P2 — Contraste reprovado em texto pequeno, e a causa não é o token que se suspeitava
Sete classes reprovam no desktop, seis no mobile. `--text-muted` (.55) **passa** com folga (6,08:1). Quem reprova é `--text-faint` (.32) a 2,91:1 e uma família de alfas fora do token set (.30, .34, .36, .38, .42) hard-coded no CSS.
**Conserto:** piso de .55 para qualquer texto ≤12px; `--text-faint` deixa de ser cor de texto e vira só cor de borda.

### P2 — Alvos de toque: 12 de 12 controles do desktop abaixo de 44×44
Botões de ícone 32×32, abas 22px de altura, chips 27px, filtro 34px. No mobile, 4 de 9 reprovam. O dock inferior é o único controle do protótipo inteiro que atinge o mínimo.

### P2 — Opacidade comunicando estado na agenda, contra a regra travada
`.is-done` derruba a barra de identidade para 40%. Na aba "Linha do tempo" as barras dos dois barbeiros ficam quase indistinguíveis: a cor de identidade degrada exatamente onde a lista é maior.

## Propostas — os três eixos

### a) Cards de KPI

O ladrilho arredondado ocupa 18,6% da largura do card no desktop e ~30% no mobile, e carrega zero informação. É o clichê mais reconhecível de UI gerada por IA. O rótulo, que é o que identifica o card, é o texto menos legível dele.

- **A1 "Métrica nua" (recomendada):** sai ladrilho e ícone; três linhas alinhadas à esquerda; rótulo 13px/500 branco/70 sem caixa alta; valor 34px/600; subtítulo 11px/55%. Identidade vira régua de 3px no topo. E a faixa sai da linguagem visual dos painéis: sem borda, sem sombra, só `rgba(255,255,255,.03)`.
- **A2 "Faixa 1+3":** um card grande para Novas marcações, os outros três viram linhas de estatística sem caixa própria.
- **A3 "Sem cards":** uma linha corrida de texto. O mais autoral, o mais arriscado.

Pílula: **não.** A tela já usa pílula para estado e para horário; reusar a forma para número quebraria a única gramática de forma consistente que ela tem.

### b) Cabeçalho dos painéis

Causa medida do "falta alguma coisa": o centro óptico do ícone cai em y=486,2; o título centra em 478,2 e o subtítulo em 496,2. **O ícone está centralizado no vão entre as duas linhas** — não alinha com nenhuma. É geometria, não gosto.

- **B1 "Ícone fora, título forte" (recomendada):** remove o ícone; título sobe para 15px/650; o subtítulo vira contagem na mesma linha. 36px de altura devolvidos.
- **B2 "Barra colorida":** barra vertical de 3px com a altura exata do par título+subtítulo, abraçando as duas linhas.
- **B3 "Ícone fica, ancorado":** alinha pela primeira linha do título, 15px, branco/55, e troca o vocabulário para não colidir.

Regra por trás: **se a linha não muda quando o dado muda, ela não é subtítulo, é documentação — e documentação não mora no cabeçalho.**

### c) Disponibilidade

- **C1 "Grade única com capacidade escrita" (recomendada):** um eixo de datas só, barbeiros como colunas, nome no cabeçalho uma vez, `rotulo` ligado também no desktop. E a célula ganha duas linhas: número em 16px e, embaixo, `de 9` / `de 13`. A capacidade diferente vira **denominador escrito**, não escala de cor.
- **C2 "Resposta em texto":** cada dia é uma frase — "Costa 3 · Eloi 6", "Costa cheio · Eloi 1".
- **C3 "Medidor ancorado na capacidade":** medidor de traços cujo número de segmentos É a capacidade.

Em qualquer das três: **o `0` deixa de ser âmbar** e vira `cheio`. Hoje o único acento cromático do painel aponta para a boa notícia como se fosse problema, e âmbar já significa "Reagendado" no painel colado.

## Red flags por persona

**Alex (avançado):** clica "30 dias", a lista não muda, conclui que o filtro quebrou. Zero regras de foco próprias. O menu de profissional não fecha no `Esc`. Nada é clicável — a tela informa e para.

**Sam (acessibilidade):** sete classes abaixo de 4,5:1, incluindo o rótulo que nomeia cada KPI. `title` como único portador de significado. `role="tablist"` sem `tabpanel` nem `aria-controls`. Três animações infinitas sem `prefers-reduced-motion`. Acerto a preservar: a cor do barbeiro nunca é o único canal.

**Casey (celular):** o ladrilho come ~30% da largura e quebra o subtítulo em 2–3 linhas, deixando a grade 2×2 com quatro alturas diferentes. O dock cobre a linha sendo lida durante a rolagem. "bloqueio" sai em 9,5px a 36% de branco.

## Observações menores

- A data aparece três vezes acima da dobra.
- `--kpi-grad` é invisível no render.
- CSS morto: `.kpi--alerta`, `.db-pill`, `.oribadge`, `.db-linkbtn`, `.db-navbadge`.
- `janelaVisivel` é calculado em `Desktop` e em `Mobile` e nunca usado.
- **Acoplamento invisível:** a altura da agenda vem da coluna da direita. Filtrar um barbeiro encurta a Disponibilidade e, por tabela, encurta a lista de atendimentos.
- A coluna "hoje" está marcada pela metade: só o cabeçalho recebe o roxo.
- `h1` "Dashboard" salta direto para `h3` "Agenda de hoje".
- `transition: width` em `.mb-bars__fill` anima layout em vez de `transform`.

## Perguntas

1. Se ele só pudesse ver uma coisa entre um corte e outro, qual das quatro regiões sobrevive?
2. "Ocupação 78%" muda alguma decisão dele?
3. Depois de ver "Hoje 18:30 livre", qual é o próximo gesto?
4. Por que Disponibilidade e "Próximos horários livres" são dois painéis?
5. O chip de período existe porque ele pediu, ou porque dashboard tem chip de período?
