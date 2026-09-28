# Guia do calendário

## Missão desta pasta

`CALENDARIO/` tem as duas metades do painel do dono: a interface (React/Vite) e a API
que a serve (`server.js`, Fastify), contra o banco real. A interface é a frente do
Victor; a API é a frente do backend. Desde 28/09/2026 as duas rodam juntas, com login
de verdade.

Antes de editar, leia a seção atual de `../CONTEXTO.md` e a spec relacionada em
`../docs/superpowers/specs/`.

## Mapa de navegação

| Caminho | Responsabilidade |
|---|---|
| `App.tsx` | Composição de alto nível e estado de navegação da casca |
| `components/shell/` | Coluna, barra superior, registro e gaveta das seções |
| `components/conversations/` | Experiência desktop de conversas |
| `components/dashboard/` | Dashboard e seu CSS segmentado |
| `components/financeiro/` | Leitura financeira visual; lançamentos manuais ainda em memória |
| `components/EventModal.tsx` | Fluxo de criar e editar agendamento no painel |
| `components/ui/` | Primitivos visuais reutilizáveis |
| `services/calendarApi.ts` | Seam de transporte e tradução de dados |
| `services/mock/` | Adapter em memória com o mesmo contrato do Fastify |
| `server.js` | A API. Rotas do painel em `noPainel()` (RLS pela sessão); rotas públicas em `noSite()` (barbearia explícita) |
| `lib/autenticacao.js` | Verificação do JWT e `comUsuario()`, a ponte entre o token e a RLS |
| `lib/sessao.ts` | Sessão do Supabase Auth no painel |
| `ferramentas/verificar-isolamento.mjs` | Verificação ponta a ponta de autenticação e isolamento (`npm run verificar`) |
| `hooks/` | Estado e polling compartilhados |
| `types.ts` | Vocabulário de dados consumido pela interface |

## Restrições atuais

- **Toda rota nova da API entra em `noPainel()` ou `noSite()`.** Fora dos dois ela não
  dá erro — vaza dado entre barbearias. E ganha uma checagem em
  `ferramentas/verificar-isolamento.mjs`.
- `VITE_MOCK=1` não pode chegar ao build de produção.
- Agenda, Conversas, Dashboard e Financeiro são seções irmãs no desktop.
- A interface visual não conhece `VITE_MOCK`; a troca entre adapters acontece no
  transporte em `services/calendarApi.ts`.
- Seções podem permanecer montadas para preservar estado, mas polling de seção
  inativa deve ficar desabilitado.
- O fluxo mobile já contém decisões validadas. Não o alterar como efeito colateral de
  uma rodada desktop.
- Dashboard e Financeiro permanecem no estado descrito em `../CONTEXTO.md`; não
  preencher placeholders por iniciativa própria.
- A validação visual atual de Conversas deve acontecer com o dono. Não abrir uma
  inspeção visual autônoma no navegador antes do feedback solicitado ali.

## Skills de design

- `frontend-design`: direção visual e remodelagem intencional.
- `mobile-ux-patterns`: interação e responsividade do painel no celular/PWA.
- `web-design-guidelines`: auditoria objetiva de acessibilidade e qualidade web,
  sempre buscando as regras atuais antes da revisão.

## Verificação

Execute a partir desta pasta:

- `npx tsc --noEmit`
- `npm run build`
- `npm run verificar` — sempre que mexer em `server.js` ou em `lib/`. Sobe a API contra
  o banco real e confere autenticação e isolamento; só roda em banco com o seed de
  teste.

Na raiz do repositório, execute também `git diff --check`. Verificação visual não
substitui a conferência do usuário nos fluxos que exigem login.
