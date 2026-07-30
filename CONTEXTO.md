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

**Marco da Fase 1 ATINGIDO em 2026-07-29.** Mensagem real ("Oi", enviada do
WhatsApp pessoal) saiu do celular → Meta → túnel ngrok → endpoint Hono local,
passou pela validação de `X-Hub-Signature-256` e foi logada. Handshake de
verificação também confirmado como legítimo (UA `facebookplatform/1.0`,
IP `2a03:2880::`, faixa da Meta — não eco de teste local).

Ambiente Meta mapeado:

- App **"Barbearia - API"**, ID `843143105019857`, em modo **Ao vivo**.
- **WABA ID:** `830103189833653`
- **Phone Number ID:** `922642447599728`
- Número de teste **+55 33 8459-4968** ("Barbearia"), status Conectado,
  qualidade Alta. **É descartável** — era de um case antigo, sem vínculo com
  nada em uso. Pode ser resetado/re-onboardado à vontade.
- Callback URL **já repontada** pro nosso endpoint (túnel ngrok). O fluxo n8n
  antigo (`webhook.autohost.shop`) está desativado e não será mais usado —
  há backups só para consulta visual.
- Campos assinados: `messages` (v26.0) + os três de coexistência
  (`history`, `smb_app_state_sync`, `smb_message_echoes`).

Porta 3000 desta máquina fica ocupada pelo dev server do portfólio (Vite) —
o bot usa **3333**.

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

## O que já existe em `BARBEARIA/`

Node 22 + npm (sem pnpm nesta máquina). Hono + TypeScript + `pg`. **Drizzle ainda
não entrou** — decisão explícita, ver a seção da primeira interação.

- `src/whatsapp/assinatura.ts` — validação do `X-Hub-Signature-256` (HMAC-SHA256
  sobre o corpo **bruto**) + comparação de segredo em tempo constante.
- `src/whatsapp/eventos.ts` — **camada de anticorrupção**: envelope da Meta →
  `EventoRecebido` (`texto` | `botao` | `nao_suportado`). Separa recibo de entrega
  (`statuses`) de mensagem de cliente, que chegam no mesmo campo.
- `src/whatsapp/webhook.ts` — `GET` (handshake) e `POST` (assinatura → tradução →
  registro → roteamento → envio). Dependências injetadas.
- `src/whatsapp/enviar.ts` — único lugar que chama a Cloud API para enviar.
- `src/fluxo/botoes.ts` — contrato do id de botão (`1.agendar`, versionado).
- `src/fluxo/rotear.ts` — o roteador: função **pura e total**.
- `src/fluxo/acoes.ts` — as intenções que o roteador devolve.
- `src/db/cliente.ts` / `src/db/eventos.ts` — pool `pg` e a transação de
  dedupe + anti-repetição.
- `src/app.ts` / `src/index.ts` — app separado do servidor, pra virar handler
  serverless na Vercel sem duplicar rota. `app.ts` é o ponto de composição.
- Rodar: `npm run dev` (precisa de `.env`, ver `.env.example`). `npm test`,
  `npm run typecheck`.

## DECISÃO (2026-07-29): validar o SaaS inteiro SEM coexistência

Decidido pelo usuário ao fim da sessão. **Coexistência sai do caminho crítico.**
O V1 se prova sem ela: fluxo de botões, agendamento sem conflito de horário,
lembrete no tempo certo, espelhamento no calendário — nada disso depende do
dono responder pelo celular.

Arranjo do teste real: **WhatsApp pessoal = cliente**, **Cloud API
(`922642447599728`) = barbearia/bot**, **app de calendário = dono atendendo**.

Coexistência entra depois, por cima, sem retrabalho — o endpoint já assina
`history`, `smb_app_state_sync`, `smb_message_echoes` e já os reconhece.

## Coexistência (2026-07-29): dois caminhos, um fechado e um em aberto

**Correção de uma conclusão anterior.** Chegou-se primeiro a "bloqueada sem
CNPJ" — isso vale só pra um dos dois caminhos. A doc da Meta diz:

> "To use an existing WhatsApp Business app phone number with Cloud API, you
> must either delete your account, **or onboard to the platform using a partner
> who supports business app number onboarding**."

### Caminho A — ser o próprio Tech Provider: FECHADO

Cadeia: coexistência → Embedded Signup → Partner path → **Business
Verification** → pessoa jurídica. O modal do painel ("Switch to the Partner
path?") lista `Completing Business Verification` textualmente. Usuário é PF
sem CNPJ e não pretende abrir empresa → requisito impossível, não fila.

Não clicar em "Yes, become a Partner": o verbo é *switch*, troca o caminho do
app e pode degradar o setup que hoje funciona. **Gatilho pra reabrir:** CNPJ.

### Caminho B — entrar como cliente de um BSP: EM ABERTO

Quem precisa ser verificado é o **parceiro**, não o usuário. O BSP roda o
Embedded Signup dele; o número entra em coexistência com histórico preservado.
Resolve também o onboarding em escala das barbearias (o Embedded Signup do BSP
onboarda cada cliente — sem trabalho manual por barbeiro).

**Trava agora é comercial, não técnica:** o BSP aceita pessoa física como
cliente? Varia por fornecedor; descobre-se perguntando.

**Critérios pra escolher BSP (não pesquisados ainda):**
1. Aceita PF?
2. Suporta coexistência (*business app number onboarding*)?
3. Dá acesso direto à Cloud API com credenciais próprias, ou obriga a falar
   com a API dele? — o item 3 decide se o código atual sobrevive intacto.
4. Custo: mensalidade fixa vs. markup por mensagem.

### Plano de contingência (se nenhum BSP aceitar PF)

O dono da barbearia atende pelo app de calendário próprio (`Aplicativo-FULL`),
não pelo WhatsApp Business. Remove a dependência de coexistência do V1 inteiro.
Teste real: WhatsApp pessoal = cliente, Cloud API = barbearia, app = dono.

Nota: conta não verificada tem teto de números de telefone por WABA — escalar
sem BSP exigiria CNPJ em algum momento.

## BANCO CONECTADO (2026-07-30) — leitura e escrita

Insumo **(b) parcialmente resolvido**: não pelo clone do `Aplicativo-FULL`, mas
por **acesso direto ao banco dele**. Confirmado que é o mesmo projeto Supabase do
fluxo n8n: ref `sppexvjvnoganlduyjvs`, PostgreSQL 17.6.

- **Como:** `DATABASE_URL` (conexão direta Postgres) no `BARBEARIA/.env`, coberto
  pelo `.gitignore`. Usuário `postgres` — leitura **e escrita**, posso criar e
  alterar tabelas.
- **Ferramentas:** `BARBEARIA/ferramentas/` (`pg` já é dependência). `npm run db`
  consulta/altera com rollback por padrão; `npm run db:migrar` aplica
  `db/migracoes/*.sql`; `db:schema`/`db:dados` regeram o retrato quando preciso.
- **MCP do Supabase:** configurado em `.mcp.json` mas **nunca aprovado** (exige
  sessão interativa). Não é o caminho usado; a conexão direta resolveu. Ver
  `ANEXO_BANCO/DECIDIR.md` item F29.
- **Skills adotadas no mesmo dia:** `supabase` e
  `supabase-postgres-best-practices` (oficiais, ver `docs/skills-log.md`).

O que o banco tem: 12 tabelas em três blocos — agenda (`profissionais`,
`agenda_profissional`, `dias_bloqueados`, `agendamentos`, `servicos`,
`categorias_servicos`, `configuracao`, `documentos_bot`), estado do bot
(`dados_cliente`) e CRM de mensagens (`whatsapp_contacts`, `_conversations`,
`_messages`, 165 mensagens reais de 01–17/06/2026).

Achados que mudam o desenho (detalhe no anexo):

1. **A trava de double-booking já existe no banco** — índice único parcial em
   `(profissional, dia_marcado, hora_marcada)` para status ativos. Era o que
   faltava no n8n.
2. **Duração é por profissional, não por serviço** (`agenda_profissional
   .duracao_min`: 60 do Costa, 45 do Eloi). `servicos` não tem duração.
3. **A janela de 24h da Meta está modelada** em
   `whatsapp_contacts.service_window_until` — impacta direto o lembrete.
4. **Dedupe por `wamid` já é garantido pelo banco** (unique parcial em
   `whatsapp_messages`).
5. **RLS é a única tranca, e é acidental**: 12 tabelas com RLS ligado e **zero
   políticas**, enquanto `anon`/`authenticated` têm privilégio total. Um event
   trigger (`ensure_rls`) liga RLS sozinho em toda tabela nova de `public` — logo,
   tabela nossa nasce negando tudo pela API pública.
6. **`dados_cliente` (estado do bot) está sem contrato**: sem unique no telefone,
   `fluxo` NULL em 9 linhas e `''` em 7, `data_hora` jsonb guardando string
   duplamente codificada, telefone em 4 formatos diferentes pelo sistema.

`ANEXO_BANCO/DECIDIR.md` lista os pontos a discutir um por um (manter, lapidar,
trocar, remover). É a agenda do planejamento.

**Enxugado em 2026-07-30:** o anexo tinha 8 arquivos espelhando o schema (colunas,
tipos, contagens). Isso o banco responde em 2 segundos e markdown envelhece calado
— sobraram dois arquivos, `README.md` (armadilhas) e `DECIDIR.md` (agenda). Regra
daqui pra frente: **não espelhar o banco no repositório.**

## PRIMEIRA INTERAÇÃO CODADA (2026-07-30)

Mensagem chega → é traduzida → registrada → roteada → o bot responde com **3
botões: Agendar, Reagendar, Cancelar**. Só `Agendar` tem rota própria; os outros
dois respondem "ainda não sei fazer isso" — **nunca silêncio**.

Token de envio resolvido: `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` no `.env`.
É token de **teste, descartável** (já passou por log de conversa) — trocar antes da
produção. Validado por chamada real: número +55 33 8459-4968, qualidade GREEN.

### As decisões que moldam tudo daqui pra frente

1. **O contexto viaja dentro do id do botão, não no banco.** Id versionado, ação
   minúscula, parâmetros em querystring: `1.agendar`,
   `1.hora?b=1&d=2026-08-04&h=13:00`. **Vocabulário criado do zero** — nenhum id do
   n8n (`MENU_AGENDAR`, `BARBEIRO_LUCAS_COSTA`) é herdado.
   Consequência: some a validade de 30 minutos do fluxo antigo. Botão velho chega
   auto-suficiente; o que pode ter mudado é o **dado**, e a defesa é conferir no
   banco na hora de marcar.
2. **O id decide a rota, o título nunca.** O antigo comparava `'✅ Confirmar'`.
3. **O roteador é função pura e total.** Devolve intenções, não efeitos. Para toda
   entrada existe resposta — inclusive áudio, id desconhecido e botão de versão
   antiga.
4. **Redis não entra**, com o motivo verificado uso a uso: estado morreu com o
   contexto no botão; dedupe é `UNIQUE (wamid)` no Postgres; rajada é trava **na
   saída** (processa tudo, não repete a resposta) em vez do `INCR` que descartava
   mensagem.
5. **Uma tabela só: `webhook_eventos`** — dedupe, anti-repetição (janela de 15s),
   replay pra depurar. `dados_cliente` e `whatsapp_messages` foram avaliadas e
   descartadas (grão errado / exigem contato e conversa antes de gravar).
6. **Drizzle adiado, de propósito** — desvio explícito do `REGRAS.md`, aprovado. O
   `drizzle-kit` quereria ser dono das migrações e criaria uma segunda tabela de
   histórico ao lado da `supabase_migrations.schema_migrations`. Gatilho pra
   entrar: quando existir schema nosso com relações.

Custo por "Oi": **1 escrita no banco + 1 chamada HTTP**. O n8n gastava ~6 idas ao
banco e 3–4 chamadas.

### Estado da verificação

- `npm test` — 58 testes passando; `npm run typecheck` limpo.
- Camada de banco exercitada contra o Supabase real: reentrega absorvida, rajada
  gravada sem repetir o menu. Linhas de teste apagadas.
- **Falta o teste no celular:** subir ngrok, **recolar a nova URL de callback no
  painel da Meta** e mandar "Oi". Nunca rodou ponta a ponta.

## Próximo passo: o fluxo de AGENDAMENTO

Continua sendo o próximo, agora a partir do botão `1.agendar`, que hoje responde
uma frase provisória.

**Escopo:** só agendar. Nada de reagendamento, cancelamento, tabela de preços ou
saída — esses vêm depois, um por vez.

Antes de codar: **planejamento decidido junto**, do zero. Nada pré-definido — por
onde começa, quais as regras sequenciais, se usa X ou Y em cada bifurcação. Não
chegar com desenho fechado nem tratar o fluxo antigo como base.

Material de partida: `ANEXO_FLUXO_N8N_AGENDAMENTO.md` (seção 14, as 9 perguntas de
desenho; seção 13, os números do baseline — 7 interações a bater) e
`ANEXO_BANCO/DECIDIR.md`. O objetivo declarado é um fluxo **melhor, mais eficiente
e mais rápido** que o antigo; ler o antigo serve para saber o que já foi tentado.

Primeira decisão que aparece pela frente: barbeiro é **dado**, não código (o antigo
tinha 2 hardcoded e duplicava ~20 nós por barbeiro — foi o que gerou o único bug
achado na leitura).

## Fluxo n8n do case antigo: LIDO em 2026-07-30 (as duas partes)

O insumo (a) está **totalmente consumido** — os dois arquivos foram lidos e mapeados:

1. Fluxo pai: `Desktop/N8N/Fluxos/BARBEARIA FULL.json` (workflow `JiaEaPilTVLKCJZW`,
   143 nós, 3 sub-fluxos) → `REGRAS-APRENDIZADOS/ANEXO_FLUXO_N8N.md`.
2. Sub-fluxo de agendamento: `Desktop/N8N/Fluxos/Galho AGENDAMENTO.json` (workflow
   `B8XAEfAJNoW2SCxb`, 102 nós) → `REGRAS-APRENDIZADOS/ANEXO_FLUXO_N8N_AGENDAMENTO.md`.

Do segundo, o que vale como baseline a bater: **7 interações do cliente** para
marcar (5 no atalho de cliente conhecido), serviço **nunca** perguntado, tudo
duplicado por barbeiro (2 hardcoded), sem idempotência nem tratamento de horário
tomado no meio do caminho, e 2 botões oferecidos sem tratamento
(`VOLTAR_DIAS`, `TROCAR_HORARIO`). O anexo fecha com 9 perguntas de desenho a
decidir com o usuário — é o material de partida da conversa, não a resposta.

O link do n8n (`n8n.autohost.shop`) **não é legível por mim** — instância atrás
de login, e não há MCP de n8n configurado. Só o JSON exportado funciona.

**O n8n está aposentado.** O fluxo não é ponto de partida e nada dele virou
regra: o anexo é material de espelho, explicitamente não normativo. Fluxo,
sequência de etapas, nomes de estado e rotas serão **redesenhados do zero** no
nosso ambiente, com nomenclatura própria — o valor de ler o antigo é saber o que
já foi tentado e o que a realidade impôs, não herdar a forma.

Dois fatos de lá que existem independente do n8n:

1. **⚠️ Segredos hardcoded no JSON** (token da Meta e `x-webhook-token` do
   barberapi). Rotacionar os dois; não commitar esse arquivo — anexo, seção 1.
2. **O calendário já tem um endpoint de ingestão de mensagens**
   (`POST barberapi.autohost.shop/whatsapp/events`). Existe e o formato é
   conhecido; não implica que a nossa integração será assim — anexo, seção 2.

## Primeira coisa ao retomar

**Ler `REGRAS-APRENDIZADOS/ANEXO_BANCO/README.md`** — as armadilhas do banco e os
comandos para enxergá-lo. O acesso já está montado; não precisa reconectar nem
remapear. Estrutura de tabela se pergunta ao banco (`npm run db`), não a arquivo.

Ainda **não** há clone local do `Aplicativo-FULL`
(`github.com/V-Santtos/Aplicativo-FULL`). O banco dele já é legível, mas o
**código** não — a lógica de disponibilidade (calcular dias e horas livres a partir
de `agenda_profissional` + `dias_bloqueados` + `agendamentos`) mora lá, não em
função SQL. Só será necessário quando chegarmos na integração.

**Atenção — a URL do ngrok da sessão de 2026-07-29 está morta.** Quando voltar a
testar recebimento de mensagem, subir o túnel de novo e **recolar a nova URL de
callback no painel da Meta** (Webhooks → Conta comercial do WhatsApp). O verify
token continua válido, está no `BARBEARIA/.env`.

## Pendências em aberto (não travadas ainda)

- **Hospedagem definitiva:** hoje é túnel ngrok (URL morre a cada sessão e
  precisa ser recolada no painel da Meta). Migrar pra Vercel quando o fluxo
  estabilizar.
- **Trocar o token de envio antes da produção** — o que está no `.env` é de teste e
  passou por log de conversa. Produção será outro número e outro ambiente.
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
