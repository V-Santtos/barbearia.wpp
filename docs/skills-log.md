# Skills Log — SaaS Barbearia

Registro de toda skill/repositório/conhecimento avaliado para entrar em `.claude/skills/`.
Processo descrito em `docs/superpowers/specs/2026-07-29-ambiente-skills-barbearia-design.md`.

## [2026-07-29] Graphify (Graphify-Labs/graphify)
- Fonte: https://github.com/Graphify-Labs/graphify
- Veredito: ❌ Rejeitado por ora (candidato futuro, não descartado)
- Motivo: Resolve um problema diferente do que foi pedido (indexação de codebase
  existente em grafo de conhecimento, via AST local + LLM), não uma convenção de
  estrutura de pastas para projeto novo. Números verificados via API do GitHub
  (98.440 estrelas reais, criado 2026-04-03, ativo). Instalar agora não traria valor
  — não há codebase relevante para indexar ainda, e instalar depois não é mais
  arriscado (é uma ferramenta de leitura/análise; hooks de git só reconstroem o
  grafo, não alteram código commitado).
- Ação: Não instalado. **Revisitar na Fase 2**, antes de integrar com o
  `Aplicativo-FULL` (CALENDARIO + SITE-BARB-PROF-UNICO), para mapear aquele
  codebase existente antes de mexer nele.

## [2026-07-29] ruvnet/ruflo (ex-claude-flow)
- Fonte: https://github.com/ruvnet/ruflo
- Veredito: ❌ Rejeitado
- Motivo: Sobrepõe diretamente a orquestração nativa de subagentes do Claude Code
  (ferramenta `Agent`) e as skills já configuradas para isso (`dispatching-parallel-
  agents`, `subagent-driven-development`). É um "meta-harness" de agentes de IA —
  rebrand do `claude-flow` do mesmo autor — com escopo inchado (100+ agentes, memória
  vetorial própria, workers de background, 35 plugins incluindo trading) e linguagem
  de marketing pouco substanciada ("SONA neural patterns", "self-learning
  intelligence"). Números reais verificados via API: 66.503 estrelas, MIT, ativo, mas
  793 issues abertas e repo de ~527MB. Trazido sem intenção específica do usuário
  ("terceiro falou que era bom"), avaliado para ambos os usos plausíveis (ferramenta
  de dev ou motor do bot) e nenhum se justifica — o segundo caso violaria a regra de
  V1 custo-benefício/sem over-engineering (`REGRAS-APRENDIZADOS/REGRAS.md`).
- Ação: Não instalado. Não revisitar a menos que surja um caso de uso concreto que
  as ferramentas nativas não cubram.

## [2026-07-29] mcollina/skills@fastify-best-practices
- Fonte: https://skills.sh/mcollina/skills/fastify-best-practices
- Veredito: ⏸️ Avaliado, adoção pendente
- Motivo: Skill de altíssima qualidade (autor: Matteo Collina, cocriador/mantenedor
  do Fastify; 1.883 estrelas no repo; 30.7K instalações da skill; MIT; ativo).
  Cobre arquitetura de plugins/encapsulamento, rotas, schemas, DB, deploy, testes.
  Porém: a stack do motor do bot WhatsApp (webhook + máquina de estado do fluxo de
  botões) ainda não foi decidida — instalar uma skill específica de Fastify antes de
  travar a stack seria prematuro. Usuário vai trazer material próprio para embasar
  essa decisão de arquitetura.
- Ação: Não instalado. Aguardando decisão de stack do motor do WhatsApp (spec
  separado, a ser aberto quando o usuário trouxer o mapeamento).
