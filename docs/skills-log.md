# Skills Log — SaaS Barbearia

Histórico de avaliações. As entradas antigas registram decisões da época; o inventário
abaixo define o que está instalado agora.

## [2026-09-26] Limpeza das skills locais

Pedido do Victor: manter apenas habilidades usadas diretamente na casca do agendamento
e no painel. Permanecem em `.agents/skills/`:

- `frontend-design` — direção visual;
- `mobile-ux-patterns` — PWA e interação no celular;
- `web-design-guidelines` — revisão de acessibilidade e interface.

Permanece em `.claude/skills/` somente `ponytail-debt`, porque o projeto usa
marcações `ponytail:` para revisar simplificações deliberadas.

Saíram do carregamento do projeto: `impeccable` (sobreposição com as skills visuais,
153 arquivos), `mobile-app-ux-auditor` (foco nativo e sobreposição no PWA),
`improve-codebase-architecture` e `codebase-design` (auditoria ampla fora da etapa),
`supabase` e `supabase-postgres-best-practices` (backend e banco conduzidos pelo dev),
`ponytail-audit` (auditoria genérica), `skill-creator` (capacidade já disponível fora
deste repo) e a skill não commitada `deploy-to-vercel` (deploy fora da etapa).

Os arquivos retirados estão guardados fora do repositório em
`C:\Users\victo\Desktop\Referencias\skills-retiradas-saas`; as cópias versionadas
também podem ser recuperadas pelo Git. `skills-lock.json` foi retirado por não restar
skill instalada por esse gerenciador. As junctions antigas de `.claude/skills/`
apontavam para um caminho anterior do projeto e também foram retiradas.

Processo histórico descrito em
`docs/superpowers/specs/2026-07-29-ambiente-skills-barbearia-design.md`.

## [2026-09-16] UI/UX mobile para o calendário

- Fontes:
  - https://github.com/lumusitech/AI/tree/main/skills/mobile-ux-patterns
  - https://github.com/AjnasNB/mobile-app-ux-auditor-skill
- Veredito: ✅ **Adoção composta das duas skills, escopada ao mobile**.
- Motivo:
  - `mobile-ux-patterns` é a referência principal para o React/PWA do calendário:
    trata touch targets, zonas do polegar, navegação inferior, bottom sheets,
    formulários, teclado, safe areas, gestos e estados offline. Parte dos exemplos
    usa sintaxe Angular, mas as decisões de UX e CSS são portáveis para React DOM.
  - `mobile-app-ux-auditor` complementa com um processo de revisão por fluxo e
    severidade (P0–P3), incluindo acessibilidade, adaptação de layout, teclado,
    interrupções e estados de erro. A lista oficial de frameworks é majoritariamente
    nativa; no PWA, o scanner Python serve apenas como triagem e cada achado precisa
    ser confirmado no código e no aparelho.
  - Ambas usam licença MIT. São projetos jovens e com baixa adoção pública; por isso
    entram como orientação e checklist, nunca como autoridade acima das decisões já
    validadas com o dono ou do design system existente.
  - `trmquang93/mobile-design-kit` foi avaliada e não trazida: força um design system
    paralelo e proíbe roxo no alvo iOS, em conflito direto com a marca já aprovada.
- Ação: instaladas somente as pastas necessárias em
  `.agents/skills/mobile-ux-patterns/` e
  `.agents/skills/mobile-app-ux-auditor/`. Nenhum hook, plugin, instalador de
  terceiro ou dependência de runtime foi ativado.

## [2026-09-08] Engenharia de memória + arquitetura + design do calendário

- Fontes:
  - `C:\Users\victo\Desktop\agent-memory-engineering\SKILL.md`
  - https://www.skills.sh/mattpocock/skills/improve-codebase-architecture
  - https://www.skills.sh/vercel-labs/agent-skills/web-design-guidelines
  - https://www.skills.sh/anthropics/skills/frontend-design
- Veredito: ✂️ **Adoção composta e escopada**.
- Motivo:
  - `agent-memory-engineering` entra pelo sistema de arquivos, disclosure
    progressiva, versionamento e conferência de hash. O padrão assíncrono de
    `dreaming` fica fora: não há frota de agentes nem lote de transcrições que
    justifique a infraestrutura.
  - `improve-codebase-architecture` e sua dependência `codebase-design` entram
    para mapear atrito e aprofundar modules antes de mover arquivos. O fluxo foi
    escopado ao `CALENDARIO/`; `BARBEARIA/` é apenas contexto de contrato.
  - `frontend-design` entra como direção de criação e remodelagem visual.
  - `web-design-guidelines` entra como auditoria enxuta de acessibilidade e
    qualidade web, buscando as regras atuais antes de cada revisão.
- Sobreposição: 🥊 `frontend-design` + `web-design-guidelines` cobrem parte do
  espaço do `impeccable`, mas ainda não cobrem seu detector e o fluxo de inspeção
  visual. Como o usuário sugeriu **talvez** removê-lo, ele fica marcado como
  candidato à exclusão, sem ser apagado nesta rodada. Critério: validar uma rodada
  completa do calendário com as duas skills novas; se não houver lacuna prática,
  remover os 153 arquivos (~3,15 MB) e a junction antiga de `.claude/skills/`.
- Ação:
  - Criados `AGENTS.md`, `CALENDARIO/AGENTS.md` e `BARBEARIA/AGENTS.md` como
    roteadores progressivos; a memória durável continua em
    `REGRAS-APRENDIZADOS/`, sem uma segunda fonte concorrente.
  - Skills externas pequenas mantidas em `.agents/skills/` para portabilidade e
    versionamento.
  - Auditoria arquitetural do calendário gerada como relatório temporário, sem
    refatorar o código antes da escolha do candidato.

## [2026-09-08] arhamkhnz/next-shadcn-admin-dashboard
- Fonte: https://github.com/arhamkhnz/next-shadcn-admin-dashboard
- Veredito: ✂️ Adotado parcial — só **vocabulário de ícone** e **gramática de layout**.
  Zero código, zero dependência, nada instalado.
- Motivo: trazido pelo dono para adiantar o painel (dashboard/analytics + financeiro).
  A cópia original ficava em `%TEMP%/claude/eval/shadcn-admin` e perdeu os arquivos
  de origem. Em 2026-09-26, Victor pediu para guardar a referência fora do produto;
  clone íntegro recuperado em `C:\Users\victo\Desktop\Referencias\dashboard-shadcn-admin`
  (commit `4728475584809adebe7775b05ab2ff4eb342b276`).
  Next 16 + Turbopack + React 19 + Tailwind v4 + shadcn; `npm ci` em 35s, sobe em
  3,5s, sem `.env` — é template estático com dado mock.
  - **O que NÃO dá para aproveitar, e é a maior parte:** a stack é incompatível.
    O `CALENDARIO/` é React DOM + Vite com sistema de tokens CSS próprio (11
    arquivos numerados); importar página de lá é importar um segundo design system.
  - **Boa parte do que parece pronto não é.** Verificado clicando: o "Add event"
    do calendário e o "Quick Create" da sidebar são `<Button>` **sem `onClick`** —
    decorativos. Não existe `eventClick`, `dateClick`, `eventAdd` nem `selectable`
    em `src/` inteiro: a página de calendário é casca visual. Confirmado idêntico
    no demo oficial do autor, então não é defeito do clone. (O template não é
    inerte por inteiro: há 60 `onClick` no `src/` e a tabela arrastável do
    dashboard legado usa dnd-kit de verdade.)
  - **O que foi aproveitado, e por quê:**
    1. **Nomes de ícone.** Os dois projetos usam `lucide-react`, então o
       aproveitamento é de vocabulário, não de código. Todos verificados contra a
       nossa versão (0.552.0) — existem, sem atualizar dependência.
    2. **A estrutura da coluna da esquerda:** marca no topo, ação primária logo
       abaixo, seções com rótulo, e a coluna inteira recolhendo para só ícones.
       Copiada a forma, não o CSS.
  - **O que foi deliberadamente NÃO copiado:** o conjunto de ícones inteiro. Ele é
    retilíneo (`MessageSquare`, `LayoutDashboard`, `Banknote`) e este app é
    pílula/círculo. Ver a regra do conjunto em `REGRAS.md` (2026-09-08).
- Ação: nada instalado no repo do produto. A cópia estável acima é apenas
  referência visual; não importar sua stack ou tratá-la como base do sistema.

## [2026-08-04] callstack/liquid-glass
- Fonte: https://github.com/callstack/liquid-glass
- Veredito: ❌ Rejeitado — plataforma errada, e sem nada extraível
- Motivo: Trazido pelo dono pra melhorar o vidro do dock. Números verificados via
  API do GitHub em 2026-08-04: 1.605 estrelas, 60 forks, **5 issues abertas**,
  criado em 02/09/2025, último push em 16/06/2026 — repo pequeno, saudável e ativo.
  Nada contra a qualidade dele; o problema é encaixe.
  - **É React Native, só iOS.** Exige RN 0.80+, Xcode ≥ 26 e compilação nativa;
    não roda no Expo Go. O `CALENDARIO/` é React DOM servido pelo Vite, rodando
    no navegador do celular. Não existe build web — não é caso de adaptar, é caso
    de não haver ponto de entrada.
  - **E não há o que portar.** A árvore inteira do `ios/` é uma casca fina em
    cima do `UIGlassEffect` da Apple; o `src/` é encanamento de props em
    TypeScript. A lente, o brilho especular e a resposta ao toque acontecem
    dentro do iOS, fechado. Diferente do `tool-design` e do `ponytail-audit`,
    aqui não existe "só uma parte que serve" — não existe parte nenhuma.
  - **O que ele entregou de valor foi a lista de botões**, não código: a API
    expõe `interactive` (resposta ao toque), `effect: clear | regular`,
    `tintColor`, `colorScheme` e um `LiquidGlassContainerView` com `spacing`,
    que funde vidros vizinhos. Isso é o inventário do que a Apple considera
    parte do material — e serviu de checklist contra o que o dock já tinha.
  - **Teto conhecido, registrado antes de morder:** a refração de verdade (o
    fundo entortando na borda) precisa de `feDisplacementMap` via
    `backdrop-filter: url(#filtro)`, e **isso não funciona no WebKit** — ou seja,
    justamente no iPhone que é o aparelho de teste. Não existe Liquid Glass
    "exato" no navegador hoje; o que dá é a aproximação honesta (fio especular
    direcional + franja cromática + mola no toque), que foi o caminho tomado.
- Ação: Não instalado, nada extraído. Melhorias aplicadas à mão em
  `CALENDARIO/components/dashboard/css/10-mobile.css` e `MobileBottomNav.tsx`
  (decisões em `REGRAS-APRENDIZADOS/REGRAS.md`, 2026-08-04). Revisitar só se o
  produto virar app nativo em React Native — aí ele passa a ser a escolha certa.

## [2026-08-01] pbakaus/impeccable
- Fonte: https://github.com/pbakaus/impeccable
- Veredito: ✂️ Adotado parcial (só a skill; nada de hooks, CLI, extensão ou adaptadores)
- Motivo: Trazida pelo usuário para a **tarefa 4 do protótipo do Dashboard**
  ("passar a camada de design com a skill que ele indicar" —
  `Dashboard/CONTEXTO_SESSAO.md`), então o encaixe é direto e pedido, não
  especulativo. Números verificados via API do GitHub em 2026-08-01: **53.724
  estrelas**, 3.198 forks, **41 issues abertas** (proporção saudável), criado em
  16/11/2025, último push **no mesmo dia da avaliação** — ativo de verdade.
  Apache 2.0. Autor: Paul Bakaus. O README declara que partiu do `frontend-design`
  da Anthropic e acrescenta 23 comandos, 36 documentos de referência e 59 regras
  determinísticas de detecção.
  - **Sem sobreposição** com o que já temos: `ponytail-audit` mede
    over-engineering de código, não desenho; `dataviz` cobre gráfico, não tela;
    `frontend-design` não existe neste ambiente. O buraco que ela preenche é real.
  - **O inchaço está no repositório, não na skill.** O repo inteiro tem 60 MB e
    2.942 arquivos, com `cli/`, `extension/`, `plugin/`, `tests/`, `demos/` e uma
    dúzia de pastas de adaptador por ferramenta (`.gemini`, `.codex`, `.cursor`,
    `.grok`, `.kiro`, `.opencode`, `.pi`, `.qoder`, `.rovodev`, `.trae`, `.vibe`).
    Esse espalhamento é o mesmo padrão que reprovou `ruvnet/ruflo` e `affaan-m/ECC`
    — a diferença é que aqui ele é separável: a skill sozinha são **152 arquivos,
    3,0 MB**, e os scripts importam **só builtins do Node**, sem dependência
    externa e sem chave de API.
  - **Risco de conflito de memória, registrado antes de morder:** `/impeccable
    init` escreve `PRODUCT.md` e `DESIGN.md` **na raiz do projeto**. Duas fontes de
    verdade de projeto competindo foi exatamente o que reprovou o ECC. Se `init`
    rodar, os arquivos vão para dentro de `Dashboard/`, junto do
    `uploads/ANEXO_DESIGN_SYSTEM_DASHBOARD.md`, nunca na raiz.
- Ação: Copiada `.agents/skills/impeccable/` (152 arquivos) para
  `.agents/skills/impeccable`, com junction em `.claude/skills/` — mesmo padrão do
  `supabase/agent-skills`. `SOURCE.md` escrito na pasta. **Nenhum hook ligado** em
  `settings.json` (mesma decisão tomada com os hooks do `ponytail`), e
  `skills-lock.json` não foi tocado, porque a adoção é parcial e manual.

## [2026-07-30] supabase/agent-skills (oficial Supabase)
- Fonte: https://github.com/supabase/agent-skills
- Veredito: ✅ Adotado integral (as 2 skills)
- Motivo: Repositório **oficial do Supabase**, MIT, ativo — a autoridade que faltou
  nas buscas de skill de Hono e de Drizzle (ambas recusadas por repo de baixa
  autoridade). Só tem 2 skills, e as duas servem, em momentos diferentes — por isso
  a regra de "não adotar o repo inteiro quando só uma parte serve" não se aplica
  aqui. Conteúdo verificado antes de instalar (árvore do repo + leitura do
  `SKILL.md` das duas + do `security-rls-performance.md`): substância técnica real,
  sem marketing.
  - `supabase-postgres-best-practices` — 34 referências curtas (~1,5 KB cada) por
    categoria (query, conn, lock, monitor, schema, security, data, advanced).
    Aplicação imediata: `security-rls-performance.md` ensina que
    `using (auth.uid() = user_id)` executa a função **por linha** e
    `using ((select auth.uid()) = user_id)` executa uma vez — relevante direto
    porque RLS + `tenant_id` em toda tabela é decisão travada no `REGRAS.md`.
  - `supabase` — guia amplo (12 KB). O valor está no checklist de segurança:
    `user_metadata` é editável pelo usuário e não serve pra RLS (usar
    `app_metadata`); view ignora RLS sem `security_invoker = true`; `UPDATE` sem
    política de `SELECT` falha em silêncio (0 linhas, sem erro); `UPDATE` sem
    `WITH CHECK` permite reatribuir a linha a outro dono; `TO authenticated`
    sozinho é IDOR; `SECURITY DEFINER` em `public` é endpoint público por padrão.
    Também instrui a não confiar em dado de treino e buscar o changelog — postura
    correta pra uma plataforma que muda rápido.
  - Sem conflito com `REGRAS-APRENDIZADOS/`: é referência técnica, não um sistema
    de memória/processo concorrente (foi exatamente o que reprovou o ECC).
- Ação: Instalado com `npx skills add supabase/agent-skills`. Arquivos em
  `.agents/skills/` (padrão aberto Agent Skills), com junctions em
  `.claude/skills/`. Criou também `skills-lock.json` na raiz. A instalação declara
  suporte a 73 agentes mas **não** espalhou pasta de configuração pra ferramentas
  que não usamos — nada de `.gemini`, `.codex` etc.
- Relacionado: MCP oficial do Supabase adicionado no mesmo dia (`.mcp.json`,
  escopo de projeto, endpoint `mcp.supabase.com` com `read_only=true` e features
  `docs,database,functions`), pendente de autenticação OAuth pelo usuário em
  terminal interativo.

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
