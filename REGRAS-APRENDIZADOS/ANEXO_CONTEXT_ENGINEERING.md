# Anexo: Context Engineering (agentes de IA)

Mapa das 17 skills do repositório
[muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering)
(MIT, 17.501 estrelas em 2026-07-29). Avaliação completa em `docs/skills-log.md`.

Este repo ensina a projetar sistemas de **agentes de IA não-determinísticos**
(memória, multi-agente, avaliação de pipeline de LLM). O bot da Fase 1 é uma máquina
de estados determinística de botões — a maior parte não se aplica ainda. Só uma foi
trazida agora; as outras 16 ficam mapeadas aqui para consulta ou download futuro,
sem precisar reavaliar o repositório do zero.

## ✅ Adotada agora

- **`tool-design`** — contratos de ferramenta/agente, consolidação de tool-set,
  descrições não-ambíguas. Instalada em `.claude/skills/tool-design/`.
  Motivo: aplica-se imediatamente à nossa própria operação — toda vez que usarmos
  `skill-creator` para criar uma skill nova do projeto, ou desenharmos contratos
  internos de API/webhook, esse conhecimento melhora o resultado.

## ✅ Sistema de memória do repositório (2026-09-08)

Fonte adicional:
`C:\Users\victo\Desktop\agent-memory-engineering\SKILL.md`.

O conhecimento foi adotado de forma parcial e operacional, usando a estrutura que o
projeto já possuía:

| Camada | Arquivo | Regra de escrita |
|---|---|---|
| Roteamento compartilhado | `AGENTS.md` e `<pasta>/AGENTS.md` | Curado; curto; aponta, não duplica |
| Estado da etapa | `CONTEXTO.md` | Mutável; somente o que pode envelhecer |
| Memória durável | `REGRAS-APRENDIZADOS/` | Fonte, data e supervisão humana |
| Curadoria externa | `docs/skills-log.md` | Um veredito auditável por fonte |
| Scratchpad individual | Fora do Git | Nunca promovido automaticamente |

Toda escrita em memória compartilhada usa controle otimista: hash na leitura, novo
hash imediatamente antes da gravação e releitura quando houver divergência. O Git
fornece versionamento e rollback. O `AGENTS.md` da pasta funciona como
permissionamento por escopo: `CALENDARIO/` é a frente ativa; `BARBEARIA/` é
leitura contextual por padrão.

Não foi criado outro memory store. O padrão de `dreaming` permanece parqueado até
existirem múltiplas sessões/transcrições e um problema repetido que justifique
consolidação assíncrona.

## ⏸️ Parqueadas (baixar sob demanda, não reavaliar do zero)

**Foundational** — relevantes se o produto passar a ter algum componente LLM
conversacional livre (ex.: entendimento de linguagem natural para reagendamento em
V2):
- `context-fundamentals` — mecânica e anatomia da janela de contexto
- `context-degradation` — reconhecer falhas de atenção em sessões longas
- `context-compression` — preservar estado em sessões longas

**Architectural** — relevantes só se o sistema ganhar componentes de IA agentiva de
verdade (não o bot de botões):
- `multi-agent-patterns` — quando/como dividir trabalho entre sub-agentes
- `long-horizon-prompting` — briefings de tarefa para agentes autônomos
- `memory-systems` — persistência de conhecimento entre sessões
- `filesystem-context` — descoberta de contexto via sistema de arquivos
- `hosted-agents` — infraestrutura de agentes em background com sandbox

**Operational** — relevantes para pipelines de LLM em produção, que não temos ainda:
- `context-optimization` — compactação e estratégias de cache
- `latent-briefing` — compartilhamento de estado KV cache entre workers
- `evaluation` — quality gates determinísticos para pipelines de agente
- `advanced-evaluation` — técnicas de LLM-as-judge
- `harness-engineering` — loops autônomos com rollback
- `self-improvement-loops` — harnesses de agente auto-modificáveis

**Methodology**:
- `project-development` — design de ciclo de vida de projetos com LLM
- `bdi-mental-states` — modelagem belief-desire-intention

## Gatilho para revisitar

Reabrir esta lista quando (o que vier primeiro):
1. A V2 introduzir qualquer componente de linguagem natural livre (não botões) no
   fluxo do WhatsApp — aí `context-fundamentals`, `context-compression` e
   `multi-agent-patterns` entram em pauta primeiro.
2. Construirmos testes/avaliação sistemática para lógica não-determinística — aí
   `evaluation` entra em pauta.
3. Criarmos skills internas via `skill-creator` com frequência — reforçar consulta a
   `tool-design` (já adotada).
