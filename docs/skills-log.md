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

## [2026-07-29] muratcankoylan/Agent-Skills-for-Context-Engineering
- Fonte: https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering
- Veredito: ✂️ Adotado parcial
- Motivo: 17.501 estrelas, MIT, 40 issues abertas (saudável), conteúdo de alta
  qualidade e substância real (verificado lendo `tool-design` e `evaluation` na
  íntegra) — nada de marketing vazio. Mas o repositório ensina a projetar sistemas
  de agentes de IA não-determinísticos (memória, multi-agente, avaliação de
  pipeline de LLM); o bot da Fase 1 é uma máquina de estados determinística de
  botões, não um agente de IA livre. Só `tool-design` tem aplicação imediata: ajuda
  a escrever descrições de ferramenta/skill não-ambíguas, relevante sempre que
  usarmos `skill-creator` ou desenharmos contratos internos de API/webhook.
  Complementar ao `skill-creator` (mecânica de empacotar/testar), não redundante.
- Ação: Extraída só a skill `tool-design` (4 arquivos: SKILL.md + 2 references +
  1 script) para `.claude/skills/tool-design/`, com nota de origem em `SOURCE.md`.
  As outras 16 skills mapeadas em
  `REGRAS-APRENDIZADOS/ANEXO_CONTEXT_ENGINEERING.md`, com gatilhos claros de quando
  revisitar (V2 com linguagem natural livre, avaliação de lógica não-determinística).

## [2026-07-29] mcollina/skills@fastify-best-practices
- Fonte: https://skills.sh/mcollina/skills/fastify-best-practices
- Veredito: ❌ Não instalado (decisão de stack resolvida sem Fastify no bot)
- Motivo: Skill de altíssima qualidade (autor: Matteo Collina, cocriador/mantenedor
  do Fastify; 1.883 estrelas no repo; 30.7K instalações; MIT; ativo) — mas a decisão
  de stack do motor do bot (ver `REGRAS-APRENDIZADOS/REGRAS.md`) fechou em
  **Node.js + TypeScript + Hono**, não Fastify. O calendário existente
  (`Aplicativo-FULL/CALENDARIO`) continua em Fastify, então esta skill pode valer a
  pena **se algum dia mexermos diretamente naquele repositório** — mas não para o
  bot que estamos construindo agora.
- Ação: Não instalado neste repositório. Revisitar apenas se/quando trabalharmos
  diretamente no código do `CALENDARIO` (Fastify) do Aplicativo-FULL.

## [2026-07-29] Stack do motor do bot: Node.js + TypeScript + Hono
- Fonte: `docs/stack-decision-llm-prompt.md` (pergunta estruturada) +
  `docs/resposta.md` (resposta recebida), verificada ponto a ponto antes de travar.
- Veredito: ✅ Decisão travada
- Motivo: ver entrada completa em `REGRAS-APRENDIZADOS/REGRAS.md`
  ("Stack do motor do bot WhatsApp — decisão travada"). Resumo da checagem crítica:
  argumento de cold-start contra Fastify estava parcialmente exagerado (Fluid
  Compute reaproveita instâncias quentes), mas a conclusão (Hono) segue válida por
  ser propósito-específico e mais leve pra um serviço novo de webhook; Vercel Cron
  a cada minuto confirmado (plano Pro); Asaas confirmado como melhor fit de billing
  pro perfil de dono de barbearia brasileiro, com nota adicional sobre Pix
  Automático como migração futura em volume.
- Ação: Nenhuma skill de Hono adotada (nada no catálogo bate a barra de qualidade —
  melhor opção tinha só 645 installs, de um repo de 240 skills convertidas em
  massa, 207 estrelas). Docs oficiais do Hono são enxutos o bastante por ora.

## [2026-07-29] Acesso a banco: Drizzle ORM (sem skill de terceiro)
- Fonte do gatilho: reel do Facebook (transcrito), ver
  `REGRAS-APRENDIZADOS/ANEXO_ARQUITETURA.md`. Busca por skill:
  `bobmatnyc/claude-mpm-skills@drizzle-orm` (4.4K installs no skills.sh, mas repo
  fonte com só 62 estrelas e estrutura confusa/reorganizada — mesmo padrão de baixa
  autoridade já visto com Hono).
- Veredito: ✅ Decisão travada (Drizzle ORM) sem adoção de skill de terceiro
- Motivo: preenche um buraco na decisão de stack já travada (estado em Postgres
  sem definir a camada de acesso). Drizzle é consistente com a razão de termos
  escolhido Hono sobre Fastify (leveza/serverless-first). Nenhuma skill do catálogo
  teve autoridade suficiente para adoção (ver busca acima).
- Ação: Nenhuma skill instalada. Documentação oficial do Drizzle é referência
  suficiente por ora.

## [2026-07-29] DietrichGebert/ponytail
- Fonte: https://github.com/DietrichGebert/ponytail
- Veredito: ✂️ Adotado parcial
- Motivo: 91.693 estrelas, MIT, repo pequeno (2.2MB, sem inchaço), proporção de
  issues saudável (112/91.6k). Tema "yagni" bate direto com regras já registradas
  neste projeto (V1 custo-benefício, rejeição do ruvnet/ruflo por over-
  engineering). Conteúdo lido na íntegra (`AGENTS.md`, `hooks.json`,
  `ponytail-audit`, `ponytail-debt`): substância real, sem marketing vazio,
  mecanismo simples (grep + relatório, não aplica nada sozinho).
  - `/ponytail-review` (revisão de diff): **redundante** com a skill `simplify`
    já disponível neste ambiente — não trazida.
  - Hooks passivos (lembrete de YAGNI a cada prompt): **redundantes** — essas
    instruções já estão fixas no system prompt do Claude, sem risco de deriva
    ao longo da sessão que justifique um hook extra. Adaptadores multi-
    plataforma (Cursor, Windsurf, Copilot, Qoder) irrelevantes aqui.
  - `/ponytail-audit` (varredura do repo inteiro) e `/ponytail-debt` (ledger de
    comentários `ponytail:`): **sem equivalente** no ambiente atual, valor real.
- Ação: Extraídas `ponytail-audit` e `ponytail-debt` para `.claude/skills/`, com
  `SOURCE.md`. Convenção do comentário `ponytail:` registrada em
  `REGRAS-APRENDIZADOS/REGRAS.md`. Core skill de troca de modo (`ponytail`),
  `ponytail-review`, `ponytail-gain`, `ponytail-help` e os hooks não foram
  trazidos.

## [2026-07-29] affaan-m/ECC
- Fonte: https://github.com/affaan-m/ECC
- Veredito: ❌ Rejeitado
- Motivo: 235.582 estrelas (verificadas como atividade genuína — commits reais nas
  últimas ~28 semanas, 5 releases versionadas de março a 27/07, 100+
  contribuidores — não é estrela inflada). Mas é a mesma categoria do
  `ruvnet/ruflo` (já rejeitado), em escala ainda maior: 67 agentes, 281 skills,
  94 comandos, adaptadores pra praticamente toda ferramenta de IA existente
  (.cursor, .gemini, .hermes, .kimi, .kiro, .openclaw, .opencode, .qwen, .trae,
  .vscode, .zed), dashboard Python próprio, segunda versão vivendo junto
  (`ecc2/`). O "Memory Vault" dele entraria em **conflito direto** com
  `REGRAS-APRENDIZADOS/` (duas fontes de memória de projeto competindo — o
  cenário exato que nosso processo de curadoria existe pra evitar). Demais
  peças (TDD, security-review, hooks de sessão) duplicam skills do
  `superpowers` e hooks já configurados aqui.
- Ação: Não instalado, nada extraído. O conceito do `AgentShield` (scanner de
  config de MCP/hooks/secrets, 102 regras) é uma necessidade futura legítima —
  mas está amarrado à infraestrutura própria do ECC, não é um arquivo isolado
  como `tool-design`/`ponytail-audit` foram. Se precisarmos disso, buscar uma
  ferramenta independente e enxuta depois, não extrair deste repositório.
