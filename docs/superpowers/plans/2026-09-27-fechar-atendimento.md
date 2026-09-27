# Fechar atendimento — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Marcar como feito" abre um resumo onde o barbeiro confere os serviços
(vários), aplica acréscimo ou desconto e, no presencial, registra o cliente; o
total confirmado alimenta o Financeiro.

**Architecture:** Um núcleo puro (`CALENDARIO/lib/fechamento.ts`) calcula e
valida. Um seletor de serviços (`components/ui/SeletorDeServicos.tsx`) é usado
pelo lápis e pelo resumo. O resumo (`components/FecharAtendimentoModal.tsx`)
chama `concluirAtendimento`, que fala com a rota nova e com o mock. O Financeiro
passa a ler `evento.fechamento.total`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, framer-motion,
lucide-react. Sem framework de teste: o núcleo é testado por um script com
`node:assert` rodado via `npx tsx`.

Spec: `docs/superpowers/specs/2026-09-27-fechar-atendimento-design.md`.

## Global Constraints

- Separador de vários serviços no texto: `", "`. Nomes de combo usam `+`.
- Preço guardado no dia da conclusão; atendimento sem `fechamento` usa a tabela.
- Ajuste: `"acrescimo" | "desconto"`, motivo opcional até 60 caracteres.
- Desconto não pode passar do subtotal.
- Presencial: pelo menos um serviço; cliente opcional; sem nome vira
  "Cliente presencial"; telefone, se preenchido, com 10 ou 11 dígitos.
- Produto não entra no resumo (vai em "Venda de produtos").
- Card de exemplo (id < 0) nunca chama a API.
- Verificação: `npx tsc --noEmit` e `npm run build` em `CALENDARIO/`;
  `git diff --check` na raiz.

---

### Task 1: Núcleo do fechamento

**Files:**
- Create: `CALENDARIO/lib/fechamento.ts`
- Test: `CALENDARIO/lib/fechamento.teste.ts`

**Interfaces:**
- Produces:
  - `type TipoAjuste = "acrescimo" | "desconto"`
  - `interface AjusteDeValor { tipo: TipoAjuste; valor: number; motivo?: string }`
  - `interface ServicoDoAtendimento { servicoId?: number; nome: string; preco: number }`
  - `interface FechamentoDoAtendimento { servicos: ServicoDoAtendimento[]; ajuste: AjusteDeValor | null; total: number; concluidoEm: string }`
  - `interface ClientePresencial { nome: string; telefone: string }`
  - `separarServicos(texto: string | null | undefined): string[]`
  - `juntarServicos(nomes: string[]): string`
  - `precoDoCatalogo(preco: string | undefined): number`
  - `itensDoCatalogo(nomes: string[], catalogo: ConfiguredService[]): ServicoDoAtendimento[]`
  - `calcularTotais(servicos: ServicoDoAtendimento[], ajuste: AjusteDeValor | null): { subtotal: number; total: number }`
  - `validarFechamento(entrada: { servicos: ServicoDoAtendimento[]; ajuste: AjusteDeValor | null; cliente?: ClientePresencial | null }): Record<string, string>`

- [x] **Step 1: Teste que falha** — `lib/fechamento.teste.ts` importa as funções
  e confere: separar/juntar com combo; preço "35" → 35, "R$ 40,00" → 40, vazio
  → 0; `itensDoCatalogo` acha por nome sem acento/caixa e cai para preço 0 se não
  existir; totais com acréscimo e desconto; validação (sem serviço, desconto
  maior que subtotal, telefone incompleto, cliente vazio aceito).
- [x] **Step 2:** `npx tsx lib/fechamento.teste.ts` → falha (módulo não existe).
- [x] **Step 3:** Implementar `lib/fechamento.ts` com as assinaturas acima.
  Valores em reais, somas feitas em centavos inteiros.
- [x] **Step 4:** `npx tsx lib/fechamento.teste.ts` → imprime `ok`.

### Task 2: Rota de conclusão (API + mock)

**Files:**
- Modify: `CALENDARIO/types.ts` (Event ganha `fechamento?: FechamentoDoAtendimento | null`)
- Modify: `CALENDARIO/services/calendarApi.ts` (`toEvent` lê `raw.fechamento`; nova `concluirAtendimento`)
- Modify: `CALENDARIO/services/mock/mundo.ts` (`AgendamentoMock.fechamento?`)
- Modify: `CALENDARIO/services/mock/rotas.ts` (POST `agendamentos/:id/concluir`)

**Interfaces:**
- Consumes: tipos e `calcularTotais` / `validarFechamento` da Task 1.
- Produces:
  ```ts
  export interface ConcluirAtendimentoPayload {
    servicos: ServicoDoAtendimento[];
    ajuste: AjusteDeValor | null;
    cliente?: ClientePresencial | null;
  }
  export async function concluirAtendimento(id: number, payload: ConcluirAtendimentoPayload): Promise<Event>
  ```
  Rota: `POST agendamentos/:id/concluir` → `{ event }`. O mock recalcula o
  total, grava `status: "concluido"`, `servico` (nomes juntos), `fechamento` e,
  se vier cliente com nome, `cliente`/`telefone`. Erro de validação → lança
  `Error` com a primeira mensagem.

- [x] Implementar, `npx tsc --noEmit` passa.

### Task 3: Financeiro lê o fechamento

**Files:**
- Modify: `CALENDARIO/components/financeiro/modelo.ts`

**Interfaces:**
- `DetalhesAtendimentoFinanceiro` ganha `itens?: { nome: string; valor: number }[]`
  e `ajuste?: number` (positivo acréscimo, negativo desconto).
- `OrigemPrecoServico` ganha `"fechamento"`.
- `converterEventosEmReceitas`: com `evento.fechamento`, `valor = fechamento.total`,
  `origemPreco = "fechamento"`, `itens` e `ajuste` preenchidos; sem ele, como hoje.
- `comporFaturamentoPorServico`: receita com `itens` conta cada item pelo
  preço; ajuste ≠ 0 entra como "Ajustes de atendimento".

- [x] Estender `lib/fechamento.teste.ts`? Não: teste próprio
  `components/financeiro/fechamento-financeiro.teste.ts` convertendo um evento
  concluído com fechamento (Corte 35 + Sobrancelha 15, desconto 5) → receita 45,
  composição Corte 35 / Sobrancelha 15 / Ajustes −5. Rodar com `npx tsx`.
- [x] `npx tsc --noEmit` passa.

### Task 4: Seletor de vários serviços + lápis

**Files:**
- Create: `CALENDARIO/components/ui/SeletorDeServicos.tsx`
- Modify: `CALENDARIO/components/EventModal.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function SeletorDeServicos(props: {
    opcoes: ConfiguredService[];
    selecionados: string[];            // nomes
    onChange: (nomes: string[]) => void;
  }): JSX.Element
  ```
  Dois grupos, "Combos" (`category === "combos"`) e "Serviços", botões com
  `aria-pressed`, check e preço. Nomes selecionados que não estão no catálogo
  aparecem num grupo "Fora da tabela" para poderem ser desmarcados.
- EventModal: `service: string` vira `servicos: string[]`; a folha de serviço
  usa o seletor e fecha em "Pronto"; o campo mostra `juntarServicos`; salva
  `composeDescription(phone, juntarServicos(servicos))`; validação "Selecione
  pelo menos um serviço." e todos no catálogo (exceto os já gravados).

- [x] Implementar, `npx tsc --noEmit` passa.

### Task 5: Resumo "Fechar atendimento" e ligação no Kanban

**Files:**
- Create: `CALENDARIO/components/FecharAtendimentoModal.tsx`
- Modify: `CALENDARIO/components/DayKanban.tsx`
- Modify: `CALENDARIO/App.tsx`

**Interfaces:**
- Consumes: Task 1, `concluirAtendimento` (Task 2), `SeletorDeServicos` (Task 4),
  `CurrencyField`.
- Produces:
  ```tsx
  export default function FecharAtendimentoModal(props: {
    evento: Event | null;               // null = fechado
    profissional?: Professional;
    onFechar: () => void;
    onConcluir: (evento: Event, payload: ConcluirAtendimentoPayload) => Promise<void>;
  }): JSX.Element
  ```
- DayKanban ganha `onPedirFechamento: (evento: Event) => void`; o botão
  "Marcar como feito" chama isso em vez de concluir direto; exemplos também.
- App guarda `eventoEmFechamento`; `onConcluir` do exemplo (id < 0) só avisa e
  fecha; do real chama `concluirAtendimento`, troca o evento em `events`, e
  limpa o presencial ativo do barbeiro se for aquele card.
- Remover `onCompleteEvent`/`handleCompleteEvent` se ficarem sem uso.

- [x] Implementar, `npx tsc --noEmit` e `npm run build` passam.

### Task 6: Verificação e registro

- [x] Rodar os dois testes `npx tsx`.
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- [x] No navegador (mock), se o login passar: concluir agendado sem mudança,
  com serviço a mais, com desconto; presencial com e sem cliente; conferir no
  Financeiro. Se o login não passar, dizer isso ao dono.
- [x] Commit das tarefas.
