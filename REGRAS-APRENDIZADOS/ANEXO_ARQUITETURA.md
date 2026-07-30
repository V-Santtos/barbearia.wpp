# Anexo: Arquitetura

Base de conhecimento acumulada sobre arquitetura/infraestrutura do SaaS. Cada entrada
cita a fonte. Ao trazer conhecimento novo sobre este tema, buscar aqui primeiro por
sobreposição antes de adicionar.

## [2026-07-29] Padrão clássico de escala horizontal (Reels Instagram)
- **Fonte:** https://www.instagram.com/reels/DYYmoYHMs8O/ (transcrito via yt-dlp +
  ffmpeg + faster-whisper, modelo `small`, PT)
- **Conteúdo:** modelo de arquitetura escalável em 4 camadas —
  1. DNS → Load Balancer (ponto de entrada único, distribui requisições)
  2. Servidores replicados stateless (escala horizontal: sobe réplica nova, load
     balancer redistribui; se uma cai, as outras seguram)
  3. Banco de dados com replicação master (escrita) / replicas (leitura) — evita
     gargalo de I/O
  4. Cache na frente do banco para dados quentes (resposta em milissegundos, tira
     carga do banco)
- **Avaliação:** tecnicamente correto, é o padrão "system design 101" de escala
  horizontal, amplamente estabelecido. Porém é conhecimento **genérico de topologia de
  infraestrutura** — não é um repositório/artefato instalável, não nomeia tecnologia
  específica, e é **ortogonal à escolha de linguagem/framework** (qualquer stack pode
  rodar atrás de um load balancer).
- **Cruzamento com a regra de plataforma ([[REGRAS]] — Vercel Pro + Supabase Pro):**
  das 4 camadas do vídeo, 3 já vêm resolvidas nativamente pela plataforma-alvo:
  - Load balancer + réplicas de servidor → cobertos por Vercel Fluid Compute
    (escala automática de funções, sem provisionamento manual).
  - Replicação master/replica de banco → coberto por Supabase Pro (read replicas e
    connection pooling nativos, sob demanda).
  - **Cache é a única camada que continua sendo uma escolha ativa nossa** (ex.:
    Upstash Redis via Vercel Marketplace) — não vem de graça de nenhuma das duas
    plataformas.
- **Aplicabilidade à V1:** baixa/nula por ora. V1 é "custo-benefício" (ver
  `REGRAS.md`) e não tem volume de tráfego que justifique preocupação com escala de
  infraestrutura agora. Guardado aqui como referência para quando o produto crescer
  (V2, ou V1 em alto volume) — nesse momento, a decisão prática já estará em boa
  parte pré-resolvida pela escolha de plataforma, restando avaliar cache.
- **Status:** conhecimento de fundo, não aplicado ainda. Revisitar quando houver sinal
  real de necessidade de escala (não antes).

## [2026-07-29] ORM vs. driver nativo (Reel Facebook)
- **Fonte:** https://www.facebook.com/reel/2398255274030212 (transcrito via yt-dlp +
  ffmpeg + faster-whisper, modelo `medium`, PT)
- **Conteúdo:** conectar banco com driver nativo puro (mapear coluna a coluna na mão)
  é lento e propenso a erro; a alternativa é um ORM, que mapeia automaticamente e
  acelera o desenvolvimento. Conteúdo genérico (não cita nenhuma biblioteca
  específica), mas correto como princípio.
- **Avaliação e decisão:** esse vídeo expôs um buraco real na decisão de stack já
  travada (`REGRAS.md` — "Stack do motor do bot") — tínhamos decidido "estado em
  Supabase Postgres" sem nunca decidir como o código fala com o banco. Diferente da
  primeira entrada deste anexo (que ficou como conhecimento de fundo), aqui havia
  contexto suficiente pra decidir na hora: **Drizzle ORM**, por ser TypeScript-first,
  leve, sem passo de geração no build, e consistente com a escolha de Hono sobre
  Fastify (mesma razão: leveza em ambiente serverless). Ver `REGRAS.md` para a
  decisão completa.
- **Status:** aplicado à decisão de stack, não é mais conhecimento parqueado.
