# ANEXO_MEMORIA.md — Aplicativo FULL

Atualizado em: 2026-05-18 (sessão 24)

Leia junto com `CLAUDE.md` ao retomar o trabalho.

---

## ⚠️ INSTRUÇÃO OBRIGATÓRIA — Como usar este arquivo

**Sempre que o usuário pedir para "executar o anexo memória" ou "continuar pelo anexo", NÃO execute nada automaticamente.**
Pergunte primeiro: _"Qual é o novo contexto de alteração que você quer fazer agora?"_
Só então retome o trabalho com base na resposta.

---

## Regra obrigatória — Painel e Supabase

Qualquer alteração no painel que envolva dado, estado ou configuração deve incluir integração com o Supabase. Verificar sempre:
1. A alteração está sendo enviada via `PUT /configuracao/:chave`?
2. O dado persiste após F5?
3. O estado local do drawer sincroniza com o Supabase ao abrir?

---

## Contexto geral

- API: `CALENDARIO/server.js` (Fastify + Supabase), porta `3333`
- Calendário administrativo: `CALENDARIO/`, porta `3002`
- App de agendamento: `SITE-BARB-PROF-UNICO/`, porta `3001`
- N8N: mantido apenas para WhatsApp/CRM; fora do fluxo de agendamento

---

## O que está concluído (resumo)

- Fluxo completo de agendamento steps 1–6 + Supabase operacional
- Slots dinâmicos, janela de agenda por profissional, bloqueio parcial por período, antecedência mínima, anti-duplo-agendamento
- Calendário administrativo: `AgendaSettingsModal`, `ProfileModal`, `AdminDrawer`, MVP WhatsApp CRM
- API: 21 endpoints — ver tabela em `CLAUDE.md`
- Redesign `StepCalendar` (sessão 18) — carrossel com 5 cards, firstSlot, edge scale+fade
- Mobile do CALENDARIO (sessões 21–23) — ver seção abaixo
- FAB presencial corrigido (sessão 24) — cancelamento otimista, card com `professionalId` correto

---

## Em andamento — Mobile CALENDARIO (sessões 21–23)

> App administrativo na porta 3002 — PWA instalável, usado no celular do barbeiro.

### Já implementado

| Componente | O que foi feito |
|---|---|
| `CalendarHeader.tsx` | Layout mobile/desktop separados; hambúrguer + mês à esq, lupa + avatar à dir; `env(safe-area-inset-top)` |
| `MonthPillsStrip.tsx` | Pills de meses só mobile; oculta na view Dia |
| `HamburgerPanel.tsx` | Painel deslizante: botão Criar, seletor Dia/Semana/Mês, lista de profissionais |
| `MobileBottomNav.tsx` | 3 itens: Agenda \| Conversas \| Dashboard; `env(safe-area-inset-bottom)` |
| `App.tsx` | View padrão mobile = `day` + `viewMode = 'kanban'`; `handleViewChange` seta kanban ao escolher Dia no mobile |
| `PresencialFAB.tsx` | Some/aparece ao abrir hambúrguer ou modal de configurações |
| `AgendaSettingsModal.tsx` | Scroll interno; intervalo de descanso: layout vertical empilhado, pills em `grid-cols-4` |
| `DayKanban.tsx` | **Mobile:** carrossel horizontal com `scroll-snap`; tabs Manhã/Tarde/Noite; abre no período correto pelo horário atual. **Desktop:** mantém 3 colunas |
| `CalendarHeader.tsx` (mobileTitle) | Dinâmico por view: Dia → `"Sexta-feira, 18"` / Mês → `"Maio, 18"` / Semana → `"Maio"` |
| `CalendarHeader.tsx` (badge presencial) | Badge "Em atendimento" adicionado ao mobile (abaixo do header row, com glow pulsante) |
| `EventModal.tsx` | `px-4 sm:px-0` no backdrop — margem lateral no mobile |
| `.env` / `.env.local` | `ADMIN_API_TOKEN` adicionado (`barb-adm-local-2026`) — token para rotas admin |
| `App.tsx` (handlePresencialDeactivate) | **Sessão 24:** cancelamento otimista — FAB desbloqueia imediatamente; 404 silencioso; estado limpo antes da chamada API |
| `App.tsx` (handlePresencialActivate) | **Sessão 24:** `professionalId` sobrescrito com `prof.id` correto (POST não retorna JOIN) |

### Ainda pendente

| # | Item | Detalhe |
|---|------|---------|
| B1 | FAB ainda cobre coluna Sáb | `right-10` melhora mas FAB (~80px) ainda sobrepõe borda direita do grid |
| U2 | WeekView ilegível no mobile | 7 colunas fixas em ~390px sem scroll horizontal |
| U4 | Menu do FAB pode sair do viewport | Lista de profissionais abre sempre para cima sem checar espaço |

---

## Pendências gerais do projeto

| # | Item | Prioridade |
|---|------|------------|
| 1 | `.env.production` com `VITE_API_BASE_URL` para VPS | antes do deploy |
| 2 | Integração WhatsApp/CRM completa (tabelas definitivas no Supabase) | médio |
| 3 | Dashboard: gráficos e métricas no CALENDARIO | futuro |
| 4 | Reset de estado do `AdminDrawer` ao fechar sem salvar | médio |

---

## Arquivos-chave

```
CALENDARIO/
  App.tsx
  components/CalendarHeader.tsx
  components/MonthPillsStrip.tsx
  components/HamburgerPanel.tsx
  components/MobileBottomNav.tsx
  components/PresencialFAB.tsx
  components/AgendaSettingsModal.tsx
  components/DayKanban.tsx
  components/EventModal.tsx
  services/calendarApi.ts
  server.js
  .env                  ← ADMIN_API_TOKEN definido aqui
  .env.local            ← VITE_ADMIN_API_TOKEN definido aqui

SITE-BARB-PROF-UNICO/
  api/index.ts
  hooks/useCalendar.ts
  hooks/useBooking.ts
  Regras/regraHorarios.ts
```

## Comandos

```bash
cd "Aplicativo FULL/CALENDARIO" && node server.js       # API porta 3333
cd "Aplicativo FULL/CALENDARIO" && npm run dev          # Admin porta 3002
cd "Aplicativo FULL/SITE-BARB-PROF-UNICO" && npm run dev  # Site porta 3001
```
