# Mapa de endpoints do agendamento online e do calendário

**Levantamento:** 2026-09-27
**Finalidade:** entregar ao desenvolvedor os contratos que as interfaces atuais consomem ou já pedem. Este mapa descreve o frontend desta cópia; não atesta o backend que ele mantém em outro ambiente.

## Fontes e legenda

- **Site público:** `C:\Users\victo\Desktop\Projetos Gith Hub\Barbearia Site\Aplicativo FULL\SITE-BARB-PROF-UNICO`, sobretudo `api/index.ts`, `hooks/`, `components/StepPhone.tsx` e `components/StepPro.tsx`.
- **Calendário/painel:** `CALENDARIO/services/calendarApi.ts`, consumidores em `CALENDARIO/App.tsx` e `CALENDARIO/components/`.
- **Referência antiga:** `CALENDARIO/server.js`. Uma rota aqui não prova que exista no backend atual do dev.
- **Simulações visuais:** `CALENDARIO/services/mock/rotas.ts` (`VITE_MOCK=1`) e `SITE-BARB-PROF-UNICO/api/visualMock.ts` (`VITE_VISUAL_MOCK=1`). São independentes e não compartilham dados.
- **Em uso** = chamada por uma tela montada. **Definido** = wrapper existe, mas nenhuma tela atual o chama. **Pendente** = interface usa o contrato, mas o servidor antigo não o implementa ou apresenta divergência.

As rotas abaixo são relativas à base da API (`/api` por padrão no calendário; `VITE_API_BASE_URL` no site público). Datas usam `YYYY-MM-DD`, horários `HH:MM` e IDs de profissionais são numéricos na resposta normalizada do calendário.

## 1. Agendamento online: percurso do cliente

| Método e rota | Uso atual | Entrada e resposta consumidas | Evidência |
|---|---|---|---|
| `GET /configuracao/home` | Textos da home | Resposta **`{valor: {heroLine1, heroName, ctaLabel}}`** no site público | `hooks/useSiteConfig.ts`, `api/index.ts:getConfig` |
| `GET /categorias-servicos` | Categorias/filtros da vitrine | `{filtersEnabled, items: [{id, label, active}]}` | `hooks/useSiteConfig.ts` |
| `GET /servicos` | Lista de serviços/preços | Array `{id, slug, category, name, desc, price}`; `price` é string na casca | `hooks/useServices.ts` |
| `GET /agendamentos/verificar-telefone?phone=` | Conferência de telefone na primeira etapa | `{exists: boolean, servico?, barbeiro?, data?, horario?, source?}` | `components/StepPhone.tsx`, `api/index.ts:checkPhone` |
| `GET /profissionais` | Escolha do barbeiro | Array ou `{professionals: [...]}`; cada item tem `id`, `nome`, `cor`, `ativo`; inativos são filtrados | `components/StepPro.tsx` |
| `GET /profissionais/:id/agenda` | Dias indisponíveis ao selecionar barbeiro | `{DisableDays: string[]}` | `components/StepPro.tsx` |
| `GET /profissionais/:id/agenda-config` | Dias de trabalho, horários, pausa, duração e janela de agendamento | `AgendaConfig` descrito abaixo | `hooks/useCalendar.ts` |
| `GET /profissionais/:id/dias-bloqueados` | Bloqueios aplicados no calendário público | Array `{id, data, motivo, periodos, created_at}` | `hooks/useCalendar.ts` |
| `GET /agendamentos/dias-disponiveis?professionalId=&days=` | Dias elegíveis e indicadores de ocupação | `{professionalId, days, openDays: [{date, availableSlotsCount, totalSlotsCount, occupancyRatio, firstSlot}], disabledDays}` | `hooks/useCalendar.ts` |
| `GET /agendamentos/horarios-disponiveis?professionalId=&date=` | Horários da data e reconferência antes de confirmar | `{availableSlots: string[]}`; servidor antigo também envia `professionalId` e `date` | `hooks/useCalendar.ts`, `hooks/useBooking.ts` |
| `POST /agendamentos` | Confirmação | Corpo `{telefone, cliente, profissional, servico, dia_marcado, hora_marcada, status: "agendado", source: "app-etapas"}`. Sucesso aceito quando há `event` ou `status` `ok/success`; `message/mensagem` fornece texto | `hooks/useBooking.ts`, `api/index.ts:createBooking` |

O site reconfere o horário antes do `POST`. O servidor precisa validar disponibilidade novamente na gravação e sinalizar conflito (a referência antiga usa HTTP 409); a consulta prévia não reserva a vaga. `profissional` no corpo é **nome**, enquanto as consultas de agenda usam **id**. Essa diferença já existe na interface.

`AgendaConfig`: `{profissional_id, dias_semana: number[], hora_inicio, hora_fim, duracao_min, intervalo_inicio, intervalo_duracao_min, janela_agendamento_dias, atualizado_em}`. Dias da semana vão de `0` (domingo) a `6` (sábado). Pausa pode ser `null`.

## 2. Calendário e painel do dono

| Método e rota | Uso atual | Corpo, filtros ou resposta necessários |
|---|---|---|
| `GET /profissionais` | Lista da agenda, filtros e gestão | Array de profissionais `{id, nome, cor, ativo}`; o adapter aceita também `name/color` |
| `POST /profissionais` | Criar profissional | `{nome, cor}` → profissional criado |
| `PATCH /profissionais/:id` | Renomear/recolorir | Campos opcionais `{nome?, cor?}` → profissional atualizado |
| `DELETE /profissionais/:id` | Remover profissional | Resposta de sucesso sem corpo obrigatório |
| `GET /profissionais/:id/agenda-config` | Configurar agenda, criar evento e perfil | `AgendaConfig` acima |
| `PUT /profissionais/:id/agenda-config` | Dias, expediente, pausa, duração e janela | Corpo sem `profissional_id` e `atualizado_em` → `AgendaConfig` atualizado |
| `GET /profissionais/:id/dias-bloqueados?date=` | Configuração de agenda e bloqueios no perfil | Array de `DiaBloqueado`; `date` é opcional |
| `POST /profissionais/:id/dias-bloqueados` | Bloquear dia ou períodos | `{data, motivo?, periodos?}`; `periodos` usa `morning/afternoon/night`, `null` significa dia todo |
| `DELETE /profissionais/:id/dias-bloqueados/:data` | Desbloquear data | Sucesso sem corpo obrigatório |
| `GET /clientes/buscar?telefone=` | Preencher nome de cliente conhecido ao criar evento | `{encontrado: boolean, nome?: string}` |
| `GET /servicos` | Serviço no modal de evento e leitura financeira | Array com `name` e, quando presentes, `id`, `slug`, `category`, `desc`, `price` |
| `GET /agendamentos` | Carregar agenda e base dos atendimentos do Financeiro | Array de eventos; adapter aceita `from` e `to` opcionais. Campos relevantes: `id`, `cliente`, `telefone`, `profissional`, `professional_id`, `servico`, `dia_marcado`, `hora_marcada`, `status`, `source`, `startTime`, `endTime` |
| `POST /agendamentos` | Criar evento no painel, inclusive presencial | `{profissional, dia_marcado, hora_marcada, cliente, telefone, servico?, source?}` → `{event}` |
| `PUT /agendamentos/:id` | Editar evento | Campos opcionais `{telefone, cliente, profissional, servico, dia_marcado, hora_marcada, status}` → `{event}` |
| `PATCH /agendamentos/:id/status` | Alterar status | `{status}`; valores no servidor antigo: `agendado`, `confirmado`, `concluido`, `cancelado`, `reagendado` |
| `DELETE /agendamentos/:id` | Excluir evento | Sucesso sem corpo obrigatório |
| `GET /agendamentos/horarios-disponiveis?professionalId=&date=` | Escolha e validação de horário no modal | `{availableSlots: string[]}` |
| `GET /agendamentos/dias-disponiveis?professionalId=&days=` | Encontrar o primeiro dia livre no modal | `{openDays: [{date, ...}]}`; a tela usa o primeiro item |
| `GET /dashboard/resumo?date=` | KPIs, ocupação, disponibilidade e agenda do dia | Objeto `DashboardResumo` descrito abaixo; `date` é a data local de quem usa o painel |

`DashboardResumo` já é um contrato importante: `{gerado_em, hoje, profissionais, agenda, disponibilidade, periodos}`. `profissionais[]` traz expediente, `janela_dias`, `grade_hoje`, `capacidade_hoje` e `livres_hoje`; `agenda[]` traz horário, cliente, telefone, status e origem; `disponibilidade` traz dias e estados de vagas por profissional; `periodos` agrega `hoje`, `7d`, `15d` e `30d`, tanto para `all` como por ID. A estrutura exata está tipada em `CALENDARIO/services/calendarApi.ts:490` e consumida por `CALENDARIO/components/dashboard/DashboardScreen.tsx`. A tela foi desenhada para receber esse resumo em uma chamada, com os números calculados pelo servidor.

## 3. Configurações do site, editadas no calendário

O modal atual de **Configurações do site** no calendário usa os três recursos abaixo. O site público lê os mesmos dados. As escritas são necessárias para que texto, categorias, serviços e preços publicados reflitam as edições do dono.

| Método e rota | Corpo de `PUT` / leitura esperada pelo calendário | Estado nesta cópia |
|---|---|---|
| `GET`/`PUT /configuracao/home` | `{heroLine1, heroName, ctaLabel}` | Mock do calendário responde; `server.js` antigo não contém a rota |
| `GET`/`PUT /categorias-servicos` | `{filtersEnabled, items: [{id, label, active}]}` | Mock do calendário responde; `server.js` antigo não contém a rota |
| `GET`/`PUT /servicos` | Array `{id?, slug?, category?, name, desc?, price?}` | `GET` existe no servidor antigo; `PUT` só no mock |

O calendário faz três `PUT` **em sequência**, sem transação entre eles. O `GET /configuracao/home` exige alinhamento antes da integração: o site público desempacota `{valor: ...}`, mas o calendário espera o objeto direto. O dev pode escolher um formato único e adaptar um dos clientes. `price` hoje é string decimal em reais, e `category` referencia o `id` da categoria. Ver a [spec do modal](superpowers/specs/2026-09-27-configuracoes-site-agendamento.md).

## 4. Financeiro: lançamentos manuais já desenhados

O Financeiro permite **criar, editar e excluir** lançamentos manuais do tipo `entrada`, `saida` ou `ajuste`. Uma entrada manual positiva soma ao **resultado operacional**, sem alterar **Faturamento**, que continua reservado aos atendimentos concluídos. Ajuste positivo soma ao resultado e ajuste negativo o reduz. Receitas automáticas são somente leitura no detalhe e devem ser corrigidas no agendamento de origem.

**Desktop:** a seção Financeiro tem “Novo lançamento” no cabeçalho e mantém o atalho “Criar” da coluna. O formulário abre como modal; após salvar, a movimentação aparece na tabela e atualiza os resumos do período. **Mobile:** Financeiro continua dentro da aba Dashboard, pelo seletor do título. “Novo lançamento” fica no cabeçalho, ao lado de “Comparar períodos”; o mesmo formulário abre como folha vinda do rodapé, com conteúdo rolável e ações sempre acessíveis. Não há uma quarta aba no dock.

| Ação da interface | Dados já definidos | Situação atual |
|---|---|---|
| Listar movimentos | `id`, `tipo`, `origem`, `data`, `descricao`, `categoria`, `valor`; movimentos automáticos também têm vínculo com atendimento | A lista combina agendamentos concluídos com manuais em memória |
| Criar entrada, saída ou ajuste | `{tipo: "entrada" | "saida" | "ajuste", categoria, valor, data, descricao}` | Salva somente em memória da sessão; entrada e saída exigem valor positivo, ajuste aceita valor positivo ou negativo diferente de zero |
| Editar manual | `id` e campos `tipo`, `data`, `descricao`, `categoria`, `valor` | Altera somente o estado local |
| Excluir manual | `id` e **motivo obrigatório** solicitado pela confirmação | Remove do estado local; o motivo é coletado, mas atualmente descartado |

O formulário oferece categorias de entrada (“Venda avulsa”, “Gorjeta”, “Outras entradas”) distintas das categorias de saída. A tabela permite filtrar **Todos**, **Faturamento**, **Entradas** manuais e **Saídas**. O KPI Resultado discrimina entradas manuais dos atendimentos, saídas e ajustes; o gráfico de “Faturamento e saídas” continua representando apenas essas duas séries.

Não há chamadas HTTP para essas ações. Para torná-las reais, o dev precisará oferecer **listagem, criação, alteração e exclusão auditável** de movimentos manuais, com IDs persistentes e autoria. Os nomes das rotas ficam a critério dele; esta interface ainda não validou um caminho HTTP. Não confundir lançamento manual com confirmação de pagamento de um agendamento: esse estado também não existe no frontend.

## 5. Divergências e decisões de integração

1. **Contrato de configuração:** alinhar envelope de `GET /configuracao/home` entre os dois frontends. Confirmar as três rotas de escrita no backend do dev; o servidor antigo as removeu.
2. **Edição de profissional no mock:** o frontend envia `PATCH /profissionais/:id` e o servidor antigo implementa `PATCH`; o mock do calendário simula `PUT`. Portanto, editar profissional com `VITE_MOCK=1` pode cair na rede. Corrigir o mock quando esse fluxo voltar a ser validado.
3. **Filtro de agendamentos:** `getEvents(from, to)` prepara `from/to` e o mock aplica ambos; o servidor antigo só filtra por `professionalId/date`. As chamadas atuais da agenda usam `getEvents()` sem intervalo. Confirmar se haverá paginação/intervalo antes de usar os parâmetros como contrato garantido.
4. **Fonte de dados:** os dois mocks vivem em processos separados. Salvar no calendário local não muda o site público local. O teste conjunto exige ambos apontando para a mesma API de desenvolvimento.
5. **Autorização:** a tela de login do calendário mantém apenas uma sessão visual em `localStorage`; por si só não autentica chamadas. `VITE_ADMIN_API_TOKEN` é opção de build e não deve ser a proteção definitiva de escrita. O dev deve definir autenticação/autorização do dono no backend. Este mapa não supõe uma rota de login ainda inexistente.
6. **Preços e pagamentos:** o Financeiro deriva receitas de atendimentos concluídos e dos preços atuais em `/servicos`. As ações manuais da seção anterior já definem o comportamento a persistir, mas não têm endpoint. Pagamento, preço histórico e preço por profissional ainda não têm contrato validado pelo frontend.
7. **Wrappers legados não usados pelo site:** `api/index.ts` ainda exporta `GET /agendamentos?professionalId=`, `PUT /profissionais/:id/agenda-config`, `POST /profissionais/:id/dias-bloqueados` e `DELETE /profissionais/:id/dias-bloqueados/:data` e `PUT /configuracao/:chave`, `/categorias-servicos`, `/servicos`; nenhuma tela pública montada os chama. O antigo `AdminDrawer.tsx` permanece no código, mas não está montado. As escritas agora pertencem ao modal do calendário.

## Ordem útil para integração

1. **Jornada pública:** leitura da vitrine, profissionais, agenda e disponibilidade; verificação de telefone; criação com conflito de horário.
2. **Operação do calendário:** leitura e gestão de profissionais, horários, bloqueios, clientes e agendamentos.
3. **Dashboard:** uma resposta coerente de `/dashboard/resumo`, com a mesma regra de ocupação da disponibilidade.
4. **Publicação das configurações:** harmonizar formatos e conectar os três recursos de leitura e escrita a uma fonte compartilhada.
5. **Financeiro manual:** persistir entrada, saída e ajuste já presentes na interface, preservando a diferença entre faturamento de atendimentos e resultado operacional.

Esta ordem é uma sugestão de integração, não uma afirmação sobre o backend atual. O desenvolvedor pode manter suas rotas e adaptar os clientes, desde que preserve os dados e comportamentos acima.
