# CONTEXTO.md

Memória de curto prazo do projeto. Diferente de `REGRAS-APRENDIZADOS/` (que é
permanente): este arquivo reflete **onde estamos agora** e muda a cada etapa.
Ler primeiro ao retomar uma sessão resetada.

## O que é o projeto

SaaS de agendamento para barbearias (ver `docs/superpowers/specs/` para o
escopo completo). V1 = bot de botões no WhatsApp + espelhamento num app de
calendário próprio (`Aplicativo-FULL`, repositório separado). Dividida em
Fase 1 (WhatsApp Cloud API + webhook) e Fase 2 (integração com o calendário).

## Onde estamos agora (2026-07-29)

Ainda na etapa de **mapeamento de ambiente e curadoria de conhecimento** —
nenhuma linha de código do produto foi escrita. `BARBEARIA/` (onde o app vai
morar) está vazia.

## O que já foi validado / decidido (travado)

Decisões completas com justificativa em `REGRAS-APRENDIZADOS/REGRAS.md`:

- **Plataforma:** Vercel Pro (compute) + Supabase Pro (banco/auth).
- **Stack do motor do bot:** Node.js + TypeScript + Hono (não Fastify — o
  calendário existente usa Fastify, mas são repos separados).
- **Acesso a banco:** Drizzle ORM.
- **Estado de conversa:** tabela `conversas` no Supabase Postgres, sem Redis.
- **Multi-tenancy:** RLS + `tenant_id` em toda tabela.
- **Auth:** Supabase Auth.
- **Billing:** Asaas (principal). AbacatePay avaliado e parqueado como
  candidato (`ANEXO_PAGAMENTOS.md`).
- **Filas/lembretes:** padrão outbox (tabela `envios_pendentes`) + Vercel Cron.
- **Observabilidade:** Sentry + logs JSON + tabela `webhook_eventos`.
- **Testes:** máquina de estados pura + Vitest + msw.

Skills adotadas em `.claude/skills/`: `tool-design`, `ponytail-audit`,
`ponytail-debt` (todas parciais — ver `docs/skills-log.md` pro que ficou de
fora e por quê). Repos rejeitados: `Graphify` (parqueado p/ Fase 2),
`ruvnet/ruflo`, `affaan-m/ECC`.

## Próximo passo

**Decidido em 2026-07-29: começar a codar.** Sinal verde dado pelo usuário para
sair da fase de mapeamento e criar o esqueleto de código dentro de
`BARBEARIA/` — package.json, tsconfig, Hono + Drizzle configurados, conforme
`REGRAS-APRENDIZADOS/REGRAS.md`. Sessão anterior foi resetada logo após esta
decisão; nenhum arquivo de código foi criado ainda quando o reset aconteceu.

Ao retomar: confirmar com o usuário se o esqueleto inicial é o primeiro passo
mesmo, ou se ele quer trazer o fluxo n8n de referência antes (mencionado no
início do projeto, ainda não entregue) para desenhar o fluxo de botões da
Fase 1 antes de codar a base.

## Pendências em aberto (não travadas ainda)

- Testar o modo de coexistência da WhatsApp Cloud API (número já configurado
  na Meta, coexistência ainda não usada/testada).
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
