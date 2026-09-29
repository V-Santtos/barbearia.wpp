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

## Pendente

- **Deploy:** o `vercel.json` da raiz ainda não publica o site.
- Os links de "Política de privacidade" e "Termos de uso" apontam para páginas que
  nunca existiram — vinham assim da cópia original.
