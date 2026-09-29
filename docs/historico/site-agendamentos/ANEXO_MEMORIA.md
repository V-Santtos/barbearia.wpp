# ANEXO_MEMORIA.md — Aplicativo FULL

Nota visual mais recente: 2026-09-27. O histórico operacional abaixo é anterior.

Leia junto com `CLAUDE.md` ao retomar o trabalho.

---

## Nota de retomada visual — 2026-09-27

Nesta sessão, Victor refinou o site público em `SITE-BARB-PROF-UNICO/` e o modal
administrativo de Configurações na casca local de
`C:\Users\victo\Desktop\Projetos Gith Hub\SAAS-BARBEARIA\CALENDARIO`.
O registro atual das decisões visuais está em
`SAAS-BARBEARIA/REGRAS-APRENDIZADOS/REGRAS.md`; o estado e os limites do mock estão
em `SAAS-BARBEARIA/CONTEXTO.md`. Para retomar o site, conferir esses arquivos e o
diff local antes de editar. Esta nota registra apenas a rodada visual; não confirma
o estado da VPS, do Supabase ou do backend do desenvolvedor. As orientações
operacionais antigas abaixo precisam ser conferidas contra o ambiente atual.

---

## ⚠️ INSTRUÇÃO OBRIGATÓRIA — Como usar este arquivo

**Sempre que o usuário pedir para "executar o anexo memória" ou "continuar pelo anexo", NÃO execute nada automaticamente.**
Pergunte primeiro: _"Qual é o novo contexto de alteração que você quer fazer agora?"_
Só então retome o trabalho com base na resposta.

---

## Fluxo de trabalho obrigatório (definido na sessão 29)

O site de agendamento e o calendário administrativo já estão **rodando online na VPS**.
O GitHub (`https://github.com/V-Santtos/Aplicativo-FULL`) é a fonte da verdade.

**Fluxo:** problema → investigar → corrigir → commit + push → VPS atualiza.

- ⚠️ `git pull` sozinho **não basta** na VPS — é preciso rodar `npm run build` depois para recompilar o `dist/`
- Não testar em localhost; não subir servidor local; não rodar `npm run dev` para validar
- Só fazer commit quando o problema estiver 100% mapeado e a solução correta

**Credenciais git:** usuário `Victor Santos / sanntos.creator@gmail.com`, Windows Credential Manager

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

### Decisão de fluxo do site — 2026-09-15

- No protótipo/placeholder atual, a ordem é sempre **Telefone → Nome completo → Profissional**.
- Enquanto não existir a consulta própria de cadastro, todos os cenários exigem telefone e nome; nenhum caminho pula etapas.
- Com a integração futura, um cliente reconhecido pelo telefone poderá seguir sem redigitar o nome. Cliente novo continuará em Telefone → Nome.
- O `exists` da rota atual de verificação indica agendamento ativo, não cadastro de cliente; não usar esse campo para decidir se a etapa de nome deve ser pulada.

---

## Rodada visual local do site de agendamento — 2026-09-15

Estado desta rodada: **em validação, ainda não aprovado como visual final**.

- O protótipo público está disponível em `localhost:3001`; `localhost:3002` continua sendo o painel administrativo e não entrou nesta troca visual.
- Consultas e dados reais ficaram desativados nesta etapa. `api/visualMock.ts` fornece respostas placeholder para permitir preencher telefone e nome livremente e percorrer todas as etapas sem bloqueios externos.
- A ordem visível foi alterada para **Telefone → Nome completo → Profissional**. No placeholder, cliente novo ou conhecido sempre preenche os dois primeiros campos; pular Nome fica reservado para a futura consulta real por telefone.
- `StepCalendar.tsx` recebeu a primeira versão do calendário editorial inspirado na referência do dono: data em destaque, mês/ano, dia da semana, grade circular, navegação entre meses, total de horários e próximo horário livre. A escolha da data continua separada da escolha do horário.
- As setas ficaram maiores e mais legíveis, porém neutras; o hover dos dias foi corrigido para não apagar o conteúdo nem disputar com a seleção.
- A paleta experimental foi centralizada em tokens: principal `#5650F9`, hover `#4842E5`, pressionado `#3D38CC`, e escala `#7772FB`, `#9A96FC`, `#C1BEFD`, `#E5E4FF`, `#F4F3FF`. Ela já foi aplicada ao calendário, demais etapas, estados de sucesso/erro, página inicial e lista de serviços.
- Direção para a próxima sessão: validar o **fluxo público inteiro**, não só a cor. Revisar cada componente, desktop e mobile, reduzindo excesso de roxo, brilho, molduras e decoração sempre que não tiverem função. O objetivo é tornar o sistema o mais minimalista possível sem perder clareza, hierarquia ou estados de interação.

Validação técnica concluída nesta rodada: `npx tsc --noEmit`, `npm run build` e `git diff --check`. A página inicial, a lista de serviços e o calendário foram inspecionados em `localhost:3001`.

Arquivos centrais desta rodada: `App.tsx`, `api/index.ts`, `api/visualMock.ts`, `components/StepPhone.tsx`, `components/StepName.tsx`, `components/StepCalendar.tsx`, `components/StepPro.tsx`, `components/StepSuccess.tsx`, `styles.css` e `styles-home.css`.

---

## Sessão 29 — o que foi feito

| Commit | Descrição |
|--------|-----------|
| `371b633` | fix: card presencial no DayKanban usa cor do profissional (antes era âmbar fixo) |
| `4d69136` | fix: corrige sintaxe JSX ausente no botão do card presencial (erro introduzido no commit anterior) |

**Arquivo alterado:** `CALENDARIO/components/DayKanban.tsx` — função `renderCard`, linhas ~125–182.
**Pendente de validação:** confirmar na VPS se o build foi refeito após o pull.

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
