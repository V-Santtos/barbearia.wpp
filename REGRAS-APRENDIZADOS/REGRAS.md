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
  footer, que `button` não aceita. Decisão do dono do produto: visual completo.
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
