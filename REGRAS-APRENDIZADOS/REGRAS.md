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
