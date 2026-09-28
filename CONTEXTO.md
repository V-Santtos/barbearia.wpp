# Contexto atual

Este arquivo registra somente o estado e o próximo passo. Histórico arquivado:
`docs/historico/CONTEXTO-ate-2026-09-26.md` (frente da casca) e
`docs/historico/CONTEXTO-backend-ate-2026-09-28.md` (frente do backend: auditoria,
reconstrução do banco, os quatro defeitos de deploy e as Fases 1–4 contadas em
detalhe). Decisões duráveis ficam em `REGRAS-APRENDIZADOS/REGRAS.md`; avaliações de
skills em `docs/skills-log.md`.

## Papel deste repositório

Um produto, duas frentes em paralelo, combinadas entre Victor e Agostinho:

- **Casca (Victor):** a interface do painel do dono e do agendamento online em
  `CALENDARIO/`, construída sobre um mundo de teste (`VITE_MOCK=1`) enquanto o
  banco não estava disponível para ele.
- **Backend (Agostinho):** banco, autenticação, isolamento entre barbearias e a API
  (`CALENDARIO/server.js`), além do bot em `BARBEARIA/`.

As duas frentes se encontraram em **28/09/2026**, na branch
`integracao/casca-multitenant`: a casca passou a rodar contra o banco real, com login
de verdade. `CALENDARIO/server.js` **é** o backend atual — não um contrato antigo de
referência, como o checkout da casca registrava.

O site público de agendamento continua fora deste repositório.

## Estado — frente do backend

- **Banco:** Supabase `bbcuudayemhjanklfgtr` (Postgres 17.6), recriável do zero pelas
  13 migrações de `BARBEARIA/db/migracoes/` + `db/seed/teste.sql`. O seed tem duas
  lojas de propósito; o serviço "SÓ DA LOJA B" é o discriminador de vazamento.
  **Plano free: pausa após ~7 dias sem uso** — pausou entre 08/09 e 26/09, e
  restaurar preservou tudo.
- **Multi-tenant pronto (Fases 1–4):** `barbearia_id` em toda tabela, RLS com 11
  políticas, papel `app_api` sem bypass, login por e-mail e senha no Supabase Auth,
  rotas públicas exigindo a barbearia.
- **Regra de toda rota nova:** do painel → dentro de `noPainel()`; pública → dentro
  de `noSite()`. Rota fora dos dois não dá erro — ela vaza.
- **Dono de teste:** `usuario@teste.com`, ligado à loja `lucas-costa`.
- **Bot em standby** (`BOT_STANDBY=1`): recebe e grava, não responde. O agendamento é
  pelo site. Volta junto com a Fase 6 (bot resolvendo a barbearia pelo número), não
  antes.
- **Dispositivos de transição ainda vivos:** o default `barbearia_em_transicao()` em 5
  tabelas que só o bot escreve, e o gatilho `agendamentos_resolver_profissional`.
  Morrem na Fase 6. Enquanto existirem, um insert do bot que esqueça a barbearia cai
  na loja A em silêncio.
- **Verificação:** `cd CALENDARIO && npm run verificar` — 24 checagens ponta a ponta de
  autenticação, RLS e rotas públicas, contra o banco real. Só roda em banco com o seed
  de teste, e devolve o dono original de cada loja ao terminar.
- **No ar** (`barbearia-wpp-two.vercel.app`) ainda está o código de **01/09**: login
  decorativo, sem isolamento, bot atendendo. Nada das Fases 1–4 foi publicado.

## Estado — frente da casca

- A segunda rodada visual de 2026-09-26 (KPIs, período de 7 dias, ListaFluxo, janelas em folha, barra de rolagem global) foi commitada em 2026-09-27. Falta conferir no iPhone.
- Agenda, Conversas, Dashboard e Financeiro são seções irmãs no desktop. No celular e no tablet, o Financeiro fica dentro da aba Dashboard, e a troca é uma pílula “Dashboard | Financeiro” no topo (2026-09-27; antes era o título com seta).
- O Financeiro usa movimentos manuais e categorias criadas pelo barbeiro em memória, mais dados demonstrativos no modo mock. Não tratar essa interface como persistência pronta.
- Rodada de 2026-09-27, commitada: lançamento manual só com Entrada e Saída (Ajuste removido), categorias mínimas com “+ Nova categoria”, comissão com barbeiro, máscara de moeda, Faturamento = atendimentos + entradas, Comparar períodos com Semana/Mês/Ano, e o resumo “Fechar atendimento” no “Marcar como feito” (vários serviços, acréscimo/desconto, cliente opcional no presencial). Nenhum card é concluído sozinho e o presencial não se apaga. Decisões em `REGRAS-APRENDIZADOS/REGRAS.md`; desenho em `docs/superpowers/specs/2026-09-27-fechar-atendimento-design.md`. A rota nova `POST agendamentos/:id/concluir` existe só no mock e precisa do dev.
- A rota de busca de cliente por telefone (`/clientes/buscar`) foi verificada contra o banco novo na integração de 28/09, e entrou em `noPainel()` — ela lia pelo pool que ignora RLS e mostraria clientes de todas as lojas. As demais regras novas da casca ainda não foram verificadas contra o banco.
- O template externo de dashboard usado como referência foi recuperado em C:\Users\victo\Desktop\Referencias\dashboard-shadcn-admin. Ele não faz parte do produto; fonte e versão estão em docs/skills-log.md.
- Em 2026-09-27, a configuração do site público saiu da montagem do painel oculto em `Barbearia Site/Aplicativo FULL/SITE-BARB-PROF-UNICO` e ganhou um modal centralizado na engrenagem do calendário (desktop) e no menu do avatar (celular). As três áreas são Página de agendamento, Categorias e Serviços e preços. O fluxo foi conferido com `VITE_MOCK=1`; os contratos de escrita ainda dependem do backend do dev e o mock dos dois frontends não é compartilhado. Ver `docs/superpowers/specs/2026-09-27-configuracoes-site-agendamento.md`.
- A rodada visual de 2026-09-27 alinhou o site público ao painel: CTA da home, proporção no celular, cartões de serviço, descrições em Inter, espaçamento das etapas, calendário na virada de mês e resumo final. Victor manteve o degradê roxo do título e adiou a revisão geral da tipografia. O roteamento do botão de serviço para a segunda etapa fica com o dev. As decisões duráveis estão em `REGRAS-APRENDIZADOS/REGRAS.md`.
- O modal de Configurações foi refinado em `CALENDARIO/components/settings/BookingSiteSettings.tsx`: campos compartilhados com o calendário, seleção de categorias pelo `NeonCheckbox`, menu “Página inicial”, menos divisores e estado ocioso sem “Tudo atualizado”. Depois do feedback de Victor, a lateral desktop passou a compartilhar o fundo do modal e a começar na altura do título; o ícone do cabeçalho ficou maior e sem círculo. Conferido no navegador em largura estreita e a 1440 px; `npx tsc --noEmit`, `npm run build` e `git diff --check` passaram. As alterações continuam locais e ainda podem receber avaliação visual do dono.

## Etapa atual: validar a integração

1. Login real no painel (`usuario@teste.com`) e as telas da casca com dado real, no
   navegador. **Em andamento.**
2. Commitar a integração, mostrar ao Victor a reorganização de `AGENTS.md` (feita
   sobre a estrutura dele) e levar para a `main`.
3. Victor traz a `main` para a `casca-de-secoes` antes de continuar nela.
4. Deploy — checklist abaixo.

## Fila do backend: o que a casca pede e o servidor ainda não tem

`docs/mapa-endpoints-frontend.md` (Victor, 27/09) é o contrato que as telas esperam.
Rotas que hoje **só existem no mock** e são trabalho do backend:

- `GET`/`PUT /configuracao/home` — e alinhar o formato: o site desempacota
  `{valor: ...}`, o painel espera o objeto direto
- `GET`/`PUT /categorias-servicos`
- `PUT /servicos`
- `POST /agendamentos/:id/concluir` — o "Fechar atendimento"
- lançamentos manuais do Financeiro (hoje em memória)

Toda rota nova entra em `noPainel()` ou `noSite()`, e ganha uma checagem em
`ferramentas/verificar-isolamento.mjs`.

## PENDENTE: o deploy (adiado em 08/09/2026)

Tudo abaixo está **pronto e verificado localmente, e NÃO está no ar**. O banco já
mudou (Fases 1 e 2 aplicadas); o código que sabe usar essas mudanças, não. O que
segura o sistema funcionando nesse intervalo são os dois dispositivos de transição
(gatilho + default `barbearia_em_transicao()`).

### As Fases 3 e 4 agora sobem JUNTAS, com o JWT ligado

Isto mudou em 08/09 e custa uma quebra se for ignorado: quatro rotas públicas são
usadas também pelo painel (`/profissionais`, `/servicos`, `agenda-config`,
`dias-bloqueados`). O painel não manda slug — ele depende da sessão. **Em modo legado
não há sessão, e essas quatro respondem 400.**

Ou seja: `SUPABASE_JWKS_URL` e as variáveis do Supabase deixaram de ser opcionais
neste deploy. Subir o código sem elas deixa o painel meio quebrado (calendário e
dashboard funcionam; equipe, serviços e configuração de agenda, não).

Conferido no ar local, nos dois modos.

### A ordem importa, e errá-la derruba o bot

**`BOT_STANDBY=1` tem que entrar na Vercel ANTES do deploy** que exigir o slug nas
rotas públicas. Motivo: o bot em produção ainda chama `/dias-disponiveis`,
`/horarios-disponiveis` e `POST /agendamentos` **sem slug nenhum**. Com o slug
obrigatório e o bot ativo, ele passa a receber 400 em toda consulta de agenda.

Em standby ele não chama nada disso — mas só entra em standby quando a variável
existir.

### Variáveis a configurar na Vercel (são suas)

| Variável | Onde | Efeito |
|---|---|---|
| `BOT_STANDBY=1` | bot | silencia o bot. **Entra primeiro.** |
| `DATABASE_URL_APP` | calendário | conexão `app_api`, sem bypass de RLS |
| `SUPABASE_JWKS_URL` | calendário | **liga o modo JWT.** Sem ela, tudo segue no modo legado |
| `VITE_SUPABASE_URL` | painel | `https://bbcuudayemhjanklfgtr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | painel | chave publicável |
| ~~`VITE_ADMIN_API_TOKEN`~~ | painel | **APAGAR.** Só sai do bundle quando a variável some do build |
| ~~`VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD`~~ | painel | **APAGAR.** Não são mais lidos |

O JWKS não é segredo e já é conhecido:
`https://bbcuudayemhjanklfgtr.supabase.co/auth/v1/.well-known/jwks.json`

### Antes disso, no painel do Supabase

1. Authentication → Providers → Email: habilitar (e decidir sobre confirmação de
   e-mail, que exige SMTP próprio).
2. Criar o usuário do dono, e me passar o e-mail — falta ligar em
   `barbearias.user_id`, hoje `null` nas duas lojas.
3. `alter role app_api password '<senha forte>';` — a senha alimenta o `DATABASE_URL_APP`.

### Depois de subir, conferir no ar

- O log da subida diz `"modo":"jwt"` e não `"modo":"legado"`.
- Login do painel com e-mail e senha funciona; o `ADMIN_API_TOKEN` antigo é recusado.
- `GET /api/servicos` **não** devolve mais o serviço "SÓ DA LOJA B" — é o
  discriminador que prova o isolamento em produção.
- Mensagem real no WhatsApp: o bot não responde, mas a conversa aparece no painel.

### A armadilha para o dia em que o bot voltar

Tirar `BOT_STANDBY` sem antes fazer a Fase 6 (bot resolvendo a barbearia pelo
`phone_number_id`) devolve o bot ao ar **sem saber mandar o slug** — e ele tomará 400
em toda consulta de agenda. O bot volta junto com a Fase 6, não antes.

### O que continua em aberto

- **Não há autenticação real.** O login do painel é decorativo e o
  `ADMIN_API_TOKEN` viaja no bundle — a própria CLI da Vercel exigiu marcá-lo como
  público para aceitar. Riscos 1 e 2 de `AUDITORIA/04-RISCOS.md`. É a Fase 3.
- **A API do calendário não tem um único teste** — 2.501 linhas, e é onde moram os
  três dos quatro bugs de 01/09.
- **Rotacionar antes de produção:** senha do banco, os três tokens de integração e
  a senha do painel (hoje `123`) apareceram no chat, por decisão consciente de
  ambiente de teste.
- O ponytail de `src/db/eventos.ts` **venceu**: a chamada HTTP ao calendário
  acontece dentro da transação, e a API deixou de estar em localhost.
- **O site de agendamento existe fora deste repositório** e será adaptado a este
  modelo no futuro — não é código a escrever do zero.

## Pendências de produto abertas com Victor

- Avaliar o espaço vazio abaixo das seções na coluna desktop, sem inventar função para preenchê-lo.
- Conferir no celular o resumo “Fechar atendimento” e a pílula Dashboard | Financeiro com o dono.
- Agendamentos que ninguém marcar como feito ficam pendentes na agenda; decidir se isso pede um aviso de pendentes.
- Conferir a rodada mobile pendente no iPhone e a tabela de Movimentações a 375 px, onde data e valor podem quebrar linha.
- Retomar a fila de Conversas desktop somente com o feedback visual do dono.
- A varredura de tema claro foi adiada pelo dono em 2026-09-26. Não iniciar sem nova decisão de paleta e escopo.

## Em aberto, fora da etapa

- **Rotacionar antes de produção:** senha do banco, tokens de integração e senha do
  `app_api` passaram pelo chat, por decisão consciente de ambiente de teste.
- O ponytail de `BARBEARIA/src/db/eventos.ts` (HTTP dentro da transação) está
  vencido, mas dormente: em standby a chamada não acontece. Volta a importar na Fase 6.
