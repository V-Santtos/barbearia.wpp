# Guia do calendário

## Missão desta pasta

`CALENDARIO/` é a prioridade deste checkout. O objetivo atual é enxergar, organizar
e lapidar a experiência visual do painel do dono sem reconstruir o backend que está
sendo conduzido pelo dev em outro repositório.

Antes de editar, leia a seção atual de `../CONTEXTO.md` e a spec relacionada em
`../docs/superpowers/specs/`.

## Mapa de navegação

| Caminho | Responsabilidade |
|---|---|
| `App.tsx` | Composição de alto nível e estado de navegação da casca |
| `components/shell/` | Coluna, barra superior, registro e gaveta das seções |
| `components/conversations/` | Experiência desktop de conversas |
| `components/dashboard/` | Dashboard e seu CSS segmentado |
| `components/ui/` | Primitivos visuais reutilizáveis |
| `services/calendarApi.ts` | Seam de transporte e tradução de dados |
| `services/mock/` | Adapter em memória com o mesmo contrato do Fastify |
| `hooks/` | Estado e polling compartilhados |
| `types.ts` | Vocabulário de dados consumido pela interface |

## Restrições atuais

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

## Linguagem arquitetural

Em análises de estrutura, use: **module**, **interface**, **implementation**,
**depth**, **seam**, **adapter**, **leverage** e **locality**. Aplique o deletion
test antes de propor a extração ou fusão de arquivos.

## Skills de design

- `frontend-design`: direção visual e remodelagem intencional.
- `web-design-guidelines`: auditoria objetiva de acessibilidade e qualidade web,
  sempre buscando as regras atuais antes da revisão.
- `impeccable`: não carregar por padrão; está retida temporariamente apenas por seu
  detector e fluxo de inspeção, enquanto a substituição pelas duas skills acima é
  validada.

## Verificação

Execute a partir desta pasta:

- `npx tsc --noEmit`
- `npm run build`

Na raiz do repositório, execute também `git diff --check`. Verificação visual não
substitui a conferência do usuário nos fluxos que exigem login.

