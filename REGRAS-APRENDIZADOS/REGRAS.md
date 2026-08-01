# Regras do Projeto

Decisões duráveis. Cada regra vale até ser explicitamente revista — se uma nova
informação contradiz uma regra aqui, isso é um conflito a debater (ver README.md desta
pasta), não uma sobrescrita silenciosa.

## [2026-07-29] Plataforma de deploy alvo: Vercel Pro + Supabase Pro
- **Regra:** o sistema, quando amadurecer, sobe em Vercel Pro (compute/hosting) e
  Supabase Pro (banco de dados/auth/storage).
- **Por quê importa:** decisões de infraestrutura devem primeiro checar o que essas
  duas plataformas já resolvem nativamente, antes de construir algo por conta própria.
  Especificamente:
  - Vercel (Fluid Compute) já faz load balancing e escala horizontal de funções
    automaticamente — não precisamos provisionar/configurar load balancer manual nem
    gerenciar réplicas de servidor.
  - Supabase Pro oferece Postgres gerenciado com opção de read replicas e connection
    pooling (Supavisor/PgBouncer) nativos — não precisamos montar replicação
    master/replica na mão.
  - Cache (ex.: Upstash Redis via Vercel Marketplace) segue sendo uma escolha ativa
    nossa, não vem de graça de nenhuma das duas plataformas.
- **Como aplicar:** ao avaliar qualquer conhecimento/repositório sobre infraestrutura
  de escala (load balancer, réplicas, sharding), checar primeiro se Vercel Pro/Supabase
  Pro já cobrem aquilo antes de considerar implementação própria.

## [2026-07-29] V1 é "custo-benefício" — não fazer engenharia de escala prematura
- **Regra:** a primeira versão do SaaS (bot de botões no WhatsApp + espelhamento no
  calendário) deve ser a mais simples e barata possível. Isso é um requisito
  explícito do usuário, não uma suposição minha.
- **Por quê importa:** conhecimento sobre escala para "milhares de usuários
  simultâneos" (load balancer manual, réplicas de servidor, sharding de banco) não se
  aplica à V1 de uma barbearia (ou poucas dezenas de barbearias). Aplicar esse tipo de
  arquitetura agora seria over-engineering.
- **Como aplicar:** ao decidir arquitetura/stack para a Fase 1 e Fase 2, priorizar
  simplicidade e custo baixo. Conhecimento de escala vai para os `ANEXO_*.md` como
  referência para quando o produto crescer (V2 ou V1 em volume alto), não como
  requisito de agora.

## [2026-07-29] Stack do motor do bot WhatsApp (Fase 1/Fase 2) — decisão travada
- **Regra:** motor do bot em **Node.js + TypeScript + Hono** (não Fastify — o
  calendário existente usa Fastify, mas o bot é um serviço novo e separado;
  interoperabilidade na Fase 2 acontece via contrato HTTP, não via framework
  compartilhado). Demais decisões:
  - **Estado de conversa:** tabela `conversas` no Supabase Postgres
    (`tenant_id`, `telefone`, `passo_atual`, `contexto jsonb`, `expira_em`), via
    pooler transacional (porta 6543). Sem Redis/cache — dedupe de webhook por
    `wamid` (idempotência) cobre o que o Redis resolveria.
  - **Multi-tenancy:** RLS com `tenant_id` em toda tabela + tabela `barbearias`.
    O bot usa `service_role` (ignora RLS) — disciplina de filtrar por
    `tenant_id` é responsabilidade do código, sempre.
  - **Billing:** Asaas (Pix nativo, boleto, régua de cobrança automática —
    melhor fit que Stripe/Mercado Pago pro perfil de dono de barbearia
    brasileiro). Migrar para Pix Automático (débito recorrente do Banco
    Central, taxa 0,22–0,35% vs. 0,99% do Asaas Pix Recorrente) quando passar
    de ~200-300 assinantes ativos — não antes, a economia só compensa em volume.
    AbacatePay avaliado e **parqueado como candidato** (taxas menores em
    Pix/boleto, mas fintech de ~1 ano sem licenciamento confirmado) — ver
    `ANEXO_PAGAMENTOS.md` para a comparação completa.
  - **Acesso ao banco (ORM):** **Drizzle ORM**, não driver nativo puro nem
    Prisma. Motivo: TypeScript-first, sem runtime pesado nem passo de geração
    no build, combina naturalmente com Hono/serverless (é a dupla mais comum
    do ecossistema atual) e é consistente com a razão de termos escolhido Hono
    sobre Fastify (leveza). Conecta via o mesmo pooler transacional do
    Supabase (porta 6543) usado pela tabela `conversas`. `@supabase/supabase-js`
    continua sendo usado à parte, só para Auth (JWT/RLS) — não para as queries
    de dado, que ficam com o Drizzle. Nenhuma skill de terceiro adotada (nada
    no catálogo bate a barra de qualidade — melhor achado tinha só 62 estrelas
    e estrutura confusa).
  - **Auth:** Supabase Auth (JWT alimenta as políticas RLS nativamente).
  - **Filas/lembretes:** padrão outbox — tabela `envios_pendentes`
    (`enviar_em`, `tentativas`, `status`) + Vercel Cron a cada minuto (confirmado
    que o plano Pro suporta essa cadência). Zero infraestrutura nova.
  - **Observabilidade:** Sentry (free) + logs JSON + tabela `webhook_eventos`
    guardando payload bruto da Meta (retenção de log da Vercel é curta;
    replay de webhook é a ferramenta de debug mais valiosa aqui).
  - **Testes:** máquina de estados como função pura `(estado, evento) →
    (novoEstado, ações[])`, testável com Vitest tabular; mock de HTTP com msw;
    testar a verificação de assinatura `X-Hub-Signature-256` do webhook
    (erro de segurança clássico se esquecido).
- **Por quê importa:** é a decisão de arquitetura central do projeto, derivada de
  um prompt estruturado (`docs/stack-decision-llm-prompt.md`) e verificada
  ponto a ponto antes de travar (ver `docs/resposta.md` para a resposta completa
  e o histórico de conversa para a checagem crítica de cada item).
- **Como aplicar:** toda decisão de código do motor do bot segue isso por padrão.
  Se algo aqui precisar mudar, é uma revisão explícita, não um desvio silencioso.

## [2026-07-29] Convenção `ponytail:` para simplificações deliberadas
- **Regra:** ao cortar corner conscientemente (lock global, scan O(n²), heurística
  simples) para manter o código enxuto agora, marcar com um comentário
  `ponytail: <teto conhecido>, <gatilho de upgrade>` no ponto do código. Ex.:
  `// ponytail: scan linear, ok até ~500 tenants; migrar pra índice se passar disso`.
- **Por quê importa:** simplificação deliberada sem registro vira dívida técnica
  invisível — "depois" vira "nunca". A skill `ponytail-debt` varre esses
  comentários e monta um ledger, sinalizando quem não tem gatilho de revisão
  (risco de apodrecer em silêncio).
- **Como aplicar:** sempre que eu (Claude) escolher a solução mais simples sabendo
  que ela tem um teto claro, marcar com esse comentário em vez de só confiar na
  memória do projeto. Rodar `ponytail-debt` periodicamente pra revisar o ledger.

## [2026-07-30] Desenho do motor do bot — decisões travadas ao codar a 1ª interação

Cada item abaixo foi decidido com o usuário, implementado e verificado contra o banco
real. Substituem o que o fluxo n8n fazia; o anexo do n8n continua não-normativo.

- **Contexto viaja dentro do id do botão, não no banco.** Id versionado, ação
  minúscula, parâmetros em querystring: `1.agendar`,
  `1.hora?b=1&d=2026-08-04&h=13:00`. Teto de 200 caracteres (limite de `list_reply`).
  **Consequência que apaga uma classe de bug:** botão velho chega auto-suficiente,
  então "clique velho pula etapa" deixa de existir e a validade de 30 minutos do
  fluxo antigo é desnecessária. O que pode ter mudado é o **dado** (o horário foi
  tomado), e a defesa é conferir no banco na hora de marcar.
- **O id decide a rota; o título, nunca.** O antigo comparava `'✅ Confirmar'` — o
  roteamento quebrava em silêncio ao mudar o emoji.
- **Vocabulário de ids criado do zero.** Nenhum id do n8n é herdado.
- **O roteador é função pura e total.** `rotear(evento, contexto) → Acao[]`: devolve
  intenções, não efeitos, e toda entrada tem resposta. Quem consulta o banco é o
  chamador, que passa o contexto pronto — é isso que mantém o teste em milissegundos,
  sem servidor e sem simular a Meta.
- **Silêncio só existe num lugar:** no último degrau da escada de feedback. Em
  qualquer outro ponto, silêncio é bug.
- **Redis não entra**, com motivo verificado uso a uso: estado morreu com o contexto
  no botão; dedupe virou `UNIQUE (wamid)` (garantia estrutural, sem TTL a calibrar, e
  a linha fica para replay); rajada virou trava **na saída**.
- **Trava de rajada é na saída, não na entrada.** Processa e grava todas as
  mensagens; suprime o envio repetido. O `INCR` do n8n descartava justamente a
  terceira mensagem — a que costuma trazer a informação boa. Vale só para texto:
  toque em botão nunca é suprimido.
- **Estado da conversa é derivado, nunca gravado em coluna.** A fonte é a última
  resposta que o bot deu (`webhook_eventos.acao`). Gravar em `dados_cliente.fluxo`
  recriaria o problema do fluxo antigo — estado em Redis *e* em coluna, com validades
  diferentes, e uma rota de "fallback de estado" só para remendar o desencontro.
- **Escada de feedback** (regra do usuário, mecanismo redesenhado): texto fora do
  trilho de botões recebe dica mirada no último estado → insistiu, reenvia o menu e
  trava respostas a texto → insistiu de novo, silêncio. **Botão sempre funciona,
  inclusive travado.** Resets: virada do dia (meia-noite de São Paulo) e qualquer
  toque em botão. Os dois saem de graça porque são recortes da consulta — sem campo
  de validade, sem rotina de limpeza.
- **A cobrança da copy é do compilador.** `NomeResposta` é um tipo fechado e o mapa
  de dicas é `Record<NomeResposta, string>`: estado novo sem a frase correspondente
  **não compila**. É o que impede um estado futuro de virar silêncio por descuido.
- **Formato canônico de telefone: o `wa_id` como a Cloud API entrega** (dígitos
  puros com DDI, ex. `553384246770`). Sem o `9` artificial depois do DDD e sem
  `@s.whatsapp.net` — os dois vinham da Evolution API e produziram quatro formatos do
  mesmo número no mesmo banco. Cravado enquanto as tabelas estavam vazias, custo zero.
- **Drizzle adiado** (revisão explícita da decisão de 2026-07-29): o `drizzle-kit`
  quer ser dono das migrações e criaria um segundo histórico ao lado da
  `supabase_migrations.schema_migrations` que o `npm run db:migrar` usa. Gatilho para
  entrar: schema nosso com relações.
- **Toda mudança de estrutura é migração versionada** em `BARBEARIA/db/migracoes/`.
  Nunca DDL avulso, nunca pelo painel.

**Por quê importa:** são as formas que todo passo seguinte do fluxo herda. Mudar
qualquer uma depois custa reescrever o que veio em cima.

## [2026-07-30] Mensagem inicial padronizada e escolha do barbeiro
- **Formato padrão do menu é `interactive.type = list`**, não os 3 botões de resposta
  rápida. Custa um toque a mais (o cliente abre "Ver opções") e em troca dá header e
  footer. Decisão do dono do produto: visual completo. ⚠️ **A justificativa original
  dizia que `button` não aceita header nem footer, e isso está errado** — ver a
  correção na entrada "Dia e horário" desta mesma data. A decisão continua de pé pelo
  que sobrou dela (o cartão com "Ver opções" e título de seção), não pela premissa.
- **A abertura do dia é picada em duas mensagens** — saudação como texto normal, menu
  logo atrás. Numa mensagem só, o "Boa noite" viraria título de cartão. Custa uma
  chamada HTTP a mais por abertura, e o custo foi aceito explicitamente.
- **Saudação por faixa de horário** (5h/12h/18h) no fuso de São Paulo, nunca no do
  servidor — na Vercel o processo roda em UTC e o cliente das 22h receberia "bom dia".
  Fica fora do roteador: entra pronta no contexto, pra a função continuar pura.
- **O bot só chama pelo nome quem informou o nome a ele**, na etapa de nome de um
  agendamento fechado (`dados_cliente.nome`). **O nome do perfil do WhatsApp é
  descartado de propósito** — é o que a pessoa escreveu no próprio aparelho (apelido,
  nome de loja, emoji), e chamar cliente por aquilo gera confusão. A coluna herdada
  `nomewpp` foi renomeada porque prometia exatamente o oposto da regra.
- **Um único sinal decide a abertura inteira:** tem nome gravado ou não. Some a
  distinção antiga "já conversou antes" — quem conversou ontem e largou no meio é
  tratado como novo, e recebe o menu genérico.
- **`agendamentos.cliente` não é escrita pelo WhatsApp.** Aquela coluna é do
  agendamento pela internet, fase futura. O cadastro do bot mora em `dados_cliente`.
- **Barbeiro é dado, não código.** A lista sai de `profissionais where ativo`, e o
  `profissionais.id` viaja dentro do id da opção (`1.barbeiro?b=2`). No n8n o mapa
  estava hardcoded em 3 nós e tudo depois de "escolher barbeiro" existia duplicado,
  uma cópia por profissional (~20 nós) — barbeiro novo era editar o fluxo.
- **A pergunta "com quem?" só existe quando há escolha real:** 0 ativos → avisa que a
  agenda está fechada; 1 → pergunta pulada, a escolha acontece sem o cliente ver; 2 →
  a lista aparece. A regra sai da contagem no banco, sem flag de configuração.
- **O `b=` do id não vale nada sozinho** — só vira barbeiro depois de bater com a
  lista de ativos. Barbeiro desativado no meio faz a pergunta voltar com quem sobrou,
  em vez de escolher alguém no lugar do cliente.
- **Pergunta do meio de agendamento (WhatsApp ou site) foi eliminada.** Quem está no
  WhatsApp já respondeu isso ao tocar em Agendar. Era o passo 1 do sub-fluxo antigo.
- **`webhook_eventos.acao` virou `text[]`.** Era `text` com nomes concatenados por
  vírgula enquanto o roteador devolvia no máximo uma ação; a abertura picada foi o
  gatilho de upgrade previsto no `ponytail:`. Sem a troca, a escada de feedback
  compararia `'saudacao,menu_principal'` por igualdade, não reconheceria degrau
  nenhum e o bot cairia em silêncio — sem erro e sem log.

**Por quê importa:** a mensagem inicial é a única que 100% dos clientes veem, e o
formato escolhido aqui (lista com header/footer) é o molde de todo passo seguinte do
fluxo. As duas regras de dado — nome só do cliente, barbeiro só do banco — são o que
impede o sistema de herdar os dois defeitos que mais custaram no n8n.

## [2026-07-30] O calendário no ambiente: o que a poda decidiu

A pasta `CALENDARIO/` veio de `Aplicativo-FULL` e foi podada para o nosso escopo.
As decisões que valem daqui pra frente:

- **`dados_cliente` tem um dono só: o bot.** O `POST /agendamentos` do calendário
  escrevia lá, com telefone em JID (`...@s.whatsapp.net`) e numa coluna
  (`nomewpp`) que renomeamos. Isso duplicava o cliente sob o `UNIQUE (telefone)` e
  derrubava a rota com 500 **depois** de já ter criado o agendamento. Bloco
  removido. Nenhum outro serviço escreve naquela tabela.
- **`configuracao` e `categorias_servicos` estão mortas de propósito — não apagar.**
  Nenhum código lê ou escreve mais nelas (eram do site público, sacrificado), mas
  o usuário tem uso futuro para elas. Tabela sem consumidor aqui **não é sobra**.
- **O DDL das tabelas não volta pro repositório.** Apagamos `migrations/` e
  `scripts/init-whatsapp-crm.js`. Se um dia for preciso replicar o ambiente,
  consulta-se o banco — guardar arquivo dizendo como criar tabela é espelhar o
  banco no repositório, que é a regra que já temos. O conteúdo antigo continua no
  commit `4f2294f`, se alguém precisar.
- **O relógio do processo é fixado no código**, não herdado do host:
  `process.env.TZ = process.env.TZ || "America/Sao_Paulo"` no topo do `server.js`.
  As funções de data do calendário perguntam a hora ao processo; na VPS do n8n
  isso funcionava por acaso (máquina de Brasília), e num host UTC — a Vercel — a
  antecedência mínima e a virada do dia ficariam 3 horas fora, **sem erro e sem
  log**. `TZ` do ambiente continua tendo precedência.
- **Portas: o bot é 3333, o calendário é 3334.** Eram os dois na 3333 e não subiam
  juntos — o que inviabilizava a própria integração.
- **O envio de mensagem pelo painel responde 501 até a integração.** A rota fica
  de pé como a costura pro bot; o transporte antigo era o n8n. Responder erro
  explícito é melhor que fingir que enviou e gravar mensagem que nunca saiu.

**Por quê importa:** os dois sistemas dividem o mesmo banco, e foi exatamente aí
que nasceram os defeitos — cada tabela precisa de um dono declarado.

## [2026-07-30] Dia e horário: formato do botão e a janela da agenda

- **Exceção declarada ao "formato padrão é `list`":** com **3 opções ou menos**, a
  mensagem vai como `interactive.type = button`; com **mais de 3**, como `list`. Vale
  para o dia e para o horário. O padrão de 2026-07-30 (lista com header e footer)
  continua valendo em todo o resto — inclusive no menu de abertura, que tem número
  fixo de opções, e na escolha do barbeiro, que tem 2 e mesmo assim segue em lista
  porque aquela tela já foi validada no celular.
  - **Premissa corrigida:** `button` **aceita** header e footer. A
    [documentação da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/)
    lista os dois como opcionais no objeto `interactive`, junto de `body` e até 3
    botões. A frase contrária veio do fluxo n8n, entrou aqui como justificativa da
    padronização em lista, e foi repetida ao dono do produto quando ele decidiu a
    regra dos 3 — ele aceitou perder o cartão, e não precisava. O que `button`
    realmente não tem é o rótulo "Ver opções" e o título de seção; e o título de cada
    opção cai de 24 para 20 caracteres.
  - **A escolha é declarada por mensagem, nunca deduzida da contagem.** É um campo
    `compacta` na ação. Deduzir pelo número de opções transformaria a decisão sobre o
    menu de abertura (3 opções, e ainda assim lista) num acidente.
  - Origem: é a regra do nó `Padrão dos Botões` do n8n (anexo, seção 11), preservada.
- **Cada passo sai em duas mensagens: interseção curta em texto, depois a lista.**
  Regra do dono do produto, mesma forma da abertura do dia (saudação + menu).
  - **Por que é margem de segurança e não enfeite:** o envio é sequencial, uma
    chamada HTTP por mensagem. A interseção é texto puro, chega primeiro, e a lista só
    é postada depois. Se o cartão demorar, o cliente já tem resposta na tela em vez de
    silêncio — e silêncio é o que faz gente digitar solto ou caçar botão antigo.
  - **O que ela ainda não cobre:** a consulta ao calendário acontece antes das duas
    mensagens. Medido em 2026-07-30 contra o banco real: **4805 ms na primeira chamada
    do processo, ~900 ms nas seguintes** — a API está em `localhost`, mas o banco dela
    é o Supabase, pela internet. Cobrir essa janela exige mandar a interseção antes da
    consulta, o que significa tirar a chamada HTTP de dentro da transação. Marcado com
    `ponytail:` no código.
- **Um horário só, ou até três, viram botão direto.** Verificado contra o banco real:
  o dia corrente com 1 vaga saiu em `button`; um dia cheio, com 13, saiu em lista.
- **A lista mostra no máximo 10 horários, e o resto do dia não aparece.** Decisão
  explícita do dono do produto, com o custo à vista: a agenda do profissional 1 vai
  até 23:00 e gera 13 slots, então 20:00, 21:00 e 22:00 ficam invisíveis num dia
  vazio. É o mesmo corte que o n8n fazia, com a diferença de estar declarado. O
  conserto, quando doer, é perguntar o período (manhã/tarde/noite) antes — cabe em
  botão e não esconde nada.
- **A janela da agenda é do barbeiro, e vai de 4 a 10 dias.** A coluna
  `agenda_profissional.janela_agendamento_dias` já existia, por profissional, e a API
  já a respeitava nas três rotas. Mudou a faixa: era 7 a 15.
  - **Por que o teto caiu para 10:** uma seção de `list` do WhatsApp aceita no máximo
    10 linhas, e acima disso a Meta recusa a mensagem **inteira**. Com o teto em 10,
    tudo que o dono configura é exibível — não existe dia com vaga que o cliente não
    consegue ver.
  - **Por que o piso caiu para 4:** com o teto em 10, a faixa 7..10 daria uma barra de
    três passos. E quem quer agenda curta não tinha como pedir menos de uma semana.
  - **O bot não manda `days=`.** A rota `dias-disponiveis` usa a configuração do
    profissional quando o parâmetro vem ausente. É isso que impede o defeito do n8n,
    onde três tetos diferentes brigavam (15 pedido à API, `slice(0,7)` no código,
    `slice(0,10)` no payload) e o menor vencia em silêncio. Uma régua só: o slider do
    dono.
  - A faixa está escrita em três lugares que mudam juntos — o `CHECK` da tabela
    (migração `20260730190000`), `normalizeBookingWindowDays` no `server.js` e
    `JANELA_MIN_DIAS`/`JANELA_MAX_DIAS` em `CALENDARIO/lib/utils.ts`. A barra existe
    **duas vezes** na interface (`AgendaSettingsModal` e o painel do `Sidebar`); as
    duas passaram a ler a constante em vez de repetir os números.

**Por quê importa:** é a primeira regra que atravessa os dois sistemas — o dono
configura no painel e o cliente vê no WhatsApp. O teto de 10 não é preferência de
layout, é limite da Meta; afrouxá-lo no calendário quebra o bot, e o sintoma seria a
mensagem não chegar.

## [2026-07-30] O espelho da conversa no painel do dono

O bot copia a conversa para o CRM do calendário (`POST /whatsapp/events`), que estava
de pé e sem ninguém escrevendo desde que os nós `Saída #N` do n8n morreram.

- **Os dois lados, sempre.** A mensagem do cliente **e** cada resposta que o bot
  realmente enviou. Só um lado deixaria o painel contando meia conversa.
- **A entrada é espelhada mesmo quando o bot fica calado.** A trava de rajada existe
  para calar o bot, e é justamente aí que o dono mais precisa ver o que o cliente está
  escrevendo. O que a trava suprimiu não foi para o cliente e não vai para o painel.
- **O espelho nunca atrasa nem derruba o atendimento.** Roda depois do envio, e toda
  falha vira log. Painel atrasado é chato; cliente esperando por causa do painel é
  inaceitável.
- **Idempotência pelo `whatsapp_message_id`**, nas duas pontas: o `wamid` da Meta na
  entrada, e **o `wamid` que a Meta devolve no envio** na saída — por isso
  `criarEmissor` passou a ler `messages[0].id` em vez de descartar a resposta. Sem id
  estável, uma repetição duplicaria a fala do bot e a conversa apareceria gaguejando
  para o dono. Verificado contra o banco real: a mesma entrada mandada duas vezes
  produziu **uma** linha.
- **O texto do painel sai da própria ação enviada**, nunca de uma paráfrase. No n8n o
  espelho era escrito à mão num nó separado, e as duas versões divergiam — o painel
  dizia `"Qual dia você prefere? para o agendamento"` e o WhatsApp dizia
  `"*Qual dia você prefere?*"`. Duas verdades para a mesma frase, e a errada era a que
  o dono lia.
- **O nome do painel é o do cadastro, com o perfil do WhatsApp como reserva**
  (decisão do dono do produto). Isto **não** afrouxa a regra de que o bot só chama
  pelo nome quem se apresentou: no painel o nome é para o dono **ler**, nunca para o
  bot **dizer**.
- **O rate limit da rota subiu de 30 para 600/min.** O bot é um IP só atendendo todos
  os clientes, e um agendamento inteiro gera ~14 chamadas — dois clientes no mesmo
  minuto estouravam o teto antigo, e o terceiro sumiria do painel sem ninguém notar,
  porque o espelho falha em silêncio de propósito. A rota é protegida por token, então
  o balde estreito defendia pouco.
- **O token é opcional no bot** (`CALENDARIO_WEBHOOK_TOKEN`). Sem ele o espelho
  simplesmente não existe e o atendimento continua igual — melhor que derrubar o
  serviço na subida por causa de uma integração acessória.

**Por quê importa:** é a segunda costura entre os dois sistemas, e a primeira em que o
bot escreve no território do calendário. A regra de dono de tabela continua valendo —
quem escreve nas tabelas `whatsapp_*` é a API do calendário, pela rota dela; o bot
pede, não escreve direto.

## [2026-07-29] Processo de curadoria de skills/conhecimento
- **Regra:** todo repositório, skill ou conhecimento trazido passa por: (1) avaliação
  crítica de encaixe, (2) busca cruzada (find-skills + GitHub) só se fizer sentido,
  (3) checagem de sobreposição com o que já está registrado nesta pasta e em
  `docs/skills-log.md`, (4) registro do veredito. Nunca se adota um repositório
  inteiro quando só uma parte serve — extração parcial é o padrão quando aplicável.
- **Por quê importa:** definido explicitamente pelo usuário — nada entra no ambiente
  "porque pode ser útil algum dia".
- **Como aplicar:** ver `docs/skills-log.md` para o processo completo de curadoria de
  skills instaláveis, e o README.md desta pasta para conhecimento não-instalável
  (conceitos, vídeos, decisões).

## [2026-07-31] A janela de 24h da Meta: de onde ela conta

A conversa some do painel do dono **22 horas depois da última mensagem DO CLIENTE**,
não da última mensagem qualquer. São duas regras diferentes com âncoras diferentes, e
confundi-las era o defeito:

| O quê | Regra | Fonte |
|---|---|---|
| Some da lista do painel | `service_window_until > agora + 2h` | `whatsapp_contacts` |
| Agrupa na mesma conversa | `service_window_until > agora` | idem, **sem margem** |

- **A janela da Meta só reinicia com mensagem do cliente.** Resposta da empresa não
  estende nada. `whatsapp_contacts.service_window_until` já guardava isso (gravado só
  em `inbound`), mas os dois filtros olhavam `conversations.last_message_at`, que
  avança com qualquer mensagem. O dono responder às 20:00 uma conversa cujo cliente
  falou às 08:00 reiniciava o relógio: a conversa seguia aberta até as 18:00 do dia
  seguinte, **dez horas depois de a janela real ter fechado**.
- **A margem de 2h é do painel, e só dele.** Ela existe para o dono não começar a
  digitar perto do fim — ele lê, pensa e escreve. O agrupamento de mensagens não pode
  ter margem: uma resposta do bot chegando na hora limite partiria a conversa viva em
  duas.
- **A trava de envio usa a janela crua**, sem margem. Bloquear às 22h recusaria
  mensagem que a Meta ainda aceita. Janela fechada → `403` com motivo, nunca 500.
- Nos dois lugares há saída para `service_window_until` nulo, e ela cobre um caminho
  real: se o espelho da entrada falhar e o da saída passar, o contato nasce de um
  `outbound` e fica sem janela.

## [2026-07-31] O dono responde pelo painel, e o bot cala

- **Só o bot fala com a Meta.** O calendário chama `POST /mensagens` do bot em vez de
  montar payload da Cloud API. Duas implementações do mesmo envio divergiriam na
  primeira mudança de versão da Meta, e o token ficaria em dois lugares.
- **Segredo por direção, nunca compartilhado.** `CALENDARIO_WEBHOOK_TOKEN` protege
  bot → calendário; `PAINEL_TOKEN` / `BOT_PAINEL_TOKEN` protege calendário → bot. Um
  valor só para os dois sentidos faria um vazamento abrir as duas portas.
- **Grava depois de enviar.** A mensagem do dono só entra no CRM com o `wamid` na
  mão. Ao contrário, uma falha da Meta deixaria no painel uma mensagem que nunca
  chegou, e o dono ficaria esperando resposta de algo que ninguém leu.
- **O silêncio do bot é DERIVADO do histórico, nunca gravado em coluna.** Ele cala
  enquanto existir mensagem `sender_type = 'human'` para o contato **no dia corrente
  em São Paulo** e **depois do último toque em botão** — mesmo recorte da escada de
  feedback.
  - **Por que não `conversations.status = 'human'`:** aquela coluna é permanente até
    alguém mudar, e a janela de 24h não fecha na virada do dia. Cliente que fala às
    14h, recebe resposta do dono, some, e volta às 10h do dia seguinte encontraria o
    bot mudo com a conversa presa em humano. Com o corte de dia, a meia-noite devolve
    o atendimento sozinha — e como `ultimaResposta` zera junto, o que ele recebe é a
    saudação com o menu, do começo.
  - **Toque em botão devolve a conversa ao bot na hora**, e é checado ANTES do
    silêncio: tocar no menu é pedir o bot com todas as letras.

## [2026-07-31] A etapa do nome: o único texto livre do fluxo

Em todo o resto o bot roteia por id de botão, que nós mesmos escrevemos — conjunto
fechado, nada a interpretar. Aqui a pessoa digita o que quiser e não há LLM. O desenho
troca de objetivo: em vez de **acertar sempre**, garante que **todo erro seja visível e
custe um toque**.

- **A validação é frouxa de propósito; o cartão de conferência é a trava.** Os custos
  são assimétricos: recusar um nome verdadeiro prende o cliente redigitando o próprio
  nome (e cai justo em quem tem nome menos comum); aceitar bobagem aparece no cartão e
  morre ali. Barra só o certo: dígito, caractere solto, símbolo, link, e a lista de
  respostas genéricas do n8n.
- **Uma palavra é aceita.** Pedir o sobrenome sim, **barrar** por causa dele não.
  Um `Victor` na agenda vale mais que um cliente preso num laço, e o barbeiro tem o
  telefone ao lado do nome.
- **O nome é o único campo do cartão que pode estar errado** — barbeiro, dia e hora
  vieram de ids de botão. Por isso ele sai sozinho na primeira linha, em negrito:
  cercado de coisa certa, o olho reconhece o conjunto e passa batido pelo único item
  que precisava de conferência.
- **Todo texto na etapa produz resposta.** Sem exceção, sem trava de rajada, sem
  escada. É o que garante que não exista caminho terminando em silêncio.
  - **A trava de rajada não vale aqui**, e não é gambiarra: ela foi feita para
    adivinhar se o cliente terminou de falar numa rajada de saudações. Aqui o bot fez
    uma pergunta específica e está recebendo a resposta dela. Se valesse, quem responde
    o nome logo depois do botão ficaria sem cartão — e nada o acordaria depois.
- **Acréscimo fecha sem toque; correção reimprime.** `Victor` + `Santos` agenda
  direto. `Vicctor` + `Victor` volta ao cartão, porque é ali que a nossa leitura mais
  erra e pular a conferência seria abrir mão da única que existe. A distinção sai de
  distância de edição, não de contagem de palavras.
- **O `motivo_invalido` do n8n finalmente é usado.** Aquele nó calculava o motivo e
  mandava sempre a mesma frase genérica. A precisão já estava paga.
- **Nenhuma opção permanente de "corrigir nome" no menu** (decisão do dono do
  produto): ficaria na frente de 100% dos clientes todos os dias para resolver algo que
  acontece uma vez na vida de alguns. O lugar dessa correção é o painel do dono.
- **O bot chama pelo primeiro nome; banco e CRM guardam o completo.**
- **`alvoDaAgenda` é a única função que autoriza escrita**, e recusa em quatro casos:
  correção, nome incompleto, Confirmar sem nome ou sem reserva, e texto fora da etapa.

## [2026-08-01] A janela da etapa do nome: o corte é de quem sabe o que a ação significa

Contexto: o primeiro teste ponta a ponta no celular derrubou dois bugs, os dois na
mesma peça — a janela que decide o que o bot enxerga da conversa do dia ao montar a
etapa do nome (`lerEtapaDoNome`, `src/db/eventos.ts`).

**O corte não mora mais no SQL.** Ele era `id >= (último botão do dia)`, dentro da
query. O toque em Confirmar é gravado **antes** de o contexto ser montado (o insert
está no começo da transação, a leitura do contexto vem depois), então ele virava o
próprio corte e a janela `id >= ele mesmo` excluía o nome que o cliente tinha digitado
logo antes. Sintoma: Confirmar reperguntava o nome. Hoje o SQL só entrega o dia, e
`inicioDaEtapa()` faz o corte em TypeScript, lendo o id com o mesmo `lerId` do
roteador. **Regra que fica: o SQL não conhece o significado das ações; quem conhece é
o TypeScript, e é lá que o corte se decide** — pôr `'1.confirmar'` numa string SQL
seria o parser paralelo que este projeto proíbe.

**A fronteira é "o último botão que não seja `confirmar`".** `confirmar` não abre etapa
nenhuma: ele fecha a que está em curso. Todo outro botão continua sendo fronteira, e é
isso que faz `Corrigir nome` descartar as tentativas anteriores sem precisar apagar
nada.

**Nome e reserva têm tempos de vida diferentes, e confundi-los foi o segundo bug.** O
nome recomeça a cada fronteira — é o sentido do Corrigir. A reserva nasce no toque do
horário e vale pelo agendamento inteiro: corrigir o nome não desmarca o horário. Com
os dois no mesmo corte, tocar em `Corrigir nome` apagava a reserva junto, e o bot
respondia "não consegui abrir a agenda" com a agenda no ar. Hoje a reserva varre o dia
(vale o último horário escolhido) e só o nome respeita o corte.

**Por que 189 testes não pegaram nada disso:** a janela vivia inteira dentro da query,
e nenhum teste toca banco. Ela virou função pura (`etapaDoNome`), com teste — e os
testes foram escritos e **vistos falhar** antes do conserto entrar.

## [2026-08-01] O nome do cliente pertence ao cadastro, e é escrito uma vez

`agendamentos` é registro de um atendimento e vai ser podado um dia; `dados_cliente` é
cadastro e não. Enquanto o nome vivia só na linha do agendamento, o cliente que
voltasse depois da poda seria tratado como desconhecido e teria que repetir o nome que
já deu. Por isso `guardarNome()` (`src/db/contatos.ts`) grava em `dados_cliente` no
mesmo momento em que a agenda confirma a marcação — **depois** da confirmação, nunca
antes: gravar na intenção deixaria o cliente cadastrado por um agendamento que o `409`
de vaga tomada recusou.

**Escrita única (`and nome is null`), e o motivo não é performance.** O bot nunca
reescreve porque (a) cliente com nome não vai ser perguntado de novo, e (b) corrigir
nome de cliente cadastrado é do **painel do dono** — reescrever pelo bot passaria por
cima da correção feita à mão. A correção dentro do fluxo continua valendo: `Corrigir
nome` acontece antes do Confirmar, e o que chega ao cadastro é o nome que o cliente
conferiu no cartão.

## [2026-08-01] O cartão de conferência: rótulo no nome, sem rodapé, botão sem emoji

Decisões do dono do produto, tomadas vendo o cartão real no celular:

- O nome sai rotulado — `Nome: *Victor Cardoso*` — e não solto na primeira linha.
- **Sem rodapé.** Ele repetia o que a mensagem curta na frente do cartão já diz, e duas
  instruções para o mesmo gesto competem em vez de somar. Consequência conhecida e
  aceita: o cartão de nome incompleto perdeu a dica "se tiver sobrenome, é só mandar
  abaixo"; se ficar mudo demais no teste, o conserto é na mensagem da frente, **não**
  trazendo o rodapé de volta.
- `Corrigir nome` sem emoji. Seguro porque **o roteador roteia pelo id, jamais pelo
  título** — o fluxo n8n antigo comparava `button_title === '✅ Confirmar'` e trocar o
  emoji quebrava o bot em silêncio.

**Armadilha que isso destravou:** o `footer` era mandado sempre. A Meta rejeita o envio
inteiro (400) quando a chave está presente com valor vazio — mesmo motivo pelo qual o
`header` já era condicional. `rodape` virou opcional no tipo e o `footer` só entra
quando há texto (`src/whatsapp/enviar.ts`).
