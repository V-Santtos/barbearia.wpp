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

O site público de agendamento entrou no repositório em 29/09/2026, em `SITE/` — ver
a seção própria abaixo.

## Estado — frente do backend

- **Banco:** Supabase `bbcuudayemhjanklfgtr` — **conta pessoal do Agostinho, projeto
  "barb"**, região us-east-2 (Postgres 17.6). Recriável do zero pelas
  15 migrações de `BARBEARIA/db/migracoes/` + `db/seed/teste.sql`. O seed tem duas
  lojas de propósito; o serviço "Platinado", só da `central-teste`, é o
  discriminador de vazamento — "SÓ DA LOJA B" é a **descrição** dele, não o nome
  (buscar pelo nome devolve 0).
  **Plano free: pausa após ~7 dias sem uso** — pausou entre 08/09 e 26/09 e de novo
  até 12/10; nas duas, restaurar preservou tudo e derrubou a produção enquanto
  durou. Regra prática: pausa no trabalho maior que uma semana → restaurar antes.
- **Dados além do seed na loja A**, dos testes de 29/09 no navegador: profissional
  "Barbeiro Teste", serviço "Teste" (R$ 10), agendamento de "Agostinho Cury" para
  01/10 (feito pelo site, ponta a ponta) e um "Atendimento Presencial". O seed não os
  apaga — só os agendamentos que ele mesmo cria.
- **Multi-tenant pronto (Fases 1–4):** `barbearia_id` em toda tabela, RLS com 11
  políticas, papel `app_api` sem bypass, login por e-mail e senha no Supabase Auth,
  rotas públicas exigindo a barbearia.
- **Regra de toda rota nova:** do painel → dentro de `noPainel()`; pública → dentro
  de `noSite()`. Rota fora dos dois não dá erro — ela vaza.
- **Dono:** `usuario@teste.com`, ligado à loja `lucas-costa` — inclusive em produção,
  por decisão de 12/10, até a rotação de segredos antes do primeiro cliente real.
- **Bot em standby** (`BOT_STANDBY=1`): recebe e grava, não responde. O agendamento é
  pelo site. Volta junto com a Fase 6 (bot resolvendo a barbearia pelo número), não
  antes. **O número do bot foi desligado e está em outro uso** (informado em 12/10): a
  Fase 6 vai precisar de um número novo ou da volta deste. Por isso o standby não foi
  provado no ar — não há tráfego chegando.
- **Dispositivos de transição ainda vivos:** o default `barbearia_em_transicao()` em 5
  tabelas que só o bot escreve, e o gatilho `agendamentos_resolver_profissional`.
  Morrem na Fase 6. Enquanto existirem, um insert do bot que esqueça a barbearia cai
  na loja A em silêncio.
- **Verificação:** `cd CALENDARIO && npm run verificar` — 50 checagens ponta a ponta de
  autenticação, RLS e rotas públicas, contra o banco real. Só roda em banco com o seed
  de teste, e devolve o dono original de cada loja ao terminar.
- **No ar** (`barbearia-wpp-two.vercel.app`) desde **12/10**: Fases 1–4, Configurações
  do site e Fechar atendimento, com login real e RLS. Ver "Deploy de 12/10" abaixo.

## Estado — frente da casca

- A segunda rodada visual de 2026-09-26 (KPIs, período de 7 dias, ListaFluxo, janelas em folha, barra de rolagem global) foi commitada em 2026-09-27. Falta conferir no iPhone.
- Agenda, Conversas, Dashboard e Financeiro são seções irmãs no desktop. No celular e no tablet, o Financeiro fica dentro da aba Dashboard, e a troca é uma pílula “Dashboard | Financeiro” no topo (2026-09-27; antes era o título com seta).
- O Financeiro usa movimentos manuais e categorias criadas pelo barbeiro em memória, mais dados demonstrativos no modo mock. Não tratar essa interface como persistência pronta.
- Rodada de 2026-09-27, commitada: lançamento manual só com Entrada e Saída (Ajuste removido), categorias mínimas com “+ Nova categoria”, comissão com barbeiro, máscara de moeda, Faturamento = atendimentos + entradas, Comparar períodos com Semana/Mês/Ano, e o resumo “Fechar atendimento” no “Marcar como feito” (vários serviços, acréscimo/desconto, cliente opcional no presencial). Nenhum card é concluído sozinho e o presencial não se apaga. Decisões em `REGRAS-APRENDIZADOS/REGRAS.md`; desenho em `docs/superpowers/specs/2026-09-27-fechar-atendimento-design.md`. A rota `POST agendamentos/:id/concluir` ganhou servidor em 12/10.
- A rota de busca de cliente por telefone (`/clientes/buscar`) foi verificada contra o banco novo na integração de 28/09, e entrou em `noPainel()` — ela lia pelo pool que ignora RLS e mostraria clientes de todas as lojas. As demais regras novas da casca ainda não foram verificadas contra o banco.
- O template externo de dashboard usado como referência foi recuperado em C:\Users\victo\Desktop\Referencias\dashboard-shadcn-admin. Ele não faz parte do produto; fonte e versão estão em docs/skills-log.md.
- Em 2026-09-27, a configuração do site público saiu da montagem do painel oculto em `Barbearia Site/Aplicativo FULL/SITE-BARB-PROF-UNICO` e ganhou um modal centralizado na engrenagem do calendário (desktop) e no menu do avatar (celular). As três áreas são Página de agendamento, Categorias e Serviços e preços. O fluxo foi conferido com `VITE_MOCK=1`; os contratos de escrita ainda dependem do backend do dev e o mock dos dois frontends não é compartilhado. Ver `docs/superpowers/specs/2026-09-27-configuracoes-site-agendamento.md`.
- A rodada visual de 2026-09-27 alinhou o site público ao painel: CTA da home, proporção no celular, cartões de serviço, descrições em Inter, espaçamento das etapas, calendário na virada de mês e resumo final. Victor manteve o degradê roxo do título e adiou a revisão geral da tipografia. O roteamento do botão de serviço para a segunda etapa fica com o dev. As decisões duráveis estão em `REGRAS-APRENDIZADOS/REGRAS.md`.
- O modal de Configurações foi refinado em `CALENDARIO/components/settings/BookingSiteSettings.tsx`: campos compartilhados com o calendário, seleção de categorias pelo `NeonCheckbox`, menu “Página inicial”, menos divisores e estado ocioso sem “Tudo atualizado”. Depois do feedback de Victor, a lateral desktop passou a compartilhar o fundo do modal e a começar na altura do título; o ícone do cabeçalho ficou maior e sem círculo. Conferido no navegador em largura estreita e a 1440 px; `npx tsc --noEmit`, `npm run build` e `git diff --check` passaram. As alterações continuam locais e ainda podem receber avaliação visual do dono.

## Etapa atual (12/10/2026): retomar pela ordem combinada

Ordem decidida com o usuário em 12/10, depois do relatório geral:

1. ~~Restaurar o banco~~ — feito em 12/10, conferido íntegro.
2. ~~Conferir o site (`SITE/`) no navegador~~ — feito em 29/09, logo depois do commit
   do site: o Agostinho agendou pela tela (agendamento 120, `source = app-etapas`) e o
   viu no painel. Constatado no banco em 12/10; nada no `SITE/` nem na API mudou
   desde então.
3. ~~Fechar atendimento junto com o preço histórico~~ — feito em 12/10 (seção
   abaixo), conferido no navegador pelo Agostinho: agendamento 120 concluído com
   Corte + Barba e desconto, total no Financeiro.
4. **Deploy** — painel, API e bot **no ar em 12/10** (seção "Deploy de 12/10").
   **Falta a 4d: publicar o `SITE/`** num projeto Vercel próprio (decidido em 12/10),
   apontando para a API deste e entrando no `CORS_ORIGINS`.

**O Victor precisa trazer a `main` para a `casca-de-secoes`** antes de continuar nela
— em 12/10 ainda não tinha trazido, e não commitava desde 27/09.

### Configurações do site — backend pronto (29/09/2026)

As rotas que o modal do Victor pedia existem: `GET`/`PUT /configuracao/home`,
`GET`/`PUT /categorias-servicos` e `PUT /servicos`. Leitura por `noSite` (o site pelo
slug, o painel pela sessão); escrita por `noPainel`, só na própria loja.

- Migração `20260929120000_configuracoes_do_site.sql`: `categorias_servicos` e
  `configuracoes_site`, ambas com RLS. A ligação serviço → categoria é uma **chave
  composta com a barbearia** — o banco recusa um serviço da loja A apontando para uma
  categoria da loja B, sem depender de o código lembrar.
- A página inicial devolve o **objeto direto**; serviço que sai da lista é
  **desativado**, não apagado — as duas decisões de 29/09.
- **Mudou no transporte, e o Victor precisa saber:** `saveBookingSiteSettings` passou
  a devolver o que o servidor gravou, e o modal troca o rascunho por isso. A tela
  criava serviços novos com id negativo e guardava o próprio rascunho depois de
  salvar; com banco real, o serviço ganhava id de verdade e o próximo "Salvar" o
  criaria **de novo**. O mock não mostrava, porque grava o id negativo como chega.
- `npm run verificar` ganhou 17 checagens, e o teste agora fotografa catálogo,
  categorias e configuração das duas lojas e os devolve no fim.

**Conferido no navegador em 29/09/2026**, com login real: carregar, salvar a página
inicial, criar serviço e salvar duas vezes sem duplicar, remover serviço.

### O site entrou no repositório (29/09/2026)

Estava na máquina em cinco cópias antigas (abril a agosto) e numa atual,
`~/Desktop/projetos/agendamentos-barbearia/site-agendamentos`, a cópia de trabalho
do Victor com a rodada visual de 27/09 — sem git. Veio para `SITE/` como cópia; a
pasta original ficou intacta.

Adaptado ao backend novo:

- **A barbearia vem do caminho** (`/lucas-costa`), e o transporte a manda em toda
  chamada. Sem ela, ou com uma que não existe, a tela "Barbearia não encontrada" —
  sem loja padrão.
- A página inicial lê o **objeto direto** (antes `{valor: ...}`).
- **Saiu o `AdminDrawer`**: nenhuma rota o montava, e ele era a única razão de o
  bundle carregar `VITE_OWNER_PASSWORD` e `VITE_ADMIN_API_TOKEN`. As escritas dele
  pertencem ao modal de Configurações do painel. Conferido: nenhum dos segredos no
  build.

Percurso do cliente testado contra a API local, com as chamadas que o site faz: dez
leituras em 200, agendamento 201 gravado na loja certa, mesmo horário 409, o
barbeiro da loja A pelo endereço da loja B 404.

**Falta:** o `vercel.json` publicar o site. (A conferência no navegador foi feita em
29/09 — ver a etapa atual.)

### Fechar atendimento — backend pronto (12/10/2026)

`POST /agendamentos/:id/concluir`, em `noPainel()`. O "preço histórico" **é** o
fechamento: os serviços com o preço do dia, o ajuste e o total, gravados na coluna
`agendamentos.fechamento` (jsonb, migração `20261012120000`). Decisões de 12/10:

- **jsonb, não tabela de itens** — quem soma é o Financeiro, na tela. Marcado com
  `ponytail:` na migração; o gatilho é relatório por serviço em SQL.
- **Concluir de novo, ou um cancelado, é 409** — o preço gravado não muda.
- O preço de cada item vem da tela (o dono conferiu); o servidor recalcula o total em
  centavos, recusa desconto maior que o subtotal e `servicoId` de outra loja.
- No presencial grava o cliente; sem nome, "Cliente presencial".

A migração estreou no barb **tratado como teste**, por decisão do usuário: é o único
banco, mas não tem cliente real e a coluna aceita nulo — o código de 01/09 no ar não
a vê. `npm run verificar` ganhou 9 checagens; `tsc`, build e os dois testes de
`lib/fechamento` passaram.

**Conferido no navegador em 12/10/2026.** No mesmo dia, a pedido do usuário, o
detalhe da movimentação no Financeiro passou a mostrar, quando há ajuste, "Valor dos
serviços", "Desconto"/"Acréscimo" e o motivo; o valor grande segue sendo o total. O
ranking "Serviços que mais faturaram" conta o preço cheio de cada serviço, sem o
ajuste — aprovado assim.

**Ainda aberto:** o `PATCH /agendamentos/:id/status` aceita `concluido` sem
fechamento. A tela nova não conclui por ele, mas a porta existe.

## Fila do backend: o que a casca pede e o servidor ainda não tem

`docs/mapa-endpoints-frontend.md` (Victor, 27/09) é o contrato que as telas esperam.
Rotas que hoje **só existem no mock** e são trabalho do backend:

- ~~`POST /agendamentos/:id/concluir`~~ — feito em 12/10, ver abaixo
- lançamentos manuais do Financeiro (hoje em memória)

Toda rota nova entra em `noPainel()` ou `noSite()`, e ganha uma checagem em
`ferramentas/verificar-isolamento.mjs`.

## Deploy de 12/10/2026

Painel, API e bot subiram pela CLI (`npx vercel deploy --prod --yes --scope
inadequado-3455s-projects`, da raiz). O projeto **não** está ligado ao git: push na
`main` não publica nada, e o "Redeploy" do painel reconstrói o código **daquele**
deploy (em 12/10 ele republicou o de 01/09 com as variáveis novas).

Conferido no ar: log com `"modo":"jwt"`; bundle sem `localhost:3334` e sem token de
admin; `/api/servicos` sem barbearia → 400; com `lucas-costa`, sem o "Platinado" da
loja B; `ADMIN_API_TOKEN` antigo → 401; login do dono e painel com dados (agenda,
dashboard, conversas em 200).

Dois tropeços, registrados em `REGRAS-APRENDIZADOS/APRENDIZADOS.md`:

- **Não havia `.vercelignore`.** A CLI não lê o `.gitignore`; o `.env` local subiria e o
  Vite assaria `VITE_CALENDAR_API_URL=localhost:3334` e o token no bundle. Criado.
- **`DATABASE_URL_APP` foi com o host direto** (só IPv6), e toda rota do painel deu 500
  com `ENOTFOUND`. Na Vercel é o pooler: usuário `app_api.bbcuudayemhjanklfgtr`, host
  `aws-0-us-east-2.pooler.supabase.com`, porta 6543.

### A armadilha para o dia em que o bot voltar

Tirar `BOT_STANDBY` sem antes fazer a Fase 6 (bot resolvendo a barbearia pelo
`phone_number_id`) devolve o bot ao ar **sem saber mandar o slug** — e ele tomará 400
em toda consulta de agenda. O bot volta junto com a Fase 6, não antes.

### O que continua em aberto

- **A API do calendário tem só a verificação ponta a ponta** (`npm run verificar`), não
  testes de unidade — é onde moraram três dos quatro bugs de 01/09.
- **Rotacionar antes do primeiro cliente real** (decidido em 12/10): senha do banco
  (e a do `app_api`), os tokens de integração e a senha do `usuario@teste.com`
  passaram pelo chat. Junto, criar o dono de verdade e religar a `lucas-costa`.
- `VITE_ADMIN_API_TOKEN`, `VITE_OWNER_*` foram apagadas da Vercel; o `ADMIN_API_TOKEN`
  do servidor segue existindo, mas em modo JWT é recusado.

## Pendências de produto abertas com Victor

- Avaliar o espaço vazio abaixo das seções na coluna desktop, sem inventar função para preenchê-lo.
- Conferir no celular o resumo “Fechar atendimento” e a pílula Dashboard | Financeiro com o dono.
- Agendamentos que ninguém marcar como feito ficam pendentes na agenda; decidir se isso pede um aviso de pendentes.
- Conferir a rodada mobile pendente no iPhone e a tabela de Movimentações a 375 px, onde data e valor podem quebrar linha.
- Retomar a fila de Conversas desktop somente com o feedback visual do dono.
- A varredura de tema claro foi adiada pelo dono em 2026-09-26. Não iniciar sem nova decisão de paleta e escopo.

## Em aberto, fora da etapa

- **Rotacionar antes do primeiro cliente real** — ver "Deploy de 12/10".
- O ponytail de `BARBEARIA/src/db/eventos.ts` (HTTP dentro da transação) está
  vencido, mas dormente: em standby a chamada não acontece. Volta a importar na Fase 6.
