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
