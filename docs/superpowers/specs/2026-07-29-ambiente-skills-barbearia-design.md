# Design: Ambiente e Curadoria de Skills — SaaS Barbearia

**Data:** 2026-07-29
**Status:** Aprovado

## Contexto

Este repositório (`SAAS-BARBEARIA`) é o ponto de partida de um SaaS de agendamento para
barbearias, com duas versões planejadas a longo prazo:

- **V1 (custo-benefício):** bot de botões no WhatsApp (API oficial, com coexistência com
  o app do WhatsApp Business no celular do dono) + espelhamento num aplicativo de
  calendário próprio.
- **V2 (barbearias maiores):** intermediação via link — cliente agenda em site
  personalizado, reagenda/cancela via WhatsApp, tudo espelhado no mesmo calendário.

A V1 será construída em duas fases:
- **Fase 1:** configurar a WhatsApp Cloud API oficial e validar o primeiro evento de
  webhook pingando corretamente (marco: mensagem enviada → webhook recebe confirmação).
- **Fase 2:** integrar esse bot ao aplicativo de calendário já existente
  (repositório [`V-Santtos/Aplicativo-FULL`](https://github.com/V-Santtos/Aplicativo-FULL),
  ~95% pronto), espelhando os agendamentos.

O calendário existente (`Aplicativo-FULL`) tem dois módulos: `CALENDARIO/` (API Fastify +
TypeScript + painel administrativo) e `SITE-BARB-PROF-UNICO/` (site público de
agendamento). Segundo `ANEXO_ARQUITETURA.md` desse repositório, o backend concentra
conexão com banco, auth, rate limit, regras de agenda, catálogo e WhatsApp/CRM em
`server.js`, com recomendação explícita de não fazer refatorações grandes agora e focar em
lapidação final e deploy.

**Este spec cobre apenas a preparação do ambiente e o processo de curadoria de
skills/conhecimento antes de qualquer código de produto.** O código do webhook do
WhatsApp (Fase 1 real) fica para um spec seguinte.

## Decisões

### 1. Estrutura do repositório

- `SAAS-BARBEARIA` é um novo repositório git (inicializado agora), separado do
  `Aplicativo-FULL`. O `Aplicativo-FULL` permanece intocado até a Fase 2, quando a
  integração acontece via API HTTP entre os dois serviços.
- Stack de trabalho: **Node.js + Fastify + TypeScript**, espelhando a stack do
  `CALENDARIO` no `Aplicativo-FULL`, para a Fase 2 integrar sem fricção de runtime.
  - Esta escolha é **revisável**: fica marcada como pendente de uma revisão de
    arquitetura dedicada, a ser feita depois que o ambiente e as skills estiverem
    mapeados (ver seção "Fora de escopo").
- Esqueleto mínimo criado agora, sem lógica de negócio:
  - `package.json`, `tsconfig.json`, `.gitignore`, `README.md`
  - `src/` com um ponto de entrada mínimo (ex.: `server.ts` "hello world" em Fastify)
  - `docs/superpowers/specs/` (specs de design) e `docs/skills-log.md` (log de curadoria)
- `.claude/skills/` já existe com `find-skills` e `skill-creator` instalados — são a
  base operacional de todo o processo de curadoria abaixo.

### 2. Processo de curadoria e criação de skills

Fluxo repetível, executado toda vez que o usuário trouxer um repositório, skill ou
conhecimento novo:

1. **Usuário linka** um repositório, skill ou conhecimento.
2. **Avaliação crítica de encaixe**: análise honesta se serve inteiro, serve em parte,
   ou não serve para o escopo do SaaS de barbearia. Nada entra "porque pode ser útil
   algum dia" — só o que soma diretamente ao projeto.
3. **Busca cruzada** (só quando fizer sentido, não por padrão): `find-skills` (catálogo
   interno) e GitHub (estrelas, atividade recente, manutenção, licença), para checar se
   existe alternativa melhor ou complemento.
4. **Decisão registrada** em `docs/skills-log.md`, com um dos vereditos:
   - ✅ **Adotado inteiro**
   - ✂️ **Adotado parcial** — extrai-se somente o trecho/módulo útil; nunca se traz um
     repositório inteiro quando só uma parte serve.
   - 🥊 **Em conflito/sobreposição** — quando duas fontes de conhecimento se
     sobrepõem, abre-se um debate explícito com o usuário antes de decidir o que fica;
     a decisão e o motivo são registrados.
   - 🆕 **Vira skill nova** — quando nenhuma fonte externa serve, ou quando um
     conhecimento/decisão do projeto é importante o bastante para virar habilidade
     reutilizável, usa-se `skill-creator` para autorá-la do zero.
   - ❌ **Rejeitado** — com o motivo.
5. Nenhuma skill entra em `.claude/skills/` sem passar por este log.

### 3. Formato do log (`docs/skills-log.md`)

Uma entrada por avaliação, curta e objetiva:

```md
## [DATA] Nome da skill/repo
- Fonte: <link>
- Veredito: ✅ Adotado inteiro / ✂️ Parcial / 🥊 Conflito / 🆕 Virou skill nova / ❌ Rejeitado
- Motivo: <por que serve ou não serve para o SaaS de barbearia>
- Ação: <o que foi trazido para .claude/skills/, ou o que foi decidido no debate>
```

Sem ferramenta nova, sem automação — o arquivo cresce junto com o projeto e serve de
memória viva do que entrou e por quê.

## Fora de escopo (próximos passos)

- **Código do webhook do WhatsApp** (Fase 1 real): endpoint, verificação do token/
  assinatura da Meta, primeiro teste de evento pingando. Vira o próximo spec, quando o
  usuário trouxer o fluxo n8n como referência (o n8n serve só de referência/mapa — a
  automação de fato será codada em Fastify, não rodada em produção no n8n).
- **Revisão de arquitetura/stack** do backend do calendário (`CALENDARIO`): validar se
  Fastify + a modelagem atual aguentam escala de SaaS multi-tenant. Fica pendente até
  o ambiente e as skills estarem mapeados.
- **Integração com o calendário** (Fase 2): espelhar agendamentos do bot no
  `Aplicativo-FULL` via API HTTP.
- **V2 (intermediação via site + link)**: só entra em pauta depois da V1 validada.
