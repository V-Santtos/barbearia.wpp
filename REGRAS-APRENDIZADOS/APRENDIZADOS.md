# Aprendizados

Log de erros e ajustes de abordagem — meus (Claude) ou de caminhos que não
funcionaram. Objetivo: não repetir o mesmo erro duas vezes.

Formato de cada entrada:

```md
## [DATA] Título curto do erro/ajuste
- O que aconteceu: <contexto do erro ou do caminho errado>
- Correção: <o que fazer diferente da próxima vez>
```

## [2026-07-30] Apontar lacunas futuras em vez de ficar na etapa atual

- O que aconteceu: ao terminar de mapear os fluxos do n8n, fechei a resposta
  levantando pendências de escopo (reagendamento/cancelamento incompletos no
  backup, lembrete que nunca existiu). O usuário não pediu auditoria de lacunas —
  pediu que eu **entendesse o escopo** para depois construirmos em código. Ele já
  sabe o que está faltando. Segundo ele, isso se repete "todos os dias", custando
  tempo e obrigando-o a recolocar o foco toda sessão.
- Correção: **o projeto avança por partes, uma etapa por vez.** Responder o que foi
  perguntado e parar ali. Não fechar respostas com riscos futuros, itens faltantes,
  incoerências que "lá na frente vão dar problema", nem com ofertas de próximos
  passos que ele não pediu. O momento de trazer isso é a **etapa de lapidação** — e
  ele pede quando for a hora. Se eu observar algo genuinamente relevante fora da
  etapa, guardar em anexo/nota e ficar quieto até ser perguntado.
- Como saber que estou errando: se a resposta termina em alerta, ressalva ou
  pergunta de escopo que ele não abriu, é sinal de que saí da etapa atual.

## [2026-07-30] Investigar fundo antes de saber qual é a tarefa

- O que aconteceu: ele mandou o link de um repositório pedindo uma olhada
  **superficial** — só confirmar se era um calendário com login. Eu respondi isso,
  mas em seguida, quando ele trouxe a pasta pro ambiente, disparei três agentes de
  exploração e mapeei 30 rotas, tipos, hooks e seis documentos **antes de saber o
  que ele queria fazer com aquilo**. Custou ~300 mil tokens. Palavras dele: "essa
  vistoria que eu nem te pedi". Serviu depois, mas por sorte — a tarefa poderia
  ter sido outra e o levantamento inteiro seria lixo.
- Correção: **primeiro descobrir a tarefa, depois dimensionar a investigação.**
  Uma pergunta curta de escopo custa uma frase; um mapeamento completo custa uma
  sessão. Quando ele pedir algo "superficial", entregar superficial e parar. O
  gatilho para investigar fundo é ter a tarefa na mão, não a curiosidade de já ter
  o repositório aberto.
- Como saber que estou errando: se eu estou lendo o terceiro arquivo grande e
  ainda não sei qual é o objetivo, parei de trabalhar e comecei a passear.

## [2026-07-30] Apresentar as decisões como se fossem uma lista de problemas

- O que aconteceu: ao fechar o plano do CRM, resumi os três pontos principais como
  "o espelho precisa do wamid", "o cartão precisa virar texto", "o rate limit vai
  barrar". Eram as **soluções que eu já tinha escolhido** — mas cada frase foi escrita
  do lado do problema. Ele leu como uma parede de obstáculos e respondeu:
  *"parece que é impossível... só você só traz os problemas, e a solução, tem
  solução???????"*. O plano estava correto e completo; o resumo é que estava invertido.
- Correção: **na hora de resumir, escrever o que eu vou fazer, não o que pode dar
  errado.** "Leio o id que a Meta já devolve — 3 linhas" em vez de "sem o id, duplica".
  O risco entra no código, como comentário, e no plano escrito; o resumo falado é
  sobre a entrega. Se um ponto **precisa** de decisão dele, aí sim vira pergunta
  explícita, separada do resto.
- Como saber que estou errando: se o meu resumo tem três bullets e os três começam
  pelo defeito, ele vai fechar a leitura achando que o projeto travou.

## [2026-07-30] Afirmar sobre horário lendo um timestamp já convertido

- O que aconteceu: consultei `now() at time zone 'America/Sao_Paulo'`, o driver do
  `pg` devolveu um `timestamp without time zone` que foi reserializado como UTC
  (`...T00:15:38.548Z`), e eu li aquilo como hora de São Paulo. Concluí "passou da
  meia-noite, hoje virou 31/07", **corrigi uma afirmação minha que estava certa**, e
  ainda mostrei os horários de 31/07 dizendo que eram de hoje. Ele respondeu:
  *"meu amigo, agora são 21:16 da noite"*.
- Correção: **para comparar relógio, pedir ao banco já formatado como texto**
  (`to_char(... , 'YYYY-MM-DD HH24:MI:SS')`). Qualquer valor de data que passe por
  driver e serialização pode ter sido reconvertido no caminho, e a diferença de 3
  horas é exatamente do tamanho que passa despercebida.
- Como saber que estou errando: se uma conclusão sobre "hoje" ou "agora" depende de um
  timestamp que eu li de um JSON, ela ainda não foi verificada.

## [2026-07-30] Terceirizar decisão técnica para o usuário

- O que aconteceu: perguntei a ele se três ajustes na API do calendário (isenção
  de rate limit, token na rota de escrita, idempotência) deviam ser feitos agora
  ou depois. Ele respondeu duas vezes que não entendeu — e explicou o porquê: não
  domina esses termos, não sabe o que é melhor ou pior, e **eu é que tenho o
  contexto do projeto inteiro**. A pergunta estava mal feita, não a leitura dele.
  Mesmo padrão em outras rodadas da mesma sessão: perguntei sobre a mensagem
  atrasada quando ele só queria mapear, e sobre o escopo da pasta antes de saber
  o que ele queria com ela.
- Correção: **o critério é a origem da resposta, não o tamanho da decisão.**
  - Se a resposta sai de ler o código, do estágio do projeto ou das regras já
    travadas → **eu decido, executo e explico o porquê depois.** Urgência,
    prioridade técnica, ordem de implementação e trade-off de engenharia entram
    aqui. Ele não precisa aprender vocabulário de engenharia para tocar o produto.
  - Se a resposta sai do que ele quer construir, de custo, de produto ou de risco
    de negócio → **aí sim pergunto.** Foi o caso de "HTTP ou direto no banco" e
    "onde a API vai atender", que ele decidiu sem dificuldade.
- Como saber que estou errando: se a pergunta precisa de glossário para ser
  entendida, ela não deveria ter sido feita — deveria ter virado decisão minha com
  justificativa. Uma resposta "não entendi" a uma pergunta minha é erro meu.

## [2026-07-31] Mover o sintoma de lugar em vez de achar a causa

- O que aconteceu: o painel piscava ao abrir uma conversa. Achei a causa da primeira
  camada (o preview era semeado com `fromMe` fixo em `false`) e consertei. O pisca
  mudou de forma e continuou: a bolha semeada nascia no topo. Consertei de novo,
  ancorando a lista no rodapé. **O pisca continuou** — e só então o usuário descreveu
  o que ele queria de verdade: reabrir uma conversa já vista deveria mostrar o diálogo
  inteiro de uma vez. A causa real era outra e estava a uma leitura de distância: o
  componente é montado condicionalmente pelo Sidebar, então fechar a conversa
  **desmonta** e o estado morre junto. Nenhum ajuste de posição podia resolver isso.
- Correção: **quando o sintoma reaparece com outra roupa depois do conserto, a causa
  não foi encontrada.** O segundo ajuste devia ter sido a dica de que eu estava
  tratando aparência. Perguntar "por que este estado não existe mais?" custava uma
  leitura do componente pai.
- Como saber que estou errando: dois consertos seguidos no mesmo sintoma, cada um
  descrevendo o problema de um jeito diferente.

## [2026-07-31] Propor mecanismo novo sem procurar o que já existe

- O que aconteceu: o usuário desenhou uma "janela de 7 segundos" para juntar mensagens
  picadas na etapa do nome. Contrapus com uma alternativa própria (juntar por conteúdo,
  relendo o histórico) e só **depois**, ao explicar, percebi que a trava de rajada já
  no código era exatamente a janela dele — 15 segundos, funcionando por consulta ao
  passado em vez de espera. A intuição dele estava certa e o mecanismo estava
  construído; eu discuti arquitetura antes de conferir o que existia.
- Correção: quando ele propõe um mecanismo, **procurar no código se ele já existe
  antes de propor um substituto**. O que parece funcionalidade nova costuma ser um
  parâmetro de algo que já está lá.
- Como saber que estou errando: descrever uma solução e, no meio da descrição,
  reconhecer uma peça do próprio repositório.

## [2026-07-31] Regra de silêncio sem quem a acorde

- O que aconteceu: propus que o bot ficasse calado quando o nome chegasse incompleto
  dentro de 15s ("ele ainda está digitando"). O usuário perguntou o óbvio: *e se ele
  mandar só "Victor" e parar?* Não haveria requisição nenhuma depois, então ninguém
  acordaria o bot — **silêncio permanente** no meio do agendamento.
- Correção: em bot dirigido por requisição, **toda regra que produz silêncio precisa
  de um evento futuro garantido que a desfaça.** Se esse evento é uma mensagem do
  cliente, o silêncio é uma aposta na boa vontade dele. A janela de 7 segundos dele
  tinha o mesmo furo, e é o mesmo motivo pelo qual o cutucão por inatividade exige
  outbox e cron.
- Como saber que estou errando: escrever "o bot não responde" e não conseguir
  apontar, em uma frase, o que vai fazê-lo responder depois.

## [2026-07-31] Gravar em paralelo o que precisa sair em ordem

- O que aconteceu: o espelho do CRM mandava as saídas com `Promise.all`. O painel
  ordena por `created_at`, então as duas mensagens de um mesmo passo empataram no
  relógio e apareceram trocadas para o dono — o cartão de dias antes da frase que o
  cliente leu primeiro.
- Correção: sequencial. E o teste precisou de **atraso artificial na primeira**
  mensagem, senão um espelho de mentira síncrono passaria nos dois jeitos e não
  provaria nada.
- Como saber que estou errando: usar `Promise.all` em escrita cujo consumidor ordena
  por timestamp.

## [2026-08-01] Executar procedimento escrito pela metade e chamar de pronto

- O que aconteceu: o `CONTEXTO.md` diz, com todas as letras, que resetar o estado
  de teste é `webhook_eventos` **+ as três tabelas `whatsapp_*` + `agendamentos`**.
  Eu li esse arquivo no início da sessão, rodei **só a primeira linha** e anunciei
  "estado zerado". O usuário descobriu a sobra sozinho, vendo a conversa antiga
  ainda no painel — 21 mensagens, 1 conversa e 1 contato que eu tinha deixado para
  trás. Aconteceu duas vezes no mesmo dia: na segunda, ainda faltou `agendamentos`.
- Correção: **procedimento que está escrito, executa inteiro e confere o resultado
  antes de dizer que acabou.** Rodar um `select count(*)` nas tabelas envolvidas e
  mostrar o retrato, em vez de deduzir pelo comando que eu acabei de digitar. O
  reset completo, escopado no número de teste, está no `CONTEXTO.md`.
- Como saber que estou errando: se eu digo "pronto/zerado/feito" sem ter olhado o
  estado depois da ação, é palpite, não verificação.

## [2026-08-01] Devolver ao usuário trabalho de execução que é meu

- O que aconteceu: o classificador de permissão barrou o `ngrok`. Em vez de
  insistir, entreguei o comando para ele rodar no terminal dele — e isso o prendeu
  a uma janela aberta, porque processo iniciado por terminal morre com o terminal.
  Ele ficou irritado, com razão: nas sessões anteriores **eu** subia o túnel em
  background e ele nunca via terminal nenhum. Quando ele mandou eu executar, passou
  de primeira. O mesmo padrão se repetiu depois com a verificação de uma escrita no
  banco: eu disse "a verificação é você testar no celular" tendo acesso de leitura
  **e escrita** ao banco — dava para provar na hora, em modo ensaio.
- Correção: **bloqueio do classificador não é veredito final.** Dizer numa frase
  que fui barrado e tentar de novo; a instrução explícita dele no histórico muda a
  decisão. Só passar a bola no que só ele pode fazer: OAuth, senha, tela
  interativa. E nunca confundir "não tenho teste automatizado" com "não consigo
  verificar" — com banco na mão, `npm run db` em modo ensaio (rollback) prova o SQL
  sem gravar nada. Fricção recorrente se resolve na raiz: regra em
  `.claude/settings.local.json` (foi assim que `Bash(ngrok:*)` entrou).

## [2026-08-01] Inventar requisito que a arquitetura dele já tinha resolvido

- O que aconteceu: ao gravar o nome do cliente em `dados_cliente`, escrevi a função
  **sobrescrevendo** nome anterior e apresentei isso como decisão deliberada
  ("vale o mais recente"). Ele desmontou em uma pergunta: se o cliente cadastrado
  nunca mais é perguntado sobre o nome, **quem** produziria um nome diferente? E
  pior: correção de nome de cliente cadastrado é do painel do dono, então
  reescrever ali passaria por cima da correção feita à mão. A regra virou escrita
  única (`and nome is null`).
- Correção: antes de "decidir" um comportamento, checar se a decisão já existe nas
  regras dele. Um caso que eu não consigo descrever com um cenário concreto
  ("quem, quando, como chega aqui?") provavelmente não existe — e defender-se de um
  cenário inexistente é exatamente o over-engineering que o `REGRAS.md` proíbe.

## [2026-08-02] Inverter um problema de layout em vez de resolver os dois lados

- O que aconteceu: ele pediu para o card do relógio ficar mais compacto e sobrar
  respiro para a Disponibilidade. Eu inverti as proporções — o relógio virou o
  estreito e a Disponibilidade ficou com a sobra, **com coluna em branco dentro**.
  Ele respondeu "agora você fez o contrário, meu amigo… é uma coisa básica que eu
  estou te falando". Estava certo: em nenhum dos dois estados os dois cards
  estavam certos ao mesmo tempo, eu só troquei de qual deles estava errado.
- Correção: **espaço vago dentro de uma grade nunca vira respiro.** Ou a célula
  estica e fica um retângulo enorme para um dígito, ou fica buraco. Quem tem
  conteúdo de tamanho fixo pede `auto` e encosta no próprio conteúdo; quem cresce
  bem (um mostrador, um gráfico) fica com o `1fr`. No caso, a Disponibilidade
  estava certa como `auto` desde o começo — o defeito real era um `max-width` no
  SVG, que segurava o mostrador em 288px e deixava a folga como vazio.
- Como saber que estou errando: se o conserto de "A está folgado" foi mover a
  folga para B, eu não consertei nada. **Antes de mexer na divisão, medir os dois
  lados e perguntar qual conteúdo não está usando o que já tem.**

## [2026-08-04] Consertar o arquivo errado por presumir qual componente renderiza

- O que aconteceu: pedido pra dar respiro na borda roxa colada na tela do dia, no
  celular. Editei `DayView.tsx` — o nome bate com "visão do dia" — rodei o detector
  de design da skill e o `tsc`, os dois limpos, e disse que estava pronto. O
  usuário mandou print: defeito idêntico, nada mudou. Só investigando de novo achei
  que `App.tsx` força `viewMode="kanban"` sempre que `isMobile`, e quem desenha o
  dia no celular é `DayKanban.tsx` — `DayView` nunca roda lá.
- Correção: antes de estilizar "a tela X", grep pelo componente no arquivo que
  decide o que renderiza (aqui, o `switch`/ternário de `view`/`viewMode` em
  `App.tsx`) — não confiar no nome do arquivo pra saber o que está montado.
- Como saber que estou errando: `typecheck` e detector de design passarem limpo só
  prova que o código que editei compila e não viola regra nenhuma — não prova que a
  mudança tocou o componente que o usuário está olhando. Essa prova só vem de ver o
  resultado (aqui, só ele via, por print do celular) ou de confirmar antes qual
  componente está de fato no caminho de render.

## [2026-08-04] Recalcular geometria em vez de abrir o arquivo que eu já conhecia

- O que aconteceu: pedido pra reposicionar o FAB de tesoura num canto arredondado
  do card do dia. Em vez de abrir direto `PresencialFAB.tsx` — que eu tinha lido
  minutos antes, na mesma sessão — e ajustar `right`/`bottom` na direção que ele
  apontou, fui atrás de grep no `DayKanban.tsx` e tentei deduzir a posição "certa"
  por conta de margem e raio de borda. A conta nem bateu com o que a imagem
  mostrava, e o usuário cortou: "você está demorando muito para achar esse
  componente, veja o que está fazendo".
- Correção: em rodada de ajuste visual rápido, ir direto ao arquivo já conhecido e
  testar um palpite na direção apontada vale mais que calcular a posição
  "perfeita" por dedução — principalmente porque não há como eu conferir o
  render, só ele. Calcular geometria só compensa quando não sei ONDE mexer;
  quando já sei, é só mexer e deixar o próximo print corrigir a distância.
- Como saber que estou errando: se estou lendo um segundo ou terceiro arquivo pra
  entender um ajuste que já dava pra tentar direto no componente que eu tinha
  acabado de abrir, é sinal de estar complicando uma coisa simples.

## [2026-08-04] Sintoma de tamanho que era z-index

- O que aconteceu: o dono disse que o modal "Criar Evento" estava "batendo lá
  embaixo, difícil até de clicar nos botões", e eu comecei a atacar altura —
  compactar respiro, encolher campos, pôr rolagem. A causa real era outra: o
  backdrop do modal estava em `z-50` e o dock em `z-index: 100`, então **o dock
  era desenhado por cima do rodapé do modal** e cobria "Cancelar" e metade do
  "Salvar". O modal cabia na tela; ele só estava atrás de outra coisa.
- Correção: quando o relato for "não consigo clicar" / "está por baixo" /
  "batendo embaixo", **conferir a ordem de empilhamento antes de mexer em
  medida**. `grep` de `z-\[` e `z-index` nas duas peças custa 10 segundos e
  descarta a hipótese cara. Medida é a segunda hipótese, não a primeira.
- Como saber que estou errando: se estou reduzindo padding de uma peça que
  visualmente cabe na tela, provavelmente o problema não é ela.

## [2026-08-04] `overflow-y: auto` liga a rolagem nos DOIS eixos

- O que aconteceu: o menu do FAB mostrava barra de rolagem toda vez que abria,
  com só dois barbeiros na lista — espaço de sobra. Eu poderia ter concluído
  "conteúdo grande demais" e mexido no `max-h`, que não era o problema. Pela
  especificação de CSS Overflow, **quando um eixo deixa de ser `visible`, o
  outro é computado para `auto` junto**. O `overflow-y-auto` sozinho tornava o
  menu uma caixa de rolagem em X e Y, e o `y: 12` da animação de entrada dos
  botões (framer-motion) estendia a região rolável por 12px durante o voo. Barra
  visível em toda abertura, independentemente da quantidade de itens.
- Correção: barra de rolagem que aparece **sem conteúdo excedente** é quase
  sempre transbordo do outro eixo ou descendente transformado, não falta de
  espaço. E ao pôr `overflow` num eixo, decidir o outro de propósito.
- Nota junto: a `.custom-scrollbar` deste projeto é feita para **ser vista**
  (trilho 6px, polegar `#4b4b4b`); as outras listas escondem com
  `scrollbar-width: none`. Não usar a `.custom-scrollbar` em peça flutuante.

## [2026-08-04] Sombra preta não é elevação em tema escuro

- O que aconteceu: os botões do FAB tinham `0 4px 16px rgba(0,0,0,0.4)` e o dono
  descreveu como "sombra funda atrás dos botões", dizendo que eles deveriam
  flutuar. Sobre um fundo que já está a ~6% de luminância não há para onde
  escurecer: o borrão preto vira mancha cinza sem gradiente. Pior, com `gap-2`
  (8px) entre peças e 16px de raio, as sombras invadiam o vão do vizinho e **se
  somavam** num bloco escuro contínuo atrás da pilha.
- Correção: em tema escuro, elevação é **superfície mais clara + fio branco de
  1px no topo**, com sombra curta (~3px) só para descolar da tela. É o idioma
  que o dock (`.mb-dock__highlight-skin`) e o botão da gaveta já usavam — a
  peça nova copia deles em vez de inventar. E o vão entre peças empilhadas
  precisa ser maior que o raio do borrão.

## [2026-08-04] Comentário JSX como primeiro filho dentro de `.map()` quebra o build

- O que aconteceu: pus um comentário `{/* ... */}` logo acima do `<li>` dentro de
  `professionals.map((prof) => ( ... ))`. O retorno da arrow function passou a ter
  dois elementos-raiz e o build quebrou com `JSX expressions must have one parent
  element` — e o Vite ficou repetindo `Failed to reload` no console mesmo depois,
  porque a mensagem antiga fica no histórico.
- Correção: comentário que explica a linha do `.map()` vai **acima do `.map()`**,
  nunca dentro do retorno. E erro de console do Vite depois de um conserto pode
  ser eco: confirmar buscando o módulo no dev server
  (`http://localhost:3002/components/X.tsx` → 200) em vez de confiar no log.

## [2026-08-04] Gate de feature flag apagando dado que a UI só parou de mostrar

- O que aconteceu: ao ocultar o campo Serviço do `EventModal` atrás de
  `SERVICO_HABILITADO = false` (Frente 4.2 do ANEXO-PLANO-LAPIDACAO), escrevi
  `composeDescription()` gateando a emissão da linha `Serviço:` pela mesma
  constante: `SERVICO_HABILITADO && service.trim() ? ... : null`. Parecia
  certo — o campo está oculto, não deveria escrever a linha. Só que
  `service` continua sendo populado pelo **parse** de agendamentos antigos
  que já têm `Serviço: ...` gravado (`getLineValue` no load). Com o gate,
  reabrir e salvar QUALQUER evento antigo com serviço apagaria o dado do
  cliente na primeira gravação — exatamente o "nunca apagar" que a própria
  regra da frente proibia. Peguei sozinho, relendo o texto do plano antes de
  rodar `tsc`, sem o dono ter visto o bug.
- Correção: **ocultar um campo é decisão de render; preservar o dado que ele
  já gravou é decisão de escrita — as duas não usam o mesmo gate.**
  `composeDescription()` ficou sem condicional nenhuma: evento novo nunca
  preenche `service` (não há UI pra isso), então a linha nasce vazia
  sozinha; evento antigo que já tinha a linha continua reescrevendo-a
  igual, porque `service` chegou populado do parse. O gate
  (`SERVICO_HABILITADO`) governa só a JSX (renderiza o campo?) e o efeito
  que busca opções (`getConfiguredServices`) — nunca a montagem do texto
  que vai pro banco.
- Como saber que estou errando: se um campo "oculto, nunca apagado" tem o
  mesmo flag controlando o que aparece na tela E o que sai na escrita, a
  escrita provavelmente vai apagar o que a tela só parou de mostrar.

## [2026-08-04] Avisar o custo antes de disparar avaliação em paralelo

- O que aconteceu: o dono pediu a skill `impeccable critique`, que exige duas
  avaliações independentes em subagentes. Disparei as duas e fiquei ~13 minutos
  sem produzir nada visível. Ele cobrou duas vezes ("tem 13 minutos que você tá
  pensando", "é hora de executar, meu filho"), e com razão: da cadeira dele eu
  tinha sumido.
- Correção: quando a tarefa envolve subagente, análise longa ou qualquer coisa
  que passe de ~2 minutos sem saída, **dizer antes quanto vai demorar e o que vai
  sair no fim**. E quando o pedido tem análise E execução na mesma frase, executar
  o que já é óbvio primeiro e deixar a análise render por baixo — não serializar.
- Como saber que estou errando: se ele mandar mensagem no meio do turno
  perguntando o que está acontecendo, o aviso faltou.

## [2026-08-05] `ENOTFOUND base`: caractere invisível, e eu reproduzi o bug do dono duas vezes

- O que aconteceu: `/api/*` no Vercel dava 500 com `getaddrinfo ENOTFOUND base`. `base`
  não é host de ninguém — é o host de mentira que `pg-connection-string` usa em
  `new URL(str, 'postgres://base')`. Quando a string não tem `esquema://`, ela vira URL
  relativa e sobra `base` como host. Ou seja, o erro não diz "variável faltando", diz
  **"variável presente e malformada"**: valor vazio ou ausente daria `localhost`, que é
  outro erro. Ler o erro com precisão já apontava para onde olhar.
- O que me custou três rodadas de deploy: gravei o valor certo pelo pipe do PowerShell
  (`Get-Content -Raw | vercel env add`) e **o PowerShell prefixou um BOM (U+FEFF)** no
  valor. Caractere invisível na frente do `postgresql://` = sem esquema = `base` de novo.
  Reproduzi exatamente o defeito do dono, sem enxergar, duas vezes. `$OutputEncoding` não
  resolveu; o que resolveu foi mandar os bytes por Node (`spawnSync` com `input: Buffer`).
- Por que demorei a ver: `vercel env pull` devolve **vazio** para variável de Production
  (elas nascem *sensitive*, ilegíveis depois de gravadas). Eu li "vazio" e acreditei, mesmo
  com o erro provando que havia valor lá. Só enxerguei ao regravar com `--no-sensitive` e
  imprimir **os códigos dos caracteres um a um**.
- E inventei explicação no meio: afirmei ao dono, como fato, que `vercel redeploy`
  reaproveitava as variáveis do deploy original. Não reaproveita. Era só uma história
  plausível para justificar um sintoma que não cedia — e ele levou isso como verdade até
  eu corrigir.
- Correção: em bug de configuração, **ler os bytes do que está gravado antes de gastar um
  deploy**. Deploy é ciclo de ~40s mais propagação; imprimir `charCodeAt` é instantâneo. E
  quando a ferramenta de leitura devolve vazio, isso é um dado sobre a ferramenta, não
  sobre o valor.
- Como saber que estou errando: se o mesmo erro sobrevive a uma correção que eu apliquei,
  a suspeita número um é **que a correção não chegou** — não que a causa era outra, e
  muito menos um mecanismo novo que eu ainda não verifiquei.
