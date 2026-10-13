# Guia do site

## O que é

O site público onde o cliente agenda: página inicial da barbearia, escolha de
serviço, barbeiro, dia e horário, e confirmação. React 18 + Vite. Porta local 3001.

Até 29/09/2026 vivia fora deste repositório, sem git — a cópia de trabalho do Victor
(`SITE-BARB-PROF-UNICO`, depois `site-agendamentos`). A documentação que vinha junto,
da época do "Aplicativo FULL", está em `../docs/historico/site-agendamentos/`: é
histórico, não instrução.

## A barbearia vem do caminho

`/lucas-costa` é a home da Barbearia Lucas Costa; `/lucas-costa/agendar`, o
agendamento. `lib/barbearia.ts` lê o slug, e o transporte (`api/index.ts`) o manda em
**toda** chamada — a API responde 400 sem ele.

**Não há loja padrão.** Sem barbearia no caminho, ou com uma que não existe, o site
mostra `components/SemBarbearia.tsx`. Cair numa loja escolhida no escuro é o defeito
que a API também recusa.

## O que o site NÃO faz

Não escreve nada além do agendamento. Página inicial, categorias e serviços são
editados no painel (modal de Configurações), com login. A tela de administração que
existia aqui (`AdminDrawer`) foi removida: não era montada por nenhuma rota, e era a
única razão de o bundle carregar senha do dono e token de administrador.

## Verificação

- `npx tsc --noEmit`
- `npm run build`
- Percurso completo contra a API local: `VITE_API_BASE_URL=http://localhost:3334 npx vite`,
  e abrir `http://localhost:3001/lucas-costa`. A API precisa liberar o CORS para a
  porta 3001 (`CORS_ORIGINS` no `.env` do calendário).
- `VITE_VISUAL_MOCK=1` roda sem nenhuma chamada de rede, para lapidar interface.

## No ar (13/10/2026)

`https://agendar-barbearia.vercel.app/lucas-costa` — projeto **próprio** na Vercel
(`agendar-barbearia`), separado do painel. Deploy pela CLI, de dentro desta pasta:

```bash
npx vercel deploy --prod --yes --scope inadequado-3455s-projects
```

- A API vem de `.env.production` (versionado; não é segredo).
- `.vercelignore` próprio: o da raiz não vale quando o deploy parte daqui, e a CLI
  não lê o `.gitignore`.
- A API só aceita o site porque o domínio está em `CORS_ORIGINS` **no projeto
  `barbearia-wpp`** (o da API). Domínio novo do site → entra lá, e a API precisa de
  um novo deploy para a variável valer.

## Pendente

- Os links de "Política de privacidade" e "Termos de uso" apontam para páginas que
  nunca existiram — vinham assim da cópia original.
