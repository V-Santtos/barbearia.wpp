# Guia do calendário

## Missão desta pasta

`CALENDARIO/` é a prioridade deste checkout: a casca do agendamento online e do
painel do dono que será entregue ao dev. O objetivo atual é lapidar a interface e
deixar seus contratos compreensíveis sem reconstruir o backend que ele conduz em
outro ambiente.

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
| `server.js` | Contratos antigos de referência; não é o backend atual do dev |
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

## Skills de design

- `frontend-design`: direção visual e remodelagem intencional.
- `mobile-ux-patterns`: interação e responsividade do painel no celular/PWA.
- `web-design-guidelines`: auditoria objetiva de acessibilidade e qualidade web,
  sempre buscando as regras atuais antes da revisão.

## Verificação

Execute a partir desta pasta:

- `npx tsc --noEmit`
- `npm run build`

Na raiz do repositório, execute também `git diff --check`. Verificação visual não
substitui a conferência do usuário nos fluxos que exigem login.

