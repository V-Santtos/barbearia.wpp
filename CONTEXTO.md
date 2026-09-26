# CONTEXTO.md

Memória curta do estado atual. Leia este arquivo ao retomar uma sessão e depois siga
o `AGENTS.md` da pasta em que vai trabalhar.

Decisões duráveis ficam em `REGRAS-APRENDIZADOS/`; avaliações de conhecimento
externo ficam em `docs/skills-log.md`. Histórico concluído não deve voltar para cá.

## Foco do projeto nesta cópia

Este checkout é uma casca desatualizada em relação ao repositório operado pelo dev.

- **Prioridade:** visual, design e organização de `CALENDARIO/`.
- **Contexto secundário:** ler o mínimo de `BARBEARIA/` para entender domínio,
  rotas e contratos antigos.
- **Fora de escopo por padrão:** API, backend, banco e Supabase. O dev conduz essa
  frente no repositório atual.
- O Supabase desta cópia está indisponível; `VITE_MOCK=1` permite continuar o
  trabalho visual sem rede.

## Grades de agendamento — rodada de 2026-09-21

Rodada de legibilidade das tarjas, do dono, tela a tela. Decisões duráveis em
`REGRAS-APRENDIZADOS/REGRAS.md` (duas entradas de 2026-09-21); armadilhas em
`APRENDIZADOS.md`.

### Onde mora o quê

- `components/agenda/TarjaDeEvento.tsx` — a tarja de Semana e Mês, e o único lugar dos
  limiares de `@container`. `ancora="hora"` (Mês, alinhado à esquerda) ou `"nome"`
  (Semana, centralizado).
- `components/agenda/FolhaDoDia.tsx` — a página do dia no celular.
- `lib/empilhamento.ts` — empilhamento por célula de hora, da Semana.
- `lib/sobreposicao.ts` — agrupamento por colisão, do `DayView`.

### Semana (desktop e celular, um componente só)

Tarja de altura única (22 px), só o nome, centralizado. A linha dentro da célula é a
metade da hora. Continuação apagada na célula seguinte para quem atravessa a hora.
Teto de 3 por célula, excedente vira `+N` que abre o `DayEventsPopover`.
Verificado: 24 agendamentos + 7 continuações, 0 sobreposições, topos múltiplos de 24.

### Mês

Desktop: `HH:MM – Nome`, alinhado à esquerda, hora em 10 px e nome em 11 px, **por
estilo inline** (ver o aprendizado do `font: inherit`). Até 4 tarjas por célula; acima
disso, 3 + botão `+N` do tamanho de uma tarja. Sigla do dia é linha própria acima da
grade. Verificado: 0 tarjas cortadas.
Celular: inalterado por decisão — só a hora, 14 px de altura, sigla dentro da célula.

Espaço recuperado para caber a quarta tarja: cabeçalho `pt-11` → `pt-5` e moldura da
seção `lg:pt-8` → `lg:pt-4`, +40 px de altura útil.

### Folha do Dia (celular)

Tocar em qualquer ponto da célula do Mês abre. Tarjas do Mês no celular não recebem
toque. `EventModal` abre por cima e, ao fechar, devolve o dia — não o mês.

### Ainda em aberto

- O reset `button, input, textarea { font: inherit }` em `index.css:161` está fora de
  `@layer` e desativa utilitários de fonte em **todo botão do app**. Contornado só no
  calendário. Consertar na origem é rodada própria.
- `DayView` no desktop herdou as correções (grupo de colisão e tamanho inline), mas não
  passou por revisão visual do dono.
- **Lapidar os cards do Kanban diário** (`components/DayKanban.tsx`) — pedido do dono em
  2026-09-21, para uma rodada própria. Ele não apontou defeito: quer uma avaliação de
  se o card expansível (nome + hora, e ao abrir serviço, profissional, faixa de horário,
  editar e "Marcar como feito") está na melhor forma que o app já sabe fazer, agora que
  Semana, Mês e Folha do Dia passaram pela lapidação. Entregar como sugestão antes de
  mexer.

## Estado atual do calendário — 2026-09-15

### Casca desktop

Agenda, Conversas, Dashboard e Financeiro são seções irmãs. A coluna esquerda
recolhe para 64 px e expande para 240 px. A casca desktop usa a variante
**inset** da referência: coluna no plano externo `#141414`, área de trabalho com
8 px de respiro, raio de 12 px e borda sutil.

- `+ Criar` existe em um único lugar: a coluna.
- O nome `Barber` usa Aclonica Regular (400), carregada localmente via
  `@fontsource`; o restante da interface continua em Inter.
- A lista `Profissionais` da gaveta e os filtros do Kanban usam o mesmo
  `NeonCheckbox`, com a cor de cada profissional; na gaveta ele mede 18 px e no
  Kanban, 20 px, acompanhando a densidade de cada região.
- `components/shell/secoes.ts` registra as seções.
- `ColunaDeSecoes.tsx` desenha navegação e ação primária.
- `ControleDaColuna.tsx` desenha a barra superior: recolher/expandir, busca
  contextual e, à direita, a **conta** — engrenagem e avatar, nessa ordem.
  A faixa tem 48 px; na casca inset, os 8 px externos devolvem o respiro que
  antes era fabricado aumentando a altura. O `pr` copia o `px` da linha desktop
  do `CalendarHeader`, para o avatar cair na mesma vertical do "Mês". A linha
  divisória atravessa a superfície inteira.
- `GavetaDeSecao.tsx` contém o contexto lateral da seção.
- Agenda permanece montada ao trocar de seção para preservar data, modo e rolagem.
- Dashboard e Financeiro são seções de verdade dentro da moldura comum.
- O avatar saiu do `CalendarHeader` no desktop (subiu para a barra) e continua
  lá no celular, em 44 px. Na barra ele entra `compacto`, 32 px — em 36 ele
  encostava na divisória da faixa de 48 px (2026-09-21).
- `MolduraDeSecao.tsx` é a moldura comum das seções: respiro de 24 px, título e
  linha de apoio opcionais por fora, e o conteúdo dentro de uma pílula
  (raio 24 px, borda branca 8%). Conversas e Dashboard usam a mesma.

Decisões duráveis da casca já estão em
`REGRAS-APRENDIZADOS/REGRAS.md` (entradas de 2026-09-08).

### Ícones, avatar e tema — 2026-09-08

O conjunto de ícones da coluna passou a ser o do template shadcn **com os
números dele**: 16 px, traço 2, sem variação de traço entre ativo e inativo
(`Calendar`, `MessageSquare`, `LayoutDashboard`, `Banknote`, `CirclePlus`).
A regra anterior — preferir a variante redonda — foi revertida com o dono e o
motivo está em `REGRAS.md`: a leveza da referência vem de tamanho pequeno, não
de traço fino. O contraste ativo/inativo mora só na cor.

O avatar mostra a marca `MarcaHubBarber` quando não há foto, e a foto do
Supabase cai para ela via `onError` (nesta cópia o Supabase está fora, então é
sempre a marca). As iniciais saíram.

O menu do avatar ficou: Ver perfil · Dashboard · **Tema** · Sair. A engrenagem
saiu dele. O tema alterna `<html data-tema>` e persiste no `localStorage`;
`index.css` redefine os tokens de cor em `[data-tema="claro"]`.

**O claro está incompleto de propósito e por enquanto sai manchado:** só vira o
que usa token. Cor escrita à mão (`bg-[#191919]`, `text-white/55`, os CSS do
dashboard) continua escura. A varredura espera a paleta aprovada pelo dono —
marcada com `ponytail:` no `index.css`.

### Modal Ver perfil — 2026-09-09

`ProfileModal.tsx` segue a geometria aprovada em `AgendaSettingsModal.tsx`:
largura máxima de 512 px, raio externo de 16 px e controles internos de 8–10 px.
Com os três profissionais atuais, todo o conteúdo aparece sem rolagem. Em tela
menor ou equipe maior, somente o corpo geral do modal rola, com trilho
transparente e polegar discreto; não existe mais uma barra branca aninhada na
lista de profissionais. O avatar permanece circular por função e caiu para
80 px; sem foto, ele usa o mesmo SVG `MarcaHubBarber` do menu da conta.

### Kanban diário — 2026-09-09

No card expandido, `Marcar como feito` deixou de ser um CTA largo e brilhante.
Agora é uma ação operacional compacta, alinhada à direita, com superfície neutra,
raio de 8 px e altura de 44 px. A cor do profissional aparece somente no ícone de
check; não há gradiente nem sombra. O texto permanece em uma linha mesmo nas
colunas mais estreitas.

### Conversas desktop

`components/conversations/ConversasDesktop.tsx` está ligado à seção Conversas:

- lista à esquerda com Todas/Não lidas;
- histórico selecionado à direita;
- `WhatsAppPanel` aceita `embedded` e também continua disponível sobre a Agenda;
- busca filtra nome, telefone e preview;
- usa as rotas e o mundo mock existentes, sem estrutura de dados paralela.

Lapidação feita com o dono em 2026-09-08, olhando a referência:

- a seção entrou na moldura comum (título "Conversas" + linha de apoio, pílula);
- o cabeçalho da coluna virou **Caixa de entrada** — "Conversas" já é o título de
  fora — e as abas desceram para uma faixa própria;
- os dois cabeçalhos (lista e conversa) têm **72 px**, para a linha que os fecha
  ser uma só atravessando a pílula. Os dois números estão comentados um
  apontando para o outro.

Escopo travado: conversa no estilo WhatsApp. Não entram multicanal, CRM, notas
internas ou perfil detalhado do cliente.

### Dashboard como seção

O dashboard **não foi duplicado**. `DashboardScreen` ganhou `variante`:

- `modal` — a camada sobre a agenda, aberta pelo menu do avatar. Continua
  existindo e funcionando, intocada;
- `secao` — o Dashboard como irmão de Agenda e Conversas: sem véu, sem X e sem
  `Esc`, dentro da moldura comum. CSS próprio em `css/21-secao.css`.

Dado, cabeçalho, filtro e miolo são os mesmos objetos nos dois modos. Montado só
enquanto a seção está aberta, então sair para o polling de 30 s. A cerca de erro
(`LimiteDeErro`) veio junto; sair, ali, é voltar para a Agenda.

**Modal aposentado em 2026-09-17, a pedido do dono.** O item "Dashboard" saiu do
`UserMenu` (junto com o selo Premium e a prop `onOpenDashboard`, removida também de
`CalendarHeader` e `ControleDaColuna`) e o interruptor `dashboardAberto` do desktop
deixou de existir. No desktop existe um caminho só: a seção irmã da Agenda. **No
celular a camada continua viva** — é ela que o dock usa (`variante="modal"` com
`isMobile`), então `DashboardScreen` mantém as duas variantes.

### Lapidação do Dashboard — implementada em 2026-09-15

- Os quatro KPIs do topo passaram a usar a mesma superfície contínua e segmentada
  do Financeiro, preservando a identidade entre as duas seções.
- `Agendamentos` continua medindo a agenda do período; quando o filtro é Hoje, o
  apoio aparece na ordem **ativos · concluídos · cancelados**.
- `Novas marcações` virou **Marcações recebidas**. Esse card mede reservas criadas no
  período (`created_at`), enquanto `Agendamentos` mede para quando elas foram
  marcadas; os dois números não são sinônimos.
- `Horários livres` continua como leitura resumida de capacidade. O painel grande de
  próximos horários livres permanece responsável pelo detalhe; não foi criado outro
  card de “primeira vaga”, evitando informação duplicada.
- Na disponibilidade, a faixa de Hoje foi refinada para dar respiro aos três blocos
  numéricos internos sem alterar legenda, dado ou comportamento.

### Financeiro V1 — interface concluída

`components/financeiro/FinanceiroScreen.tsx` substituiu o placeholder e entrega a
leitura operacional combinada com o dono:

- períodos Hoje, 15 dias, Mês, 6 meses e Ano;
- KPIs conectados de faturamento, saídas, resultado operacional e atendimentos;
- ticket médio, gráfico divergente, composição por serviço, saídas por categoria
  e tabela de movimentações;
- comparação entre períodos, drawers de KPI/movimentação e modais de criar,
  editar e excluir lançamento manual;
- `+ Criar` agora abre o menu Novo agendamento / Novo lançamento financeiro.

Lapidação visual e temporal concluída em 2026-09-15:

- a massa mock determinística ganhou cenários legíveis nos filtros de 15 dias, Mês,
  6 meses e Ano, permitindo validar faturamento e saídas sem transformar os valores
  fictícios em contrato de produção;
- o gráfico divergente mantém faturamento acima do zero e saídas abaixo, agora com
  barras mais largas e arredondadas, mesma linha central e tooltip compacto no hover;
  o tooltip troca de lado para não esconder o período observado e o cursor permanece
  normal;
- a rosca de serviços virou um conjunto de segmentos arredondados com respiro entre
  as categorias, mantendo total e quantidade no centro;
- ao selecionar **Ano**, aparece um seletor com os anos realmente disponíveis nos
  movimentos. O ano corrente cobre janeiro até hoje; anos encerrados mostram janeiro
  a dezembro. A comparação do ano corrente usa o mesmo intervalo do ano anterior;
  anos encerrados comparam anos-calendário completos;
- o histórico anual é derivado das movimentações originais. Não existe cópia nem
  “congelamento” anual paralelo: dados antigos permanecem consultáveis porque o fato
  financeiro preserva sua data;
- na tabela de movimentações, entradas e saídas usam somente setas de 16 px, roxa e
  salmão respectivamente. As bolhas coloridas foram removidas, mas uma coluna invisível
  de 18 px preserva o alinhamento.

O faturamento vem somente de atendimentos cujo contrato atual marca como
`concluido`; como não existe estado de pagamento, a interface nunca chama esse
valor de recebido. Saídas demonstrativas e lançamentos manuais vivem apenas na
memória visual, isolados pela conta, até existir adapter financeiro real. O
Financeiro permanece desktop-only nesta etapa para não alterar o fluxo mobile já
validado. Assinaturas, comissões, formas de pagamento, pagamento online e
fechamento de caixa continuam apenas mapeados, fora da V1.

### Roxo unificado com o site público — implementado em 2026-09-15

O calendário passou a usar a **mesma escala de roxo do site de agendamento**
(`--color-accent` … `--color-accent-50` no `index.css`, com os valores e os nomes de
`SITE-BARB-PROF-UNICO/styles.css`). Havia cerca de dez tons escritos à mão
(`#6a3dff`, `#6B3EFF`, `#7C5CFF`, `#8b5cf6`, `#a78bfa`, `purple-500`, `indigo-300`…) em
35 arquivos; foram ~200 trocas, feitas por script, com cópia de segurança fora do repo.
`--color-primary` e `--color-primary-soft` agora apontam para essa escala.

Ficaram **fora** por serem cor de dado, não de marca: a paleta de 8 cores de
profissional (`Sidebar`/`HamburgerPanel`/`ConversasDesktop`), a cor do Lucas no mock
(`services/mock/mundo.ts`) e o índigo do período "Noite" no Kanban, que faz par com o
amarelo da manhã.

Login refeito na mesma rodada: marca `MarcaHubBarber` + "Barber" (Aclonica) no lugar da
logo do Lucas Costa; saudação genérica por período ("Boa noite, boas-vindas"), sem nome
e sem estado de "já acessou"; ícones dos campos em roxo; aba ativa, borda de campo em
uso, checkbox e botão no roxo novo; "Solicitar acesso" virou **"Ativar acesso"** e a
frase de apoio virou "Use o código que você recebeu."

### Celular alinhado ao desktop — implementado em 2026-09-15

Rodada de coerência, item a item, a partir dos prints do dono:

- dock com os ícones da coluna do desktop (`Calendar`, `MessageSquare`,
  `LayoutDashboard`), 22 px, traço igual no ativo e no inativo;
- filtro de profissionais do Kanban mostra só o primeiro nome no celular (nome completo
  no `title` e no desktop) — três nomes completos não cabem em 375 px;
- "Criar agendamento" do hambúrguer virou a mesma pílula branca com "+" roxo do
  desktop, com 44 px de altura; o botão de vidro saiu;
- avatar de cliente em Conversas no celular adotou o padrão do desktop: círculo neutro
  com inicial e ponto de cor de 12 px (52 px de avatar, que o filete de 74 px exige);
- contorno roxo marca a escolha feita em três controles: pílulas de mês, período do
  Kanban (Manhã/Tarde/Noite) e período do Dashboard (Hoje/7/15/30 dias);
- KPIs do Dashboard mobile viraram uma superfície segmentada 2×2 (divisória de 1 px,
  células de 118 px), com "Marcações recebidas" em fundo roxo translúcido no lugar da
  barra lateral; o texto de apoio desceu para o pé da célula e quebra equilibrado;
- **bug corrigido:** o "+" de profissional do hambúrguer não abria nada na Agenda e o
  modal só aparecia ao entrar em Conversas. O modal vive na `Sidebar`, cuja raiz é
  `hidden` no celular fora de Conversas; agora ele sai por `createPortal` no `body`.
  Ver `APRENDIZADOS.md`;
- no modal "Novo profissional", o ícone perdeu a caixa e ficou solto, em 20 px.

Verificação: `npx tsc --noEmit` e `npm run build` passaram; as telas foram conferidas no
navegador em 375 px, algumas por medição de estilo computado, porque a captura de tela
do ambiente falhou várias vezes. **Não conferido visualmente ainda:** a pílula de mês
ativa no modo Mês do celular.

### Lapidação visual da casca e dos controles — implementada em 2026-09-08

Rodada feita a partir dos prints do dono, da estrutura do dashboard de referência
em `localhost:3000` e do material em `Atlas Design-critico`:

- a coluna esquerda abandonou as pílulas genéricas: navegação ativa neutra,
  ícones centralizados quando recolhida, controles compactos e fundo final
  `#141414`, escolhido pelo dono;
- em 2026-09-09, a casca passou para o padrão **inset** do dashboard-modelo:
  controles de 32 px dentro do rail, conteúdo principal recuado e arredondado,
  barra superior de 48 px e remoção da faixa vazia de 48 px entre navegação e
  gaveta;
- o botão `Criar` mantém `w-full` nos estados aberto e recolhido para acompanhar
  a mola da própria coluna; `overflow-hidden` recorta o rótulo durante o percurso.
  Trocar a largura do botão junto com o estado fazia a forma branca saltar.
- o botão `Criar` e seu menu ganharam respiro, largura suficiente e rótulos sem
  quebra de linha;
- o modal financeiro de novo lançamento passou a usar seleção e calendário
  próprios (`Radix UI` + `react-day-picker`/`date-fns`), substituindo os controles
  nativos do Windows; a escolha Saída/Ajuste ficou contornada e a mensagem de
  apoio foi encurtada e passou a respeitar a largura do modal;
- configurações da agenda, menu do profissional e criação de profissional foram
  simplificados: menos camadas cinzas, menos preenchimento roxo e raios menores
  nos campos e ações. Círculos continuam circulares quando a função é escolher
  uma cor.

Validação concluída: `npx tsc --noEmit`, `npm run build` e `git diff --check`
passaram; a casca, o Financeiro e o modal de novo lançamento foram abertos no
ambiente local e renderizaram sem o transbordamento apontado. Ainda falta o dono
confirmar visualmente a cor final da coluna após atualizar a tela e percorrer as
duas abas completas de configurações da agenda.

### Relógio "O dia"

O mostrador usa a orientação reconhecível de um relógio: 12h no topo, 15h à
direita, 18h embaixo e 9h à esquerda na janela atual de 12 horas. A costura de
`CORTE_DEG = 3°`, onde fechamento e abertura se encontram, saiu do topo e foi
para a lateral esquerda. `09:00 abre` fica acima desse eixo e `21:00 fecha`,
abaixo, ambos fora dos anéis e sem rotação do texto. O `viewBox` reserva
`FOLGA_ESQUERDA = 44` para os rótulos não serem cortados.

O ponteiro, os arcos, os ticks e os horários usam a mesma função
`anguloDaHora`; não aplicar `transform: rotate()` no SVG inteiro, pois isso
também deitaria os textos.

### Padrão de avatar de cliente

A cor do cliente **não preenche** o círculo: o avatar é neutro (fundo branco 7%,
anel fino, inicial em branco 70%) e a cor virou um ponto de 10 px no canto
inferior direito, com anel de 2 px na cor do fundo daquela superfície.

Vale em três lugares: lista de Conversas (32 px, anel `#191919`), cabeçalho da
conversa (36 px, `#202020`) e gaveta da Agenda no desktop (40 px, `#1c1c1c`).

O painel de Conversas **no celular** (avatar de 52 px) ficou de fora de
propósito — fluxo mobile validado não muda como efeito colateral de rodada
desktop. É uma troca de uma linha quando o dono pedir.

### Referência visual em uso

`arhamkhnz/next-shadcn-admin-dashboard`, clonado em
`%TEMP%/claude/eval/shadcn-admin` e rodando em `localhost:3000`
(veredito em `docs/skills-log.md`). A tela usada é `src/app/(main)/chat/` mais o
envelope de `src/app/(main)/dashboard/chat/page.tsx`.

Regra combinada: **estrutura, sequência, espaçamento e geometria entram; token
não.** Cor, tipografia e raio continuam sendo os do calendário.

Da referência ainda **não** foi trazido:

1. busca dentro do próprio sistema de conversas (hoje ela é a busca global da
   `ControleDaColuna`, descendo como prop);
2. item da lista em três linhas — esbarra num detalhe real: conversa de WhatsApp
   não tem assunto, então a segunda linha precisa ser algo que exista nos dados;
3. grupos colapsáveis na lista (Fixadas / Hoje / Ontem);
4. conversa respirando: separador de data, hora fora da bolha, mais espaço entre
   mensagens;
5. campo de mensagem emoldurado, multilinha, com barra de ações.

Fora de escopo por decisão: abas `Reply` / `Internal note` e a bolinha de
presença (não existe sinal de presença vindo da Meta).

### Mundo mock

A troca de adapter acontece somente em `services/calendarApi.ts`. Nenhuma tela
conhece `VITE_MOCK`.

- dados relativos a `new Date()`;
- geração estável, sem `Math.random()`;
- no máximo cinco agendamentos por dia, variando entre dois e cinco; hoje tem
  tarde e noite para Lucas e Rafael, mais no máximo o atendimento em curso;
- Agenda e Dashboard derivam do mesmo mundo;
- escrita funciona em memória e F5 restaura a linha de base.

### Site público de agendamento — lapidação visual VALIDADA em 2026-09-15

O sistema está em
`C:\Users\victo\Desktop\Projetos Gith Hub\Barbearia Site\Aplicativo FULL\SITE-BARB-PROF-UNICO`
e roda em `localhost:3001`, com respostas placeholder (`api/visualMock.ts`) para
percorrer o fluxo sem dado real. O painel em `localhost:3002` não faz parte disso.

**O dono validou o sistema visual como feito.** Decisões duráveis dessa rodada estão em
`REGRAS.md` (entrada de 2026-09-15 do site público). Resumo do que ficou, tela a tela:

- **Home (celular):** título proporcional à largura (10–14 vw), botão Agendar no tamanho
  real, rodapé com o "•" no centro exato da tela.
- **Serviços:** roxo só no botão Agendar e no traço do filtro ativo; cards em vidro escuro
  com luz na borda de cima; título, filtros e lista agrupados (espaços 14/37 px).
- **Calendário:** a grade mostra só as semanas da janela aberta pelo barbeiro, numa
  sequência contínua; a virada de mês marca o dia 1 com a sigla ("OUT") e as setas só
  aparecem se a disponibilidade não carregar. Cartão centralizado na altura, título em
  17 px. Seleção com "pulo" da bolinha e troca animada do número grande. Dia de hoje:
  escuro com contorno roxo. Selecionado: roxo cheio com borda clara de 2 px. Números
  descidos 0,5 px para centralizar.
- **Horários:** efeito de escala + desfoque ligado à rolagem nos horários encostados na
  borda (já aplicado ao entrar); borda roxa suave em todos, cheia no toque.
- **Resumo:** ordem Serviço → Nome → Telefone → Profissional → Data; itens mais próximos;
  sem a frase "Clique em AGENDAR"; ícones novos de telefone e tesoura (Noun Project,
  crédito no código); cinco círculos com a mesma intensidade; animação de cascata com
  pulso reduzido. **Ainda dá uma "quebradinha" leve** — o dono aceitou deixar assim.
- **Botões que avançam etapa** (Prosseguir ×2, Ver horários, Agendar): contornados em roxo;
  no clique o roxo preenche o botão e só então avança (`hooks/useFillAdvance.ts`).
- **Títulos:** todos sem dois-pontos.

Verificação: `npx tsc --noEmit` (0 erros) e `npm run build` passaram. A inspeção visual das
etapas 5 e 6 foi do dono, por print do celular: no navegador de teste as animações não
rodam e a troca de etapa (feita no fim de uma animação GSAP) não acontece.

**Próximo passo do site público — lapidação de TEXTO** (pedido do dono, ainda não iniciada):

1. o texto abaixo de "Tudo certo, <nome>!" na tela final ("Para reagendar, entre em
   contato pelo WhatsApp.");
2. os textos que aparecem durante o envio do agendamento, depois de tocar em Agendar
   ("Estamos criando o seu agendamento...", "Ainda estamos finalizando… só mais um
   instante." e demais mensagens de status).

## Organização e memória implantadas nesta sessão

Criados:

- `AGENTS.md`: roteador curto do repositório;
- `CALENDARIO/AGENTS.md`: mapa e restrições da frente visual;
- `BARBEARIA/AGENTS.md`: leitura contextual por padrão;
- seção de memória operacional em
  `REGRAS-APRENDIZADOS/ANEXO_CONTEXT_ENGINEERING.md`;
- registro da curadoria em `docs/skills-log.md`.

O sistema usa as estruturas existentes, sem outro memory store:

- contexto mutável aqui;
- decisões duráveis em `REGRAS-APRENDIZADOS/`;
- skills e fontes em `docs/skills-log.md`;
- Git para versionamento;
- conferência de hash antes de escrever memória compartilhada.

## Skills trazidas

Versionadas em `.agents/skills/`:

- `improve-codebase-architecture`;
- `codebase-design`;
- `frontend-design`;
- `web-design-guidelines`.

Também foram instaladas no ambiente pessoal do Codex e ficam disponíveis nas
próximas sessões.

### Situação do Impeccable

`impeccable` não foi apagada. Ela ocupa 153 arquivos (~3,15 MB) e a junction em
`.claude/skills/impeccable` aponta para uma cópia antiga do projeto.

As skills novas cobrem direção visual e checklist web, mas não substituem ainda o
detector e o fluxo de inspeção do Impeccable. Decisão atual: não carregar por padrão;
validar uma rodada completa com as novas skills e então decidir a remoção.

## Revisão arquitetural

Relatório temporário:

`C:\Users\victo\AppData\Local\Temp\architecture-review-saas-barbearia-20260908-140024.html`

Candidatos encontrados, sem refatoração aplicada:

1. **Conversas — Strong:** aprofundar tradução, seleção, não lidas, histórico,
   polling e envio num único module; desktop e mobile continuam adapters visuais.
2. **Casca de Seções — Strong:** concentrar transições, busca, montagem, polling e
   cerca de erro num host profundo.
3. **Execução da Agenda — Worth exploring:** retirar do `App.tsx` a coordenação de
   estado, efeitos e mutações; fazer depois da validação visual imediata.
4. **Tradução de Agendamento — Speculative:** aguarda confirmação do contrato atual
   com o dev, pois esta casca mistura descrição prefixada e campos separados.

Recomendação: validar visualmente Conversas primeiro e, depois, explorar seu
deepening. A Casca de Seções vem em seguida.

## Auditoria web estática — não corrigida nesta sessão

A revisão pelas regras atuais da Vercel encontrou débito existente:

- `components/DayView.tsx:107`: `div` clicável sem semântica/teclado;
- `components/WhatsAppPanel.tsx:346`: campo de mensagem sem label, `name` e
  autocomplete explícito;
- `components/WhatsAppPanel.tsx:356`: botão só com ícone sem `aria-label`;
- `index.css:183`: `outline: none` no StardustButton sem reposição visível;
- vários arquivos usam `transition-all`, inclusive `EventModal.tsx`,
  `LoginScreen.tsx`, `Sidebar.tsx` e CSS do Dashboard;
- `LoginScreen.tsx:443`: imagem sem atributos explícitos de largura e altura.

Esses itens são backlog de qualidade, não autorização para redesenhar a interface.

## Trabalho local não commitado

O diff acumulado cobre `App.tsx`, `CalendarHeader.tsx`, `Sidebar.tsx`,
`UserMenu.tsx`, `index.css`, o shell inteiro, Conversas, Dashboard, Financeiro e a memória.
Nada foi commitado ainda. Não sobrescrever nem limpar o diff existente.

Verificação da rodada de 2026-09-15: `npx tsc --noEmit`, `npm run build`,
`git diff --check`, detector do Impeccable e inspeção visual em `localhost:3002`
concluídos sem erro. O Vite mantém apenas o aviso já conhecido de chunk principal
acima de 500 kB.

Rodada de 2026-09-17 (Mês, bloqueio por período, área segura, login, aposentadoria do
modal do dashboard): `npx tsc --noEmit` e `npm run build` passaram; telas conferidas em
375×812, 375×540 e 375×420 no navegador, e o dono conferiu no iPhone a cada passo. O
que depende de aparelho real segue listado nas pendências.

### Área segura do celular — corrigida em 2026-09-17

Todo rodapé ancorado usava `max(folga, env(safe-area-inset-bottom))`. Num iPhone isso
**escolhe o inset** (34 px) e devolve zero de folga própria: o botão encosta no
indicador de home. Passou a somar — `calc(env(safe-area-inset-bottom) + 16px)` — em
`ProfileModal`, `AgendaSettingsModal`, `EventModal`, `HamburgerPanel`, os três rodapés
da `Sidebar`, o `BottomSheet` e o campo de mensagem do `WhatsAppPanel` (12 px). O
**dock** estava pior: `bottom: 26px` fixo, sem área segura nenhuma; foi para
`max(26px, calc(env(safe-area-inset-bottom) + 12px))`, a mesma fórmula que o modal do
dashboard já usava. Onde não há inset, `env()` é 0 e o valor vira a folga pura.

### Login no celular — 2026-09-17

- **Rolagem com o teclado aberto:** a tela era `overflow-hidden` e o miolo era
  centralizado por `justify-center`. Com o `dvh` encolhendo, o conteúdo transbordava
  para os dois lados e a parte de cima ficava **inalcançável** — a marca aparecia
  cortada. Agora a tela rola e o bloco é centralizado por `my-auto`. Conferido em
  375×420.
- **Fundo não mudou:** a tentativa de pôr um véu sobre as ondas foi revertida a pedido
  do dono.
- **Botão "Entrar" continua escuro.** Preencher de roxo foi tentado e revertido: o
  relevo do `stardust` é vidro sobre preto e vira plástico sobre roxo, e preenchimento
  contraria a regra do site público. A hierarquia contra a aba foi resolvida **tirando
  peso da aba**: ela tinha preenchimento claro + brilho branco + anel roxo a 60%; ficou
  com superfície levemente elevada, texto branco e anel roxo a 30%.

## Tarefas anotadas para a próxima sessão

Pedidas pelo dono em 2026-09-15, no fim da sessão. A execução começou pelo padrão
de modais mobile, uma peça por vez.

**Rodada mecânica concluída em 2026-09-17, sem decisões de produto:** a lupa mobile
sem ação saiu; dias, horários e eventos clicáveis ganharam semântica e nomes
acessíveis; o `BottomSheet` ganhou contenção e restauração de foco, `Escape` e
redução de movimento. O foco entra somente depois da animação e com
`preventScroll`; a folha não alterna mais o `overflow` do `body`, pois o documento
já está travado pela casca. `Escape` na folha não fecha mais o modal-pai; botões de
fechar/adicionar/remover e seletores de período passaram a respeitar 44 px; o painel
de Conversas agora cobre toda a viewport atrás do dock; movimentos contínuos do
cabeçalho e a rolagem das pílulas respeitam redução de movimento; o texto
demonstrativo do card presencial deixou de truncar “(exemplo)”.
Validado com `tsc`, build, `git diff --check`, teclado e navegador em 375×540. A
visão mensal, o destino do Financeiro e a remodelagem visual do bloqueio continuam
dependendo das decisões descritas abaixo.

**Estabilidade do Criar Evento no iPhone — 2026-09-17:** no celular, a textura e
os efeitos de glow do modal foram substituídos por fundo chapado `#141414`; o
escurecimento da folha inferior não usa mais `backdrop-filter`. Campos passaram a
16 px para impedir o zoom automático do Safari. Ao abrir o teclado, `resize` e
`scroll` da `visualViewport` são agrupados em um único ajuste por frame, limitado ao
miolo rolável: o campo focado permanece visível sem mover o modal inteiro. A
Descrição não dispara mais uma rolagem suave no foco e outra em cada mudança do
teclado; essa sobreposição era a causa da animação travada. Nos seletores
Profissional, Data e Início, somente a folha inferior deve animar; focar uma opção
ainda fora da tela e reaplicar o bloqueio do `body` eram as causas do movimento do
formulário ao fundo. O desktop preserva a textura existente.

**Pendências adicionais desta análise — validar no iPhone real:**

- abrir e fechar Profissional, Data e Início repetidas vezes e confirmar que título,
  campos, rodapé e fundo permanecem imóveis durante entrada, saída e restauração de
  foco da folha;
- testar a Descrição ao abrir o teclado pela primeira vez, ao chegar nela com o
  teclado já aberto, ao fechar/reabrir o teclado e ao inserir várias linhas;
- conferir em altura pequena e após mudança de orientação se textarea e rodapé não
  se sobrepõem e se somente o miolo dos campos rola;
- repetir o fluxo tanto numa aba do Safari quanto no PWA instalado, pois `100dvh` e
  `visualViewport` podem se comportar de forma diferente nesses dois modos;
- verificar “Reduzir Movimento” do iOS e confirmar que os fluxos continuam visíveis,
  focáveis e sem salto, mesmo sem a animação de entrada;
- após a validação real, decidir se o ajuste genérico de campo focado permanece para
  todos os inputs ou se deve ficar restrito à Descrição. Não alterar antes de medir.

1. **Celular precisa se comportar como aplicativo, não como página no navegador.**
   **Parte 1 concluída em 2026-09-16:** `EventModal`, `ProfileModal`,
   `AgendaSettingsModal` e o fluxo de Novo profissional agora ocupam `100dvh` no
   celular, com cabeçalho e ações fora do miolo rolável, proteção de `safe-area` e
   entrada vertical. Os seletores de cor relacionados viraram folhas inferiores e
   todos os overlays ficam acima do dock. Conferido em 375×812, 375×540 e desktop;
   os cartões desktop preservaram a geometria anterior. `BottomSheet` e a lightbox
   de foto já eram nativos e foram preservados; popovers contextuais ficaram fora.
   O painel vai virar PWA, e hoje há comportamentos que denunciam a origem web.
   O exemplo dado foi o modal "Criar Evento": ele é um cartão centralizado, com
   Cancelar/Salvar flutuando no meio da tela; no celular essas ações pertencem à
   **borda inferior do aparelho**, ancoradas, respeitando a área segura. O modal
   deveria ocupar a tela como folha nativa, com o conteúdo rolando por baixo das
   ações fixas, inclusive com o teclado aberto (nos prints do dono, o teclado
   empurra o cartão e o campo em foco fica espremido).
   Vale para **todos** os modais do celular. O dono apontou também o de
   "Bloqueio de agendamentos por período": cartão flutuando no meio da tela, com
   Cancelar/Salvar soltos e a lista de profissionais cortada no meio de um item.
   Mesma correção: folha ancorada nas bordas do aparelho, ações fixas embaixo e o
   conteúdo rolando por baixo delas.

2. **Conversas no celular: abrir a conversa em tela cheia, como no WhatsApp.**
   **Parte 2 concluída em 2026-09-16:** ao tocar num contato, a lista sai de cena e a
   conversa ocupa `100dvh`, acima do dock, com cabeçalho do contato, ação de voltar,
   histórico como único miolo rolável e campo de mensagem protegido pela `safe-area`
   na borda inferior. Sair da aba Conversas fecha a conversa móvel. Conferido em
   375×812 e 375×540; a seção desktop de duas colunas permaneceu intacta.

3. **Visão de Mês no celular — correção estrutural implementada em 2026-09-17.**
   A referência oficial do Google Calendar confirmou a função da visão mensal como
   leitura de alto nível: o detalhe vem ao tocar no dia. As seis semanas agora têm
   alturas iguais; cada célula recorta o próprio conteúdo; a quantidade de horários é
   calculada pela altura realmente disponível; e o excedente vira `+N`. O mínimo
   forçado de quatro eventos e o peso artificial da última semana foram removidos —
   eram as causas das pílulas sobre o numeral e do vazamento entre células. No mobile,
   a pílula prioriza somente o horário e a cor do profissional; pedaços ilegíveis do
   nome não aparecem. A área abaixo do limite de informação continua desenhando apenas
   a malha vazia atrás do dock, sem datas nem eventos, e o FAB de novo agendamento
   voltou a flutuar acima da navegação. Conferido em 390×844 e 390×730: seis linhas
   uniformes e zero célula com `scrollHeight > clientHeight`.

   **Fechada em 2026-09-17 (rodada da noite), com o Google Calendar do dono ao lado:**

   - **teto de quatro tarjas por célula** (`MAX_EVENT_ROWS`), como na referência; o
     excedente vira o indicador de três pontos — três círculos de 2 px desenhados, não
     o glifo `•••`, que saía grande e espaçado demais no aparelho;
   - as constantes de altura do cabeçalho da célula passaram a descrever o que a célula
     **realmente** desenha (numeral de 20 px, sigla de 15 px na primeira semana). Estavam
     subestimadas, e era isso que fazia a última tarja nascer cortada;
   - **malha sem recorte:** a faixa atrás do dock perdeu a `border-t`. A última carreira
     continua para baixo sem emenda, como no Google;
   - **respiro veio do topo:** no celular a faixa superior passou a ser uma só para Dia,
     Semana e Mês — área segura do aparelho (mínimo de 12 px no navegador) e 4 px
     abaixo. A célula subiu de 95 → ~100 px, que é o que faz caber 4 tarjas **mais** os
     pontinhos. As pílulas de mês encolheram para 36 px de superfície visível mantendo
     44 px de alvo de toque, e o Dia ganhou 8 px acima do conteúdo, que ali não tem a
     fileira de pílulas separando;
   - **tocar na célula abre o DIA daquela data no celular** (`abrirDiaDoMes`), não o
     formulário de novo agendamento — padrão do Google e o que o rótulo acessível da
     célula já prometia. No desktop o clique continua criando.

   Ainda falta validar no iPhone real o toque no excedente, o FAB sobre dias muito
   carregados e o balanço final de densidade/tamanho do horário.

4. **Decidir onde o Financeiro entra no celular.** Ele existe só no desktop, e o dock
   do celular tem três lugares: Agenda, Conversas e Dashboard. Falta decidir como a
   quarta seção se integra — se o dock passa a ter quatro itens, se o Financeiro mora
   dentro do Dashboard, ou outra forma. A decisão vem antes de qualquer tela: a regra
   de 2026-09-08 diz que as seções são irmãs, e hoje o celular tem uma a menos.

5. **Lapidar o card “Cliente presencial” no Kanban.** O estado recolhido mostrado
   pelo dono em 2026-09-16 está visualmente fraco: o nome aparece truncado cedo e a
   composição de seta, filete roxo tracejado, título e horário parece remendada dentro
   de outra moldura. Rever hierarquia, densidade e relação entre estado recolhido e
   expandido sem alterar o contrato do atendimento. Esta tarefa é independente das
   demais e ainda não foi iniciada.

6. **Skills de padrões mobile — concluída em 2026-09-16.** Foram avaliadas e
   instaladas `mobile-ux-patterns` e `mobile-app-ux-auditor`, com escopo restrito ao
   mobile e veredito registrado em `docs/skills-log.md`. A primeira orienta padrões
   concretos de PWA/React; a segunda organiza a auditoria por fluxo e severidade.
   Entram como checklist, não como um design system paralelo nem como autoridade
   acima das decisões já validadas com o dono.

7. **Redesenhar visualmente “Bloqueio de agendamentos por período” no celular.** A
   conversão funcional para folha de tela inteira está concluída, mas o print de
   2026-09-16 expôs outro problema: o conteúdo ainda parece um formulário desktop
   esticado. A marca domina o topo; data, profissionais e períodos acumulam caixas
   dentro de caixas; os botões Manhã/Tarde/Noite têm peso excessivo; e um grande vazio
   separa o formulário das ações fixas. Rever hierarquia, densidade, ritmo vertical e
   representação da seleção sem perder clareza nem reabrir o comportamento do modal.

   **Concluída em 2026-09-17.** No celular (desktop intacto, geometria de 2026-09-09):
   a foto caiu para 88 px sem o anel roxo e o bloco dela absorve parte da sobra vertical,
   para o topo respirar; sumiram as três molduras aninhadas — virou rótulo de seção, uma
   linha para a data e um profissional por linha, separados por filete; Manhã/Tarde/Noite
   viraram **controle segmentado** (uma superfície, três divisões, alvo de 44 px), com
   bloqueado em vermelho e livre neutro, sem contorno; as linhas crescem até um teto de
   136 px, então não sobra vão entre o segmentado e o filete nem um vazio grande antes
   das ações, que seguem ancoradas. "Manha" virou **Manhã**.

## Próximo ponto

0. **Site público:** visual validado; próxima rodada é a lapidação de **texto** (tela
   final e mensagens durante o envio) — ver a seção do site público acima.
0.1. **Celular:** conferir no aparelho a rodada de 2026-09-15, em especial a pílula de
   mês ativa no modo Mês, que ficou sem conferência visual, e a lista de incoerências
   com o desktop que ainda não foi atacada (moldura roxa da agenda, item ativo branco
   do hambúrguer, marca ausente depois do login, engrenagem inexistente). Incluir a
   checklist do Criar Evento registrada acima: fundo imóvel nos três BottomSheets,
   fluidez da Descrição com o teclado e comparação Safari/PWA.
1. O dono valida a lapidação visual, sobretudo a coluna em `#141414` e as duas
   abas de configurações da agenda, antes de nova rodada ou de qualquer contrato
   de persistência/backend.
2. A fila da referência de Conversas continua listada acima; a recomendação é a
   busca dentro da seção (item 1).
3. Decidir se o painel de Conversas do celular adota o avatar novo.
4. Depois de uma rodada com as skills novas, decidir se `impeccable` será
   removida.

Pendências visuais ainda abertas: destino definitivo da gaveta; a engrenagem da
barra ainda não tem tela (`ponytail:` no código); e "Dashboard" ainda usa ícone
diferente entre a coluna (`LayoutDashboard`) e o mobile (`BarChart2`). O `Gem` saiu
junto com o item do menu do avatar, aposentado em 2026-09-17.
