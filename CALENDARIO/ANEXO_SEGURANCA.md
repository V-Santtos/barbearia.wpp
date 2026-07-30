# ANEXO_SEGURANCA.md - Aplicativo FULL

Atualizado em: 2026-05-16 (seguranca fase 1 iniciada)

Este anexo e o checklist vivo de seguranca do `Aplicativo FULL`.
Use junto com `CLAUDE.md` e `ANEXO_MEMORIA.md` antes de qualquer ajuste que envolva API, admin, deploy, Supabase ou WhatsApp/CRM.

---

## Objetivo

Fechar os principais riscos antes do deploy sem comprometer o fluxo atual do aplicativo:

- Site publico continua conseguindo listar servicos, listar profissionais, consultar horarios e criar agendamentos.
- Painel administrativo passa a depender de autorizacao real no backend.
- Segredos deixam de ficar expostos no bundle publico.
- CORS fica restrito por ambiente, com flexibilidade para novos dominios.
- Endpoints sensiveis ficam separados dos endpoints publicos.

---

## Estado atual validado

- [x] App usa API propria em `CALENDARIO/server.js`.
- [x] Supabase esta atras do backend, sem acesso direto pelo frontend publico.
- [x] Queries criticas usam parametros SQL, reduzindo risco de SQL injection.
- [x] Tabelas do Supabase estao com RLS ligado.
- [ ] Existem policies efetivas no Supabase. Hoje a consulta retornou nenhuma policy em `public`.
- [x] Backend tem protecao por token para rotas administrativas.
- [ ] Segredo de admin esta fora do frontend.
- [x] CORS esta restrito por `CORS_ORIGINS`, com fallback local para desenvolvimento.
- [x] Existe rate limit para rotas sensiveis.
- [x] Existe trava unica no banco contra duplo agendamento concorrente.

---

## Riscos principais

### P0 - Bloqueadores antes do deploy

- [x] Proteger endpoints administrativos no backend com token/segredo.
- [x] Separar explicitamente rotas publicas e rotas administrativas.
- [ ] Remover `VITE_OWNER_PASSWORD` do frontend como mecanismo de seguranca.
- [x] Restringir CORS por variavel de ambiente.
- [x] Proteger webhook/rotas do WhatsApp com token proprio.
- [x] Adicionar rate limit basico em agendamento, login/admin e webhook.
- [x] Adicionar indice unico parcial em `agendamentos` para evitar duplo agendamento concorrente.

### P1 - Endurecimento recomendado

- [ ] Criar login real no backend com sessao curta ou JWT.
- [ ] Trocar token fixo do admin por sessao autenticada.
- [ ] Registrar auditoria de alteracoes administrativas.
- [ ] Definir policies Supabase coerentes com o papel da API.
- [ ] Validar tamanho maximo de payloads e campos de texto.
- [ ] Padronizar respostas de erro para nao vazar detalhes internos.

### P2 - Pos-deploy

- [ ] Monitorar logs de erro e tentativas suspeitas.
- [ ] Configurar backup/restore testado do Supabase.
- [ ] Configurar rotacao periodica de tokens.
- [ ] Documentar checklist de deploy seguro.

---

## Rotas publicas permitidas

Estas rotas devem continuar acessiveis ao site publico sem token:

- [ ] `GET /`
- [ ] `GET /profissionais`
- [ ] `GET /profissionais/:id/agenda`
- [ ] `GET /profissionais/:id/agenda-config`
- [ ] `GET /profissionais/:id/dias-bloqueados`
- [ ] `GET /agendamentos/verificar-telefone`
- [ ] `GET /agendamentos/horarios-disponiveis`
- [ ] `GET /agendamentos/dias-disponiveis`
- [ ] `POST /agendamentos`
- [ ] `GET /configuracao/:chave`
- [ ] `GET /categorias-servicos`
- [ ] `GET /servicos`

Observacao: `GET /agendamentos/verificar-telefone` revela dados de agendamento por telefone. Manter publico por enquanto para preservar o fluxo atual, mas aplicar rate limit e considerar resposta menos detalhada depois.

Observacao: `GET /agendamentos` foi tratado como rota administrativa porque retorna dados de clientes. O site publico deixou de depender dessa chamada no carregamento do calendario.

---

## Rotas administrativas a proteger

Estas rotas devem exigir token/sessao administrativa:

- [x] `POST /profissionais`
- [x] `PATCH /profissionais/:id`
- [x] `DELETE /profissionais/:id`
- [x] `PUT /profissionais/:id/agenda-config`
- [x] `POST /profissionais/:id/dias-bloqueados`
- [x] `DELETE /profissionais/:id/dias-bloqueados/:data`
- [x] `GET /agendamentos`
- [x] `PUT /agendamentos/:id`
- [x] `PATCH /agendamentos/:id/status`
- [x] `DELETE /agendamentos/:id`
- [x] `PUT /configuracao/:chave`
- [x] `PUT /categorias-servicos`
- [x] `PUT /servicos`
- [x] `GET /whatsapp/conversations`
- [x] `GET /whatsapp/conversations/:id/messages`
- [x] `DELETE /whatsapp/memory`

---

## Webhooks a proteger

- [x] `POST /whatsapp/events`

Regra: usar token separado do admin, por exemplo `WHATSAPP_WEBHOOK_TOKEN`, enviado pelo N8N/VPS em header.

---

## Variaveis de ambiente previstas

### Backend `CALENDARIO`

- [x] `DATABASE_URL`
- [x] `PORT`
- [x] `ADMIN_API_TOKEN`
- [x] `WHATSAPP_WEBHOOK_TOKEN`
- [x] `CORS_ORIGINS`
- [x] `RATE_LIMIT_MAX`
- [x] `RATE_LIMIT_WINDOW_MS`

### Frontend admin `CALENDARIO`

- [x] `VITE_CALENDAR_API_URL`
- [x] `VITE_ADMIN_API_TOKEN` temporario, somente para o painel admin durante a fase atual.

Observacao: esse token no frontend admin ainda e visivel no bundle. Ele melhora a separacao contra o site publico, mas nao substitui login real. A versao ideal e trocar por login backend + sessao curta.

### Frontend publico `SITE-BARB-PROF-UNICO`

- [x] `VITE_API_BASE_URL`
- [ ] Remover uso de `VITE_OWNER_PASSWORD` como seguranca.

---

## Plano de execucao

### Fase 1 - Protecao minima forte

- [x] Criar helpers de autenticacao em `CALENDARIO/server.js`.
- [x] Criar `requireAdmin` para rotas administrativas.
- [x] Criar `requireWebhookToken` para WhatsApp.
- [x] Configurar CORS por `CORS_ORIGINS`.
- [x] Atualizar cliente admin `services/calendarApi.ts` para enviar token.
- [ ] Remover dependencia de senha `VITE_*` como barreira de seguranca real.
- [x] Atualizar `.env.example` dos projetos.
- [ ] Testar site publico sem token.
- [ ] Testar painel admin com token.

### Fase 2 - Anti-abuso e integridade

- [x] Adicionar rate limit no backend.
- [x] Criar indice unico parcial para agendamentos ativos.
- [ ] Validar payloads administrativos com limites de tamanho e formato.
- [ ] Reduzir dados retornados por `verificar-telefone`, se o fluxo permitir.

### Fase 3 - Login real

- [ ] Criar rota `POST /admin/login`.
- [ ] Usar senha somente no backend, fora de `VITE_*`.
- [ ] Emitir sessao/JWT com expiracao.
- [ ] Armazenar sessao de forma controlada no admin.
- [ ] Invalidar sessao no logout.

---

## Criterios de validacao

- [ ] Site publico abre home e carrega configuracao.
- [ ] Site publico lista servicos e categorias.
- [ ] Site publico lista profissionais.
- [ ] Site publico consulta dias e horarios.
- [ ] Site publico cria agendamento.
- [ ] Chamada publica nao precisa token.
- [ ] Chamada admin sem token retorna `401`.
- [ ] Chamada admin com token valido funciona.
- [ ] Webhook WhatsApp sem token retorna `401`.
- [ ] Origem fora de `CORS_ORIGINS` nao passa no navegador.
- [ ] Build do site publico nao contem senha de dono.
- [ ] `.env.example` documenta as variaveis novas sem segredos reais.

---

## Historico

- 2026-05-16: Anexo criado para guiar a lapidacao de seguranca antes do deploy.
- 2026-05-16: Fase 1 iniciada. Backend passou a proteger rotas administrativas com `ADMIN_API_TOKEN`, webhook WhatsApp com `WHATSAPP_WEBHOOK_TOKEN`, CORS por `CORS_ORIGINS`, e clientes admin passaram a enviar token quando configurado.
- 2026-05-16: Verificacao executada: `node --check server.js`, `npm run build` em `CALENDARIO` e `npm run build` em `SITE-BARB-PROF-UNICO`. Builds passaram apos liberar execucao do `esbuild` fora do sandbox.
- 2026-05-17: Rate limit basico em memoria adicionado para rotas sensiveis; criado indice unico parcial `agendamentos_slot_ativo_unique` para slots ativos; builds de `CALENDARIO` e `SITE-BARB-PROF-UNICO` passaram.
