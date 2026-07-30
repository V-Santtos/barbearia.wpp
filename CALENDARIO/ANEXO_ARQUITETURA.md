# ANEXO_ARQUITETURA.md - Aplicativo FULL

Atualizado em: 2026-05-17

Use este anexo quando a etapa de regras finais terminar e o projeto entrar na fase de organizacao para deploy/app.
Objetivo: registrar, por prioridade, o que vale reorganizar antes de o sistema crescer mais.

---

## Diagnostico geral

A pasta `Aplicativo FULL` esta funcional e saudavel para continuar o desenvolvimento. A separacao macro esta correta:

```text
Aplicativo FULL/
  CALENDARIO/              API + painel administrativo
  SITE-BARB-PROF-UNICO/    site publico + fluxo de agendamento
  ANEXO_MEMORIA.md
  ANEXO_SEGURANCA.md
  CLAUDE.md
```

O principal risco nao e a estrutura atual quebrar agora. O risco e o projeto crescer com responsabilidades acumuladas em arquivos grandes, principalmente `CALENDARIO/server.js`, e com contratos/tipos duplicados entre o site publico e o painel.

---

## Prioridade Critica

No momento, nao ha reorganizacao critica bloqueando o projeto.

O projeto compila, o fluxo principal esta funcionando, e as responsabilidades principais estao separadas o bastante para continuar a fase final.

---

## Prioridade Importante

### 1. Quebrar `CALENDARIO/server.js` em modulos

Estado atual:
- `server.js` concentra servidor Fastify, conexao com banco, auth, rate limit, helpers de data, regras de agenda, catalogo, WhatsApp/CRM e todas as rotas.
- Funciona, mas vai ficar dificil de manter se WhatsApp/CRM, dashboard e login real crescerem.

Sugestao futura:

```text
CALENDARIO/server/
  index.js
  db.js
  auth.js
  rateLimit.js
  routes/
    profissionais.js
    agenda.js
    agendamentos.js
    configuracao.js
    servicos.js
    whatsapp.js
  domain/
    slots.js
    dates.js
    whatsappMemory.js
```

Quando fazer:
- Antes de implementar CRM definitivo, dashboard grande ou login real.

Risco se nao fizer:
- Toda regra nova tende a cair em `server.js`.
- Mais chance de conflito entre funcoes e rotas.
- Testar partes isoladas fica dificil.

---

### 2. Centralizar contratos/tipos compartilhados

Estado atual:
- `AgendaConfig`, `Professional`, `Event`, `Service`, categorias e DTOs aparecem em mais de um lugar.
- Exemplos:
  - `SITE-BARB-PROF-UNICO/api/index.ts`
  - `CALENDARIO/services/calendarApi.ts`
  - `CALENDARIO/types.ts`
  - `SITE-BARB-PROF-UNICO/services.ts`

Sugestao futura:

```text
Aplicativo FULL/shared/
  types/
    agenda.ts
    booking.ts
    catalog.ts
    professionals.ts
```

Ou, se nao quiser criar pacote compartilhado ainda:
- Criar um arquivo de referencia de DTOs no backend.
- Atualizar manualmente os dois frontends a partir dele.

Quando fazer:
- Antes de adicionar muitas novas entidades no CRM/WhatsApp.

Risco se nao fizer:
- Backend muda um campo e um frontend continua com tipo antigo.
- Bugs silenciosos em payloads.

---

### 3. Rever `AdminDrawer` dentro do site publico

Estado atual:
- O painel de configuracao visual/catalogo (`AdminDrawer`) fica dentro do site publico.
- Ele edita home, categorias e servicos.

Isso funciona no MVP, mas conceitualmente administracao pertence mais ao painel `CALENDARIO`.

Sugestao futura:
- Mover configuracao de home/categorias/servicos para o painel administrativo.
- Deixar o site publico apenas como consumidor.

Quando fazer:
- Antes de transformar o site em app publico definitivo.
- Antes de remover senha `VITE_OWNER_PASSWORD` e criar login real.

Risco se nao fizer:
- Logica administrativa dentro do bundle publico.
- Mais cuidado com seguranca e visibilidade de recursos admin.

---

## Prioridade Melhoravel

### 4. Organizar logs

Estado atual:
- Existem varios logs soltos nos projetos:
  - `api-server.out.log`
  - `api-server.err.log`
  - `vite-3002.out.log`
  - `vite-3002.err.log`
  - `dev-server.out.log`
  - outros arquivos `.log`

Sugestao:

```text
Aplicativo FULL/logs/
```

Ou simplesmente garantir `.gitignore` forte:

```gitignore
*.log
*.out.log
*.err.log
```

Quando fazer:
- Antes de versionar/deployar.

Risco se nao fizer:
- Polui revisoes.
- Pode guardar dados sensiveis ou ruido antigo.

---

### 5. Separar migracoes de documentacao

Estado atual:
- Feito em 2026-05-19: SQLs foram movidos para `CALENDARIO/migrations/`.

Estrutura atual:

```text
CALENDARIO/migrations/
  2026-05-16-service-catalog-tables.sql
  2026-05-17-booking-window-days.sql
```

Manter `docs/` apenas para documentos explicativos, como `whatsapp-crm-mvp.md`.

---

### 6. Revisar arquivos estaticos antigos

Estado atual:
- `SITE-BARB-PROF-UNICO/services-data.json` parece historico depois da remocao do fallback de servicos.
- `SITE-BARB-PROF-UNICO/site-config.json` ainda serve como fallback visual minimo da home.
- `SITE-BARB-PROF-UNICO/reference/` guarda referencia antiga de HTML/CSS/JS.

Sugestao:
- Remover `services-data.json` se continuar sem uso.
- Manter `site-config.json` apenas para home visual minima, ou renomear para deixar claro:

```text
home-fallback.json
```

- Mover `reference/` para:

```text
docs/reference-original/
```

Quando fazer:
- Antes do deploy final ou antes de converter para app.

Risco se nao fizer:
- Desenvolvedor futuro pode achar que JSON antigo ainda e fonte de verdade.

---

### 7. Padronizar nomes de pastas

Estado atual:
- Existe `Regras/` com maiuscula no site publico.
- Em Windows nao costuma causar problema, mas em Linux/CI casing errado pode confundir.

Sugestao:

```text
SITE-BARB-PROF-UNICO/regras/
```

ou

```text
SITE-BARB-PROF-UNICO/rules/
```

Quando fazer:
- Em uma refatoracao pequena, sem mudar comportamento.

Risco se nao fizer:
- Imports com casing diferente podem falhar em ambientes case-sensitive.

---

## Prioridade Opcional

### 8. Separar backend, admin e site em monorepo

Estado atual:
- `CALENDARIO` mistura API Fastify e frontend administrativo.
- `SITE-BARB-PROF-UNICO` e outro app independente.

Estrutura ideal futura, se o projeto crescer:

```text
Aplicativo FULL/
  apps/
    api/
    admin-calendar/
    public-site/
  packages/
    shared/
```

Quando fazer:
- Apenas se o projeto crescer bastante.
- Nao fazer agora se a prioridade for deploy/app rapido.

Risco se fizer cedo:
- Refatoracao grande, muita chance de perder tempo com configuracao.

---

### 9. Reduzir dependencia local externa do GSAP

Estado atual:
- `SITE-BARB-PROF-UNICO/package.json` usa:

```json
"gsap": "file:../../GSAP"
```

Funciona na maquina atual, mas depende de uma pasta fora de `Aplicativo FULL`.

Sugestao:
- Trocar para dependencia npm oficial se possivel.
- Ou documentar explicitamente essa dependencia externa no deploy.

Quando fazer:
- Antes de build em VPS/CI ou empacotamento como app.

Risco se nao fizer:
- Clone/deploy limpo pode quebrar por falta da pasta `../../GSAP`.

---

## Pode continuar como esta

- Separacao macro entre `CALENDARIO` e `SITE-BARB-PROF-UNICO`.
- Hooks do site publico: `useCalendar`, `useBooking`, `useServices`, `useSiteConfig`.
- Camadas HTTP:
  - `SITE-BARB-PROF-UNICO/api/index.ts`
  - `CALENDARIO/services/calendarApi.ts`
- `components/ui` em cada app.
- `ANEXO_MEMORIA.md` e `ANEXO_SEGURANCA.md` na raiz.

---

## Ordem recomendada de execucao

1. Limpar logs e arquivos estaticos antigos.
2. Atualizar `CLAUDE.md` para refletir o estado atual.
3. Mover SQLs de `docs/` para `migrations/`.
4. Quebrar `CALENDARIO/server.js` em modulos.
5. Centralizar tipos/contratos.
6. Mover `AdminDrawer` para o painel admin.
7. Avaliar estrutura de monorepo apenas se o projeto crescer mais.

---

## Decisao atual

Nao reorganizar tudo agora.

Recomendacao: terminar as lapidacoes finais e deploy/app com a estrutura atual, mas fazer a limpeza leve antes do deploy. A refatoracao maior deve acontecer antes de CRM definitivo, dashboard grande ou login real.
