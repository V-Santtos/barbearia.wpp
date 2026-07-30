# CLAUDE.md - Aplicativo FULL

Atualizado em: 2026-05-15 (sessão 15)

Este arquivo é o ponto de entrada obrigatório antes de qualquer trabalho dentro desta pasta.
Para o estado operacional mais recente, leia também `ANEXO_MEMORIA.md`.

## Objetivo desta pasta

`Aplicativo FULL` é a versão autônoma do sistema de barbearia — sem dependência do N8N no fluxo de agendamento.
Toda a integração passa por um servidor Node/Fastify (`CALENDARIO/server.js`) que consulta o Supabase
e expõe os endpoints que o site consome via `api/index.ts`.

Exceção: WhatsApp/CRM mantém o webhook principal no N8N/VPS; o calendário recebe apenas espelho dos eventos.

## Estrutura

```text
Aplicativo FULL/
|-- CLAUDE.md                  # este arquivo
|-- ANEXO_MEMORIA.md           # estado operacional atual
|-- SITE-BARB-PROF-UNICO/      # site de agendamento (React/Vite, porta 3001)
`-- CALENDARIO/                # servidor Node (porta 3333) + app de calendário (porta 3002)
```

---

## Banco de dados — Supabase

Projeto: `sppexvjvnoganlduyjvs` — West US (Oregon)
Conexão: Session Pooler (`aws-1-us-west-2.pooler.supabase.com:5432`) — obrigatório nesta rede (IPv6).

### Tabelas

**`profissionais`** — `id`, `nome`, `cor` (hex), `ativo`, `created_at`

**`agendamentos`** — `id`, `telefone`, `cliente`, `profissional` (nome), `servico`, `dia_marcado` (date), `hora_marcada` (time), `status` (default `'confirmado'`), `source` (default `'app-etapas'`), `created_at`, `updated_at`

> O app cria agendamentos com `status: "agendado"`. `VALID_STATUSES` inclui `"agendado"`, `"reagendado"` e `"confirmado"`.

**`configuracao`** — `chave` (PK: `'home'`, `'categorias'`, `'servicos'`), `valor` (jsonb), `atualizado_em`

**`agenda_profissional`**

```sql
CREATE TABLE agenda_profissional (
  profissional_id BIGINT PRIMARY KEY REFERENCES profissionais(id) ON DELETE CASCADE,
  dias_semana     JSONB    NOT NULL DEFAULT '[1,2,3,4,5,6]',  -- 0=Dom … 6=Sáb
  hora_inicio     TIME     NOT NULL DEFAULT '08:00',
  hora_fim        TIME     NOT NULL DEFAULT '19:00',
  duracao_min     INT      NOT NULL DEFAULT 60,
  intervalo_inicio TIME,
  intervalo_duracao_min INT CHECK (intervalo_duracao_min IS NULL OR intervalo_duracao_min IN (30,60,90,120)),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);
```

**`dias_bloqueados`**

```sql
CREATE TABLE dias_bloqueados (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profissional_id  BIGINT NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  data             DATE   NOT NULL,
  motivo           TEXT,
  periodos         TEXT[],  -- NULL = dia inteiro; ['morning','afternoon','night'] = parcial
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profissional_id, data)
);
```

---

## Servidor (`CALENDARIO/server.js`) — Fastify + pg, porta 3333

| Método | Rota                                                       | Descrição                            |
| ------ | ---------------------------------------------------------- | ------------------------------------ |
| GET    | `/profissionais`                                           | lista ativos                         |
| POST   | `/profissionais`                                           | cria                                 |
| PATCH  | `/profissionais/:id`                                       | atualiza                             |
| DELETE | `/profissionais/:id`                                       | soft delete                          |
| GET    | `/profissionais/:id/agenda`                                | retorna `DisableDays` reais          |
| GET    | `/profissionais/:id/agenda-config`                         | dias/horários/duração                |
| PUT    | `/profissionais/:id/agenda-config`                         | salva config (upsert)                |
| GET    | `/profissionais/:id/dias-bloqueados`                       | lista datas bloqueadas               |
| POST   | `/profissionais/:id/dias-bloqueados`                       | bloqueia data                        |
| DELETE | `/profissionais/:id/dias-bloqueados/:data`                 | desbloqueia                          |
| GET    | `/agendamentos/verificar-telefone?phone=`                  | verifica cadastro                    |
| GET    | `/agendamentos/horarios-disponiveis?professionalId=&date=` | slots dinâmicos                      |
| GET    | `/agendamentos?professionalId=`                            | filtra por profissional              |
| GET    | `/agendamentos?professionalId=&date=`                      | filtra por profissional + data       |
| POST   | `/agendamentos`                                            | cria agendamento                     |
| PUT    | `/agendamentos/:id`                                        | atualiza                             |
| PATCH  | `/agendamentos/:id/status`                                 | atualiza status                      |
| DELETE | `/agendamentos/:id`                                        | remove                               |
| GET    | `/configuracao/:chave`                                     | lê configuração                      |
| PUT    | `/configuracao/:chave`                                     | salva configuração                   |
| POST   | `/whatsapp/events?persist=false`                           | espelho inbound CRM (MVP em memória) |

**Regras de negócio:**

- Slots gerados por `hora_inicio`, `hora_fim`, `duracao_min`; descanso remove slots que cruzam `intervalo_inicio`/`intervalo_duracao_min`
- Bloqueio parcial por período (`morning/afternoon/night`) barra novos slots sem afetar existentes
- Antecedência mínima de 15 min; blindado contra duplo agendamento e slots inválidos

---

## Camada de API (`SITE-BARB-PROF-UNICO/api/index.ts`)

| Função                           | Método | Endpoint                                   |
| -------------------------------- | ------ | ------------------------------------------ |
| `checkPhone(phone)`              | GET    | `/agendamentos/verificar-telefone?phone=`  |
| `getProfessionals()`             | GET    | `/profissionais`                           |
| `getProfessionalSchedule(id)`    | GET    | `/profissionais/:id/agenda`                |
| `getAvailableSlots(id, date)`    | GET    | `/agendamentos/horarios-disponiveis`       |
| `getEventsByProfessional(id)`    | GET    | `/agendamentos?professionalId=`            |
| `createBooking(payload)`         | POST   | `/agendamentos`                            |
| `getAgendaConfig(id)`            | GET    | `/profissionais/:id/agenda-config`         |
| `updateAgendaConfig(id, config)` | PUT    | `/profissionais/:id/agenda-config`         |
| `getBlockedDays(id)`             | GET    | `/profissionais/:id/dias-bloqueados`       |
| `blockDay(id, data, motivo)`     | POST   | `/profissionais/:id/dias-bloqueados`       |
| `unblockDay(id, data)`           | DELETE | `/profissionais/:id/dias-bloqueados/:data` |
| `getConfig(chave)`               | GET    | `/configuracao/:chave`                     |
| `updateConfig(chave, valor)`     | PUT    | `/configuracao/:chave`                     |

---

## Arquitetura do fluxo de agendamento

```text
App.tsx
|-- hooks/useCalendar.ts      ← getEventsByProfessional, getAvailableSlots,
|                                getAgendaConfig, getBlockedDays
|-- hooks/useBooking.ts       ← getAvailableSlots, createBooking
|-- components/StepName.tsx        (step 1)
|-- components/StepPhone.tsx       (step 2) ← checkPhone — popup mostra agendamento existente
|-- components/StepPro.tsx         (step 3) ← getProfessionals + getProfessionalSchedule
|-- components/StepCalendar.tsx    (step 4) ← dias bloqueados + dias fora da agenda + dias lotados
|-- components/StepTime.tsx        (step 5) ← slots disponíveis da API
|-- components/StepReview.tsx      (step 6) ← confirmação + revalidação do slot
`-- components/StepSuccess.tsx              ← tela final
```

## Arquitetura da home

```text
HomePage.tsx
|-- hooks/useSiteConfig.ts  ← GET /configuracao/home + /configuracao/categorias
|-- hooks/useServices.ts    ← GET /configuracao/servicos
`-- components/AdminDrawer.tsx ← PUT /configuracao/:chave
```

---

## Regras de calendário (lado cliente)

Em `hooks/useCalendar.ts` + `Regras/regraHorarios.ts`:

- `getDays()` usa `agendaConfig.dias_semana` para bloquear dias fora da agenda do profissional.
- `getDays()` verifica `disableDays` (ISO dates do banco) para dias manualmente bloqueados.
- Bloqueios parciais (`periodos != NULL`) não desativam o dia no calendário.
- `isDayFullyBooked()` usa `generateSlots(hora_inicio, hora_fim, duracao_min)` — slots reais, não lista fixa.
- Fallback local respeita `intervalo_inicio` e `intervalo_duracao_min`.
- Antecedência mínima de 15 min aplicada no cliente e no servidor.
- Slot selecionado expira em 5 min; nome e telefone preservados em `sessionStorage`.
- Slots (step 5) refrescados silenciosamente a cada 3 min sem interrupção visual.

---

## Stack

### SITE-BARB-PROF-UNICO (porta 3001)

| Camada         | Tecnologia                                     |
| -------------- | ---------------------------------------------- |
| UI             | React 18 + TypeScript                          |
| Build          | Vite 6                                         |
| Rotas          | react-router-dom                               |
| Animações      | GSAP 3.15 local (`file:../../GSAP`)            |
| CSS            | Tailwind v4 via `@tailwindcss/vite`            |
| Componentes UI | shadcn (manual) + 21st.dev                     |
| Backend        | `api/index.ts` → proxy Vite → `localhost:3333` |

### CALENDARIO (porta 3333 + 3002)

| Camada      | Tecnologia                                          |
| ----------- | --------------------------------------------------- |
| Servidor    | Node.js + Fastify                                   |
| Banco       | Supabase (PostgreSQL via `pg` Pool, Session Pooler) |
| Front admin | React/Vite, porta 3002                              |

---

## Regras de trabalho

- Não alterar o projeto original em `../SITE-BARB-PROF-UNICO/`.
- N8N removido do fluxo de agendamento — não reintroduzir.
- Toda chamada HTTP do site passa por `api/index.ts`; sem fetch avulso nos componentes.
- Profissionais e agenda são gerenciados pelo app CALENDARIO — o site só lê.
- Não adicionar dependências sem necessidade clara.
- Usar GSAP com cleanup quando houver timeline/contexto.
- Componentes UI novos: via `npx shadcn@latest add <url> --yes`.
- Tailwind v4 ativo — usar classes livremente; não remover CSS existente.
- URLs e chaves de banco devem vir de `.env`.

## Comandos

```bash
# API (porta 3333)
cd "Aplicativo FULL/CALENDARIO" && node server.js

# Calendário administrativo (porta 3002)
cd "Aplicativo FULL/CALENDARIO" && npm run dev

# App de agendamento (porta 3001)
cd "Aplicativo FULL/SITE-BARB-PROF-UNICO" && npm run dev


```
