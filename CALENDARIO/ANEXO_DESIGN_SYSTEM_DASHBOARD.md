# ANEXO_DESIGN_SYSTEM_DASHBOARD.md - Aplicativo FULL

Atualizado em: 2026-05-19

Use este anexo como pacote de referencia para criar o Dashboard do `CALENDARIO` em ferramentas de design/geracao como Cloud Design.

Objetivo: garantir que qualquer tela de dashboard nasca com a identidade visual real do projeto, sem virar um template SaaS generico e sem inventar metricas financeiras.

---

## 1. Escopo do dashboard

O dashboard pertence ao app administrativo:

```text
Aplicativo FULL/
  CALENDARIO/              painel administrativo + API
  SITE-BARB-PROF-UNICO/    site publico + fluxo de agendamento
```

O dashboard deve ser uma area operacional para o barbeiro/administrador entender rapidamente:

- Como esta a agenda hoje.
- Quem esta mais carregado ou com espacos livres.
- Quais horarios e dias concentram movimento.
- Onde existem conversas pendentes no WhatsApp.
- Quais clientes retornam com frequencia.
- Onde ha risco operacional: agenda cheia, janelas vazias, conversas antigas, bloqueios, indisponibilidade.

Nao usar financeiro nesta fase.

Nao criar graficos de receita, faturamento, ticket medio, lucro, comissao, servico mais rentavel ou previsao financeira.

Motivo: muitos agendamentos virao do WhatsApp e, nesse fluxo, o cliente nao necessariamente escolhe servico estruturado. Criar metrica financeira agora geraria dashboard bonito, mas pouco confiavel.

---

## 2. Identidade visual existente

O visual atual do `CALENDARIO` e escuro, premium, operacional e compacto.

Nao criar uma landing page. Nao criar hero. Nao usar visual de marketing.

A tela deve parecer uma extensao natural do calendario atual:

- Fundo geral chumbo/preto.
- Paineis escuros com bordas finas.
- Roxo eletrico como acento principal.
- Brilho controlado, nunca exagerado.
- Tipografia limpa e densa.
- Cards pequenos e escaneaveis.
- Graficos refinados, com pouco ruido visual.
- Dados mais importantes acima da dobra.
- Layout util para uso repetido no celular e desktop.

Referencias internas:

```text
CALENDARIO/index.css
CALENDARIO/App.tsx
CALENDARIO/components/CalendarHeader.tsx
CALENDARIO/components/CalendarGrid.tsx
CALENDARIO/components/DayKanban.tsx
CALENDARIO/components/MobileBottomNav.tsx
CALENDARIO/components/Sidebar.tsx
CALENDARIO/components/WhatsAppPanel.tsx
CALENDARIO/components/ui/Button.tsx
CALENDARIO/components/ui/SegmentedControl.tsx
```

---

## 3. Tokens principais

### Cores base

```json
{
  "color": {
    "background": "#1c1c1c",
    "backgroundDeep": "#0e0e10",
    "panel": "#141314",
    "panelSoft": "#181818",
    "surface": "rgba(25, 25, 25, 0.6)",
    "surfaceStrong": "rgba(10, 10, 10, 0.86)",
    "surfaceRaised": "#1f1f1f",
    "surfaceHover": "#262626",
    "mutedPanel": "#2a2a2a",
    "foreground": "#ffffff",
    "textStrong": "rgba(255, 255, 255, 0.95)",
    "textDefault": "rgba(255, 255, 255, 0.82)",
    "textMuted": "rgba(255, 255, 255, 0.55)",
    "textFaint": "rgba(255, 255, 255, 0.32)",
    "border": "rgba(255, 255, 255, 0.10)",
    "borderStrong": "rgba(255, 255, 255, 0.16)",
    "borderPurple": "rgba(168, 85, 247, 0.25)",
    "primary": "#6a3dff",
    "primaryAlt": "#6B3EFF",
    "primaryHover": "#825CFF",
    "primarySoft": "#a78bfa",
    "primaryLine": "#8b5cf6",
    "whatsapp": "#25D366",
    "warning": "#fbbf24",
    "warningDeep": "#d97706",
    "danger": "#fb2c36"
  }
}
```

### Cores dos profissionais

As cores dos profissionais sao dinamicas e devem aparecer em:

- Barras de distribuicao por profissional.
- Legendas.
- Chips/filtros.
- Bordas laterais de cards.
- Linhas ou areas de graficos comparativos.

Paleta atual usada para profissionais:

```json
[
  "#FF2A29",
  "#FF5000",
  "#2FFF40",
  "#07FF99",
  "#07FFF5",
  "#0047FF",
  "#8400FF",
  "#FC00FF"
]
```

Regra: quando houver dado por profissional, usar a cor real do profissional cadastrada no banco. Se faltar cor, usar `#6B3EFF`.

### Tipografia

```json
{
  "font": {
    "admin": "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    "publicSite": "Poppins, system-ui, sans-serif"
  },
  "dashboardType": {
    "pageTitle": "24px / 32px, semibold",
    "sectionTitle": "13px / 18px, semibold, uppercase opcional",
    "kpiValue": "28px / 32px, semibold",
    "kpiLabel": "12px / 16px, medium",
    "body": "13px / 18px, regular",
    "caption": "11px / 14px, medium"
  }
}
```

Regra: dashboard administrativo deve usar `Inter`, seguindo o `CALENDARIO`.

### Raios

```json
{
  "radius": {
    "sm": "0.375rem",
    "md": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "2xl": "1.5rem",
    "dashboardPanel": "1.5rem",
    "pill": "999px"
  }
}
```

### Sombras e brilho

```json
{
  "shadow": {
    "panel": "0 18px 44px rgba(0,0,0,0.32)",
    "card": "0 8px 24px rgba(0,0,0,0.24)",
    "purpleGlow": "0 0 24px rgba(106, 61, 255, 0.22)",
    "purpleGlowStrong": "0 0 14px rgba(106, 61, 255, 0.45)",
    "insetTop": "inset 0 1px 0 rgba(255,255,255,0.06)"
  }
}
```

Usar glow roxo com moderacao:

- Sim: indicador ativo, foco, card principal, linha selecionada.
- Nao: fundos inteiros, graficos com neon pesado, bordas brilhantes em todos os cards.

### Movimento

Usar `framer-motion`, como no app atual.

```json
{
  "motion": {
    "fast": "0.15s ease-out",
    "default": "0.22s ease-out",
    "screenEnter": "0.55s cubic-bezier(0.16, 1, 0.3, 1)",
    "softEnter": "0.7s cubic-bezier(0.25, 0.1, 0.25, 1)"
  }
}
```

Movimentos esperados:

- Entrada suave de paineis.
- Troca de filtros com fade/slide curto.
- Indicadores ativos com transicao spring discreta.
- Graficos animando apenas na entrada ou mudanca de periodo.

---

## 4. Componentes esperados

### KPI Card

Uso: numeros rapidos e realmente acionaveis.

Visual:

- Fundo `#181818` ou `#1f1f1f`.
- Borda `rgba(255,255,255,0.10)`.
- Raio `16px` ou `24px`.
- Label pequeno em branco/55.
- Valor grande em branco/95.
- Delta/status pequeno, nunca financeiro.

Exemplos:

- Agendamentos hoje.
- Proximos atendimentos.
- Taxa de ocupacao hoje.
- Conversas abertas.
- Clientes retornando.

### Chart Panel

Uso: graficos principais.

Visual:

- Painel escuro com grid quase invisivel.
- Legenda pequena.
- Eixo com branco/30.
- Tooltip escuro com borda fina.
- Series usando roxo principal ou cor do profissional.

Graficos recomendados:

- Linha/area para volume de agendamentos por dia.
- Barras horizontais para ocupacao por profissional.
- Heatmap simples para horarios de pico.
- Donut pequeno apenas para status/source quando houver poucas categorias.

Evitar:

- Grafico 3D.
- Cores aleatorias.
- Gradientes pesados.
- Pizza grande ocupando area nobre.

### Activity List

Uso: agenda do dia e eventos recentes.

Visual:

- Lista densa.
- Hora em tabular nums.
- Borda lateral na cor do profissional.
- Badge para `presencial`, `app`, `admin`, `whatsapp` quando aplicavel.

### WhatsApp Queue

Uso: conversas que precisam de atencao.

Visual:

- Avatar circular com cor.
- Nome/telefone.
- Ultima mensagem.
- Tempo desde ultima mensagem.
- Badge de status: `aberta`, `bot`, `humano`, `fechada`.
- Destaque para conversa parada ha muito tempo.

---

## 5. Metricas uteis sem financeiro

As metricas abaixo foram escolhidas porque ajudam decisao operacional. Nao incluir metricas apenas decorativas.

### A. Agenda de hoje

Confiavel com dados atuais.

1. **Agendamentos de hoje**
   - Total de agendamentos no dia atual.
   - Separar ativos vs concluidos se o status estiver preenchido.

2. **Proximos atendimentos**
   - Lista dos proximos horarios do dia.
   - Mostrar profissional, cliente, horario, origem e status.

3. **Em atendimento agora**
   - Baseado em `source = "presencial"` e estado de atendimento presencial ativo.
   - Util para o barbeiro no celular.

4. **Agenda livre restante**
   - Quantidade de slots ainda disponiveis hoje por profissional.
   - Mais util que apenas "agenda cheia".

5. **Ocupacao de hoje por profissional**
   - Calcular: slots ocupados / slots disponiveis na configuracao do profissional.
   - Exibir em barra horizontal por profissional.

### B. Capacidade futura

Confiavel com dados atuais e regras de agenda.

6. **Proximos dias com disponibilidade**
   - Mostra quantos dias ainda possuem horario livre dentro da janela de agenda.
   - Pode usar a janela configurada por profissional: 7 a 15 dias.

7. **Primeiro horario livre por profissional**
   - Para cada profissional: proxima data + horario disponivel.
   - Muito util para atendimento por WhatsApp.

8. **Dias lotados**
   - Quantidade/lista de dias sem disponibilidade na janela aberta.
   - Separar lotado por agendamento vs bloqueado manualmente se possivel.

9. **Bloqueios de agenda**
   - Dias inteiros bloqueados e bloqueios parciais por periodo.
   - Ajuda a explicar queda de disponibilidade.

### C. Movimento e padroes de agenda

Confiavel com historico de `agendamentos`.

10. **Agendamentos por dia**
    - Linha/area nos ultimos 7, 14 ou 30 dias.
    - Sem valor financeiro.

11. **Horarios de pico**
    - Heatmap por faixa horaria e dia da semana.
    - Ajuda a decidir agenda e descansos.

12. **Distribuicao por profissional**
    - Quantidade de agendamentos por profissional no periodo.
    - Usar cores reais dos profissionais.

13. **Origem dos agendamentos**
    - `app-etapas`, `calendario-admin`, `presencial`, futuramente `whatsapp`.
    - Util para entender de onde vem a demanda sem falar de receita.

14. **Status dos agendamentos**
    - `agendado`, `confirmado`, `reagendado`, `concluido`.
    - Se no futuro houver `cancelado` ou `no-show`, incluir.

### D. Clientes

Confiavel se telefone estiver preenchido.

15. **Clientes recorrentes**
    - Telefones com mais de um agendamento no periodo.
    - Nao exibir dados sensiveis em excesso; usar nome + telefone mascarado quando possivel.

16. **Novos vs retornando**
    - Novo: primeiro agendamento encontrado para o telefone.
    - Retornando: telefone com historico anterior.

17. **Clientes com agendamento futuro**
    - Lista curta de clientes que ja possuem proximo horario marcado.
    - Ajuda no atendimento e confirmacao.

### E. WhatsApp/CRM

Parcialmente confiavel agora. O MVP atual registra principalmente mensagens inbound. Melhorar quando outbound tambem for persistido.

18. **Conversas abertas**
    - Contagem de conversas com status diferente de `closed`.

19. **Conversas aguardando resposta**
    - Base inicial: ultima mensagem inbound.
    - Fica mais confiavel quando mensagens outbound tambem forem registradas.

20. **Tempo desde ultima mensagem**
    - Lista ou KPI de conversas paradas.
    - Muito util operacionalmente.

21. **Volume de mensagens recebidas por periodo**
    - Linha simples: mensagens inbound por hora/dia.

22. **Conversas por status**
    - `open`, `bot`, `human`, `closed`.

### F. Saude do fluxo publico

Requer instrumentacao futura. Nao fingir que existe hoje.

23. **Funil de etapas do agendamento**
    - Nome -> telefone -> profissional -> data -> horario -> confirmacao.
    - Hoje o app nao registra eventos de abandono por etapa.
    - So criar grafico depois de adicionar tracking no backend.

24. **Slot expirado antes da confirmacao**
    - O app ja expira selecao de horario apos 5 minutos, mas nao persiste metrica.
    - Pode virar evento futuro para entender friccao.

25. **Tentativas com horario indisponivel**
    - O app revalida slot antes de criar agendamento.
    - Persistir isso no futuro ajudaria a detectar concorrencia por horarios.

---

## 6. Metricas que nao devem entrar agora

Nao incluir:

- Receita.
- Faturamento.
- Ticket medio.
- Valor por profissional.
- Servico mais lucrativo.
- Previsao de receita.
- Conversao por valor.
- Grafico financeiro de qualquer tipo.

Tambem evitar, por enquanto:

- Ranking de servicos como metrica principal.
- Motivo: no WhatsApp o servico pode nao vir estruturado. Pode aparecer apenas como dado secundario quando o campo `servico` existir.

---

## 7. Layout recomendado

### Desktop

Estrutura sugerida:

```text
Header existente do CALENDARIO

Dashboard
  Filtros: Hoje | 7 dias | 14 dias | 30 dias | Profissional

  Linha 1:
    KPI Agendamentos hoje
    KPI Ocupacao hoje
    KPI Slots livres hoje
    KPI Conversas abertas

  Linha 2:
    Agenda de hoje / Proximos atendimentos
    Ocupacao por profissional

  Linha 3:
    Agendamentos por dia
    Horarios de pico

  Linha 4:
    WhatsApp aguardando atencao
    Clientes retornando
```

### Mobile

O app mobile ja tem bottom nav:

```text
Agenda | Conversas | Dashboard
```

No mobile, o dashboard deve ser vertical e direto:

```text
Dashboard
  Chips de periodo
  KPIs em grid 2 colunas
  Proximos atendimentos
  Ocupacao por profissional
  Conversas pendentes
  Primeiro horario livre por profissional
```

Regra mobile:

- Nao usar graficos largos que exigem zoom.
- Preferir barras horizontais e listas.
- Heatmap pode virar matriz compacta com scroll horizontal se necessario.

---

## 8. Prompt base para Cloud Design

Use este prompt junto com os tokens deste anexo:

```text
Crie um dashboard administrativo para o app CALENDARIO de uma barbearia.

O dashboard deve seguir exatamente a identidade visual existente:
fundo escuro/chumbo, paineis densos, bordas finas, roxo eletrico #6B3EFF/#6a3dff como acento principal, texto branco com opacidades, brilho roxo controlado, cantos arredondados, visual premium e operacional.

Nao crie landing page, hero, marketing section ou layout decorativo.
Crie uma ferramenta de trabalho para o barbeiro acompanhar agenda, ocupacao, disponibilidade e conversas.

Nao use metricas financeiras.
Nao use receita, faturamento, ticket medio, lucro, comissao ou ranking financeiro.
Nao faca servicos parecerem metrica principal, porque muitos agendamentos virao do WhatsApp sem servico estruturado.

Metricas prioritarias:
- agendamentos hoje
- proximos atendimentos
- slots livres hoje
- ocupacao por profissional
- primeiro horario livre por profissional
- dias lotados na janela de agenda
- bloqueios de agenda
- agendamentos por dia
- horarios de pico
- origem dos agendamentos
- status dos agendamentos
- clientes retornando
- conversas WhatsApp abertas
- conversas aguardando resposta
- tempo desde ultima mensagem

Crie desktop e mobile.
No desktop, use grid com KPIs no topo, agenda do dia, ocupacao por profissional, grafico de agendamentos por dia, heatmap de horarios e fila WhatsApp.
No mobile, use uma coluna vertical com KPIs compactos, listas e barras horizontais.

Use graficos refinados, discretos e legiveis.
Use cores reais dos profissionais como acentos em barras, legendas e cards.
Use lucide-react para icones.
Use Inter como fonte.
Use framer-motion apenas para transicoes suaves.
```

---

## 9. Contrato de dados futuro recomendado

Para evitar que o frontend calcule tudo sozinho, criar futuramente:

```http
GET /dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Resposta sugerida:

```json
{
  "range": {
    "from": "2026-05-19",
    "to": "2026-05-19"
  },
  "today": {
    "appointments": 8,
    "completed": 3,
    "upcoming": 5,
    "freeSlots": 12,
    "activePresencial": 1
  },
  "professionals": [
    {
      "id": 1,
      "name": "Lucas",
      "color": "#6B3EFF",
      "appointments": 5,
      "occupiedSlots": 5,
      "availableSlots": 4,
      "occupancyRate": 0.56,
      "nextAvailableSlot": "2026-05-19T15:30:00"
    }
  ],
  "calendar": {
    "appointmentsByDay": [],
    "peakHours": [],
    "fullyBookedDays": [],
    "blockedDays": []
  },
  "sources": [],
  "statuses": [],
  "clients": {
    "returningCount": 0,
    "newCount": 0,
    "topReturning": []
  },
  "whatsapp": {
    "openConversations": 0,
    "waitingResponse": 0,
    "oldestWaitingMinutes": null,
    "inboundMessagesByDay": []
  }
}
```

Regra: esse endpoint deve exigir autenticacao administrativa.

---

## 10. Prioridade de implementacao

Ordem recomendada:

1. Criar UI visual do dashboard com dados derivados dos endpoints atuais.
2. Implementar metricas confiaveis: hoje, ocupacao, disponibilidade, profissionais, status, origem.
3. Adicionar bloco WhatsApp com conversas abertas e tempo desde ultima mensagem.
4. Criar endpoint `/dashboard/summary`.
5. Instrumentar funil publico apenas depois, se for realmente util.

Nao comecar por financeiro.
Nao comecar por graficos complexos.
Comecar por decisao operacional do dia.
