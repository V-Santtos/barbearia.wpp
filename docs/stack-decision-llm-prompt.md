# Pergunta para outra LLM decidir a stack do SaaS

Prompt pronto para copiar e colar em outra LLM (GPT, Gemini, etc.), auto-contido —
não assume que a outra LLM tem acesso a esta conversa. Escrito em 2026-07-29, depois
de mapear ambiente, skills e conhecimento em `docs/skills-log.md` e
`REGRAS-APRENDIZADOS/`.

---

## PROMPT

Você é um arquiteto de software sênior, especialista em SaaS B2B multi-tenant e em
integrações com APIs de mensageria. Vou te dar o contexto completo de um projeto real.
Quero uma **recomendação de stack fundamentada e específica** — não uma lista genérica
de "depende" ou de opções sem posicionamento. Escolha e defenda uma stack concreta,
apontando trade-offs relevantes e o que evitar.

### O produto

Um SaaS B2B para donos de barbearia gerenciarem agendamentos. O cliente pagante é o
**dono da barbearia** (assinatura mensal da plataforma); o cliente final (quem corta o
cabelo) interage só via WhatsApp, sem pagar nada na plataforma. O produto tem duas
versões planejadas:

**V1 (a construir agora) — "custo-benefício", a mais simples e barata possível:**
Bot de botões de interação no WhatsApp (fluxo determinístico, sem IA generativa) para
agendar/reagendar/cancelar horários, espelhando tudo em um aplicativo de calendário
próprio que o dono da barbearia usa. V1 é dividida em duas fases:
- **Fase 1:** configurar a WhatsApp Cloud API oficial (número já conectado e
  configurado na Meta, mas ainda sem o modo de coexistência com o app do WhatsApp
  Business no celular — isso ainda precisa ser testado/configurado) e validar o
  primeiro evento de webhook pingando corretamente. Depois disso, construir o fluxo de
  botões completo (agendar, reagendar, cancelar).
- **Fase 2:** integrar esse bot com um aplicativo de calendário que já existe e está
  ~95% pronto (ver "Sistema existente" abaixo), espelhando cada agendamento feito pelo
  WhatsApp nesse calendário.

**V2 (visão futura, não implementar ainda, mas a arquitetura de V1 não deveria
inviabilizar):** em vez de tudo pelo WhatsApp, o cliente final recebe um link e agenda
num site de agendamento personalizado por barbearia; reagendamento/cancelamento
continua via WhatsApp. Tudo continua espelhado no mesmo calendário próprio. Pensada
para barbearias maiores/redes, não para o barbeiro autônomo da V1.

### Sistema existente (calendário, ~95% pronto)

Repositório separado, já em produção na Vercel. Estrutura:
- `CALENDARIO/`: API + painel administrativo em **Fastify + Node.js + TypeScript**.
  Segundo a documentação interna do próprio repo, o `server.js` concentra conexão com
  banco, auth, rate limit, regras de agenda, catálogo e WhatsApp/CRM — hoje com
  "memória do WhatsApp" guardada em memória local (sem persistência real ainda dessa
  parte). Há uma pasta `migrations/` com SQLs, mas o banco de dados usado não está
  confirmado.
- `SITE-BARB-PROF-UNICO/`: site público + fluxo de agendamento (relevante para a V2).
- Frontend/app do calendário aparenta ser **Vite + React + TypeScript**, com
  `capacitor.config.ts` (indício de app mobile cross-platform via Capacitor).

O novo serviço do bot do WhatsApp (o que estamos arquitetando agora) será um
**repositório novo e separado**, que na Fase 2 vai se comunicar com esse backend via
API HTTP — não vai herdar código dele automaticamente, mas idealmente deveria
interoperar sem fricção.

### Decisões já travadas (não reconsiderar, a resposta deve respeitar)

- **Hospedagem/compute:** Vercel Pro. Fluid Compute já faz load balancing e escala
  horizontal automática de funções — não é para desenhar isso manualmente.
- **Banco de dados:** Supabase Pro (Postgres gerenciado, com read replicas e
  connection pooling nativos disponíveis sob demanda, mais Auth e Storage).
- **Filosofia de V1:** simplicidade e custo baixo acima de tudo. Nada de
  engenharia de escala prematura (a plataforma já cobre load balancer/réplicas de
  banco). V1 não precisa suportar "milhares de usuários simultâneos" — é para uso de
  poucas dezenas de barbearias no início.
- Existe um fluxo de referência desenhado no n8n (baixo-código) para mapear o fluxo de
  botões do WhatsApp, mas ele **não vai rodar em produção** — serve só de mapa/
  especificação; a automação real será código próprio.

### O que preciso que sua resposta cubra, especificamente

1. **Linguagem/runtime e framework do motor do bot (webhook da Meta + máquina de
   estado do fluxo de botões):** manter Node.js + Fastify + TypeScript (mesma stack do
   calendário existente, zero fricção na Fase 2) ou há um motivo concreto para divergir?
2. **Gestão de estado da conversa:** como guardar "em que passo do fluxo de botões"
   cada cliente final está, entre mensagens, dado que vamos rodar em funções Vercel
   (não um processo long-running tradicional)? Avalie guardar isso direto no Supabase
   Postgres vs. uma camada de cache/KV (ex.: Upstash Redis via Vercel Marketplace) vs.
   outra abordagem.
3. **Multi-tenancy:** cada barbearia é um tenant. No Supabase Postgres, recomende entre
   Row-Level Security (RLS) com uma tabela `tenants`/`barbearias`, schema-per-tenant, ou
   outra estratégia — considerando que o volume inicial é baixo (dezenas de tenants) mas
   a arquitetura de dados não deveria exigir reescrita para centenas/milhares depois.
4. **Billing/assinatura da plataforma:** o dono da barbearia paga uma assinatura
   mensal para usar o SaaS. Recomende provedor(es) de pagamento considerando que o
   público é brasileiro (avalie Stripe Brasil, Mercado Pago, Pagar.me, Asaas, ou
   outros) e como modelar planos/assinatura/inadimplência/cancelamento no banco.
5. **Autenticação:** dono da barbearia loga no app de calendário (já existe hoje, sem
   stack de auth confirmada) — recomende usar o Auth nativo do Supabase ou outra
   solução, e como isso se relaciona com multi-tenancy.
6. **Filas/retries/agendamento:** mensagens de WhatsApp podem falhar, lembretes de
   agendamento precisam disparar em horário programado — que abordagem usar dentro do
   ecossistema Vercel (cron jobs nativos, Vercel Queues, ou outra) sem introduzir
   infraestrutura própria de fila?
7. **Observabilidade:** logging e monitoramento de erros para um webhook que recebe
   tráfego de produção de clientes reais, dentro do que Vercel Pro já oferece.
8. **Testes:** estratégia de teste para uma máquina de estados determinística de
   conversa (não é lógica de IA/LLM) integrada a uma API externa (WhatsApp Cloud API).

### Formato da resposta que eu quero

- Uma recomendação de stack **única e concreta** por item acima (não uma lista de
  opções sem decisão).
- Justificativa curta de por quê, amarrada ao contexto dado (não genérica).
- Trade-offs que eu preciso saber que estou aceitando com essa escolha.
- Se alguma parte do meu contexto tornar uma resposta padrão inadequada, diga
  explicitamente o quê e por quê, em vez de responder de forma genérica.
