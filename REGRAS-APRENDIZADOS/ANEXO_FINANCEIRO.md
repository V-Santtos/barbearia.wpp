# Anexo: Financeiro da barbearia

**Levantamento:** 2026-09-08  
**Estado:** pesquisa para discussão; nenhuma função ou modelo de dados aprovado  
**Escopo:** operação e leitura financeira de barbearias. Não é módulo contábil.

## Método e recorte

O levantamento priorizou produtos que dizem atender **barbearias explicitamente**.
“Mais famoso” não tem um ranking universal verificável; por isso a seleção combina
presença pública, adoção declarada e relevância do produto para o fluxo real de uma
barbearia. As funções abaixo só foram marcadas quando apareceram em página oficial,
central de ajuda ou documentação do próprio fornecedor.

Produtos generalistas de salão não são a base deste relatório. Quando uma solução
atende vários segmentos, só entram aqui as páginas e os fluxos que ela descreve para
barbearia.

## Síntese executiva

O mercado não converge para um ERP enorme. O núcleo repetido é pequeno:

1. transformar atendimento concluído e pago em entrada automática;
2. separar serviço, produto, plano e outras origens da receita;
3. registrar despesas, retiradas, investimentos, vales, estornos e ajustes;
4. fechar o caixa por forma de pagamento;
5. calcular comissão sem planilha;
6. mostrar o que entrou, o que saiu, o que ainda falta receber/pagar e o que sobrou;
7. comparar períodos e abrir o detalhe que explica cada número.

Os diferenciais não estão tanto em criar dezenas de funções, mas em conectar bem
agenda, recebimento, comissão, estoque e relatório. O melhor desenho para o nosso
produto é, portanto, uma superfície curta com **drill-down**: visão simples primeiro;
modal, gaveta ou tabela explica o número quando o dono pedir.

### Decisão de escopo para a primeira versão — 2026-09-08

- **Assinaturas, comissões e controle por forma de pagamento não entram no V1.**
- Esses três temas ficam mapeados para evolução, sem abas vazias, filtros inativos ou
  componentes de fachada no produto atual.
- O sistema não fará cobrança online. O cliente paga presencialmente, normalmente em
  dinheiro ou Pix.
- O barbeiro não terá de reabrir cada atendimento para informar manualmente como o
  cliente pagou.
- Enquanto não existir um estado de pagamento/reconciliação, o número derivado da
  agenda será chamado de **faturamento dos atendimentos concluídos**, nunca de
  “recebido em caixa”.
- Permanecem manuais apenas fatos que o sistema não consegue deduzir: compras,
  materiais, custos, investimentos, retiradas e ajustes.

## Referências de mercado específicas para barbearia

### Trinks

Cobertura financeira publicada:

- entradas, saídas e fechamento de caixa integrados aos agendamentos;
- fluxo de caixa, DRE, ticket médio e mais de 130 relatórios;
- comissão automática, repasse em lote e split pela maquininha/Conta Stone;
- Pix, links de pagamento e notas fiscais;
- estoque com entradas, saídas e alertas;
- clube de assinaturas como receita recorrente.

Sinal de presença: a página oficial declara mais de 40 mil negócios atendidos.

Lição para o nosso sistema: integrar a origem do dinheiro é mais importante que
oferecer um gráfico isolado. A venda/atendimento deve gerar o movimento e a comissão
sem segunda digitação.

Fontes: [financeiro Trinks](https://negocios.trinks.com/solucoes/simplificar-financas/),
[Trinks para barbearias](https://negocios.trinks.com/negocios/barbearias/),
[relatório de comissões](https://ajuda.trinks.com/diferen%C3%A7a-do-filtro-de-cada-data-do-relat%C3%B3rio-de-comiss%C3%B5es).

### Avec

Cobertura financeira publicada para barbearia:

- fluxo de caixa em tempo real;
- comissão automática e split no ato pela AvecPay;
- visão de ganhos para cada profissional e antecipação de comissão;
- produtos/estoque ligados ao financeiro;
- emissão de nota fiscal;
- clube de assinaturas com assinantes ativos, receita do mês, previsão futura e
  gestão de inadimplência.

Lição para o nosso sistema: comissão a pagar e receita recorrente são obrigações e
previsões diferentes do dinheiro já disponível. Elas não devem inflar o saldo atual.

Fontes: [Avec para barbearias](https://negocios.avec.app/sistema-para-barbearia-gestao-e-clientes),
[clube de assinaturas](https://negocios.avec.app/clube-de-assinaturas-para-beleza).

### AppBarber

Cobertura financeira publicada:

- caixa, contas a pagar, contas a receber e fluxo de caixa;
- taxas de cartão;
- comissão por serviço e produto;
- comissão bruta, líquida ou com taxa descontada;
- vales/adiantamentos, remunerações e deduções;
- pagamento de comissão originando saída no caixa ou no financeiro;
- estoque com custo, lucro por produto, validade e valor total do inventário;
- pacotes de serviços/produtos como antecipação de receita.

Sinal de presença: o AppBarber PRO exibia 2,4 mil avaliações e nota 4,9 na App
Store brasileira durante o levantamento.

Lição para o nosso sistema: “pagar comissão” não pode apenas trocar um status. Deve
registrar a origem do pagamento e criar a saída correspondente, mantendo trilha.

Fontes: [funcionalidades AppBarber](https://www.appbarber.com.br/funcionalidades/),
[como funcionam as comissões](https://appbarber-appbeleza.zendesk.com/hc/pt-br/articles/360021152412-Como-funcionam-as-comiss%C3%B5es),
[App Store](https://apps.apple.com/br/app/appbarber-pro-profissionais/id1602535418).

### Aparo

Cobertura financeira publicada:

- distinção explícita entre “atendido” e “recebido”;
- abertura, entradas, saídas, saldo esperado e fechamento do caixa;
- separação por forma de pagamento;
- lançamento de despesa no caixa e registro do motivo de correções;
- pendências de clientes e histórico de fechamentos;
- entradas por serviço, produto, plano e crédito;
- saídas por despesa, comissão, vale e estorno;
- contas vencidas/a vencer, comissão a pagar e plano atrasado;
- comissão diferente para serviço avulso, plano e venda de produto;
- exportação por período e filtros em Excel, PDF e CSV.

O próprio produto delimita que isso não é contabilidade oficial, não puxa extrato
bancário e não emite nota.

Lição para o nosso sistema: o painel deve mostrar a diferença entre produção e caixa.
Um corte concluído pode ainda estar pendente; uma assinatura recebida pode financiar
atendimentos futuros.

Fontes: [funcionalidades Aparo](https://www.useaparo.com.br/funcionalidades),
[controle de caixa mensal](https://www.useaparo.com.br/blog/controlar-caixa-barbearia-visao-do-mes).

### Barbeiro.app

Cobertura financeira publicada:

- pagamento de atendimento ou produto entrando automaticamente no caixa;
- separação entre Pix, cartão e dinheiro;
- comissão por profissional e serviço no mesmo evento do pagamento;
- fechamento diário em um clique;
- relatórios diário, semanal e mensal de faturamento, ticket médio e desempenho;
- produto com preço de custo, preço de venda, baixa de estoque, alerta e margem;
- assinaturas recorrentes e pagamentos online;
- exportação de dados para o contador, sem calcular impostos.

Lição para o nosso sistema: a baixa operacional deve ser rápida; a tela analítica
pode ser rica, mas concluir atendimento e registrar pagamento não pode virar um
formulário financeiro longo.

Fontes: [controle financeiro](https://www.barbeiro.app/funcionalidades/controle-financeiro),
[venda de produtos](https://www.barbeiro.app/funcionalidades/venda-de-produtos),
[funcionalidades](https://www.barbeiro.app/funcionalidades).

### SQUIRE

Cobertura financeira publicada:

- POS ligado ao agendamento e ao checkout de cliente avulso;
- receita por barbeiro, dia e tipo de serviço;
- venda de varejo, forma de pagamento, gorjeta, desconto e estorno;
- fechamento diário e relatórios de receita/desempenho;
- comissão, aluguel de cadeira, Auto Payout e transferência rápida;
- estoque e margem de produto;
- proteção contra no-show por cartão cadastrado;
- relatórios de retenção, mix de serviços e venda adicional de produtos.

Sinal de presença: a empresa publica estudo baseado em 7 mil barbearias.

Lição para o nosso sistema: o recorte de barbearia exige enxergar cadeira/profissional,
serviço e produto na mesma transação, não apenas um total genérico de vendas.

Fontes: [playbook operacional](https://getsquire.com/business-edge/barbershop-operations-playbook),
[POS para barbearias](https://www.getsquire.com/features/pos-payments),
[gestão de barbearia](https://getsquire.com/business-edge/barber-booking-app).

### Barberly

Cobertura financeira publicada:

- POS e pagamentos online para serviços e produtos;
- depósito de segurança, pagamento antecipado parcial/integral e cobrança de no-show;
- provedor de pagamento individual por membro da equipe;
- venda de produto e gestão de estoque;
- relatórios e exportações de agendamento em PDF/Excel.

Sinais de presença declarados: 55+ países, 11 mil+ profissionais, 500 mil
agendamentos mensais e 1 milhão+ de pagamentos.

Lição para o nosso sistema: é um bom exemplo do limite inferior. Pagamento e relatório
existem, mas não há evidência pública de um controle financeiro operacional tão
profundo quanto AppBarber, Aparo ou Trinks.

Fontes: [Barberly](https://www.barberly.co/pt-br),
[documentação](https://docs.barberly.com/en/),
[agendamentos e exportação](https://help.barberly.com/en/articles/3328238-appointments-general-information).

## O que o mercado oferece, por frequência

### Piso de mercado

- receita de serviço e produto;
- caixa por forma de pagamento;
- comissão por profissional;
- relatório por período;
- estoque ligado à venda;
- pagamento antecipado ou proteção contra falta.

### Frequente, mas não universal

- despesas manuais e recorrentes;
- contas a pagar e a receber;
- abertura, contagem e fechamento de caixa;
- taxa de cartão e valor líquido;
- adiantamentos/vales e deduções de profissional;
- pacotes e assinaturas;
- exportação para contador;
- múltiplas unidades.

### Diferenciais mais avançados

- split e repasse automático;
- comissão por regras diferentes de serviço, produto e plano;
- aluguel de cadeira;
- previsão de receita futura;
- DRE simplificada;
- conta digital e conciliação;
- inadimplência e nova tentativa de cobrança;
- consulta dos próprios ganhos pelo barbeiro;
- análise de margem por produto e serviço.

## Regra de verdade financeira para o nosso produto

O fluxo deve separar quatro fatos que hoje podem parecer um só:

1. **Agendado:** existe uma receita prevista, mas ainda não realizada.
2. **Atendido:** o serviço foi produzido; ainda pode não ter sido recebido.
3. **Pago:** existe recebimento registrado por uma ou mais formas de pagamento.
4. **Liquidado:** o dinheiro realmente ficou disponível após prazo/taxa da operadora.

Somente marcar o agendamento como concluído não prova pagamento. Da mesma forma,
somar o preço atual do cadastro do serviço sobre atendimentos antigos reescreve o
passado se o preço mudar. Cada atendimento financeiro precisa guardar um
**snapshot do preço praticado**, desconto, profissional, serviço e regra de comissão.

Na simplificação aprovada para o V1, o produto não tentará provar o pagamento. Ele
usará os atendimentos concluídos para calcular **faturamento operacional** e deixará
clara essa definição na interface. “Recebido”, saldo de caixa e conciliação só podem
aparecer quando houver um fato de pagamento. A regra de comissão fica fora do snapshot
do V1; será adicionada quando o módulo de comissões entrar.

### Lacuna observada neste checkout

- `CALENDARIO/types.ts` guarda `servico` e `status` no evento, mas não preço nem
  estado de pagamento;
- `services/calendarApi.ts` busca `ConfiguredService.price` separadamente;
- o mock ainda expõe o preço como `string` porque o contrato antigo o fazia assim;
- `concluido` hoje é estado de agenda, não recibo financeiro.

Portanto, a interface pode ser prototipada com mock, mas nenhuma soma financeira
deve ser tratada como contrato real até o dev confirmar o modelo atual. Este anexo
não autoriza mudança de API, banco ou Supabase.

## Escopo candidato para discussão

Nada abaixo está aprovado. É uma organização para a conversa de produto.

### Primeira versão

1. **Visão geral**
   - faturamento de atendimentos concluídos, saídas cadastradas e resultado operacional;
   - atendimentos/cortes concluídos no período;
   - ticket médio;
   - comparação com período anterior.
2. **Movimentação financeira operacional**
   - receitas automáticas de serviços concluídos;
   - saídas e ajustes manuais;
   - categorias de despesa e origem do lançamento;
   - tabela única de movimentos.
3. **Leitura por período**
   - hoje, 15 dias, mês, 6 meses, 1 ano e período personalizado;
   - comparação com período anterior equivalente;
   - decomposição por serviço, barbeiro e categoria de despesa.

### Próximas extensões sem dependência de pagamento

- contas a pagar/receber e recorrência de despesas;
- visão financeira de produtos: custo, venda, margem e capital parado;
- exportação CSV/PDF;
- múltiplas unidades;

### Futuro mapeado, fora da primeira versão

1. **Assinaturas da barbearia**
   - planos, assinantes ativos, receita recorrente, competência futura e inadimplência;
   - só entra quando existir uma decisão de negócio sobre planos e cobrança.
2. **Comissões**
   - regra por barbeiro/serviço/produto, valor gerado, pago e a pagar;
   - detalhe dos atendimentos que formam a base, vales e ajustes com motivo.
3. **Formas de pagamento e caixa reconciliado**
   - dinheiro, Pix e outras formas presenciais, se passarem a ser necessárias;
   - abertura/fechamento de caixa, valor esperado, contado e divergência;
   - não pressupõe pagamento online e não deve exigir classificação manual de cada
     atendimento apenas para alimentar um gráfico.
4. **Cobrança online e conciliação**
   - explicitamente fora da direção atual; só reabrir se o modelo operacional mudar.

### Fora do núcleo por enquanto

- contabilidade oficial, impostos ou escrituração;
- integração bancária;
- folha completa e obrigações trabalhistas;
- emissão fiscal;
- crédito/antecipação financeira;
- projeções sofisticadas baseadas em IA.

## Períodos e comparações

O filtro global candidato é:

- Hoje;
- 15 dias;
- Mês;
- 6 meses;
- Ano;
- Personalizado.

Cada seleção compara com uma janela equivalente imediatamente anterior:

| Atual | Comparação padrão |
|---|---|
| Hoje | ontem; opcionalmente o mesmo dia da semana |
| Últimos 15 dias | 15 dias anteriores |
| Mês atual | mês anterior |
| Últimos 6 meses | 6 meses anteriores |
| Ano atual | ano anterior |
| Personalizado | janela anterior de mesma duração |

A interface deve sempre escrever a base da comparação — por exemplo, “+12% vs.
mês anterior”. Percentual solto induz interpretação errada.

Para períodos curtos, agrupar por dia. Para 6 meses e ano, agrupar por mês. A
granularidade muda; a definição financeira não.

## Mapeamento do dashboard-espelho em localhost:3000

O template é Next/Tailwind/shadcn/Recharts, enquanto `CALENDARIO/` é React/Vite
com tokens CSS próprios. A regra existente continua valendo: aproveitar estrutura,
sequência, espaçamento, geometria e comportamento; não importar a stack ou um
segundo design system.

### Rotas inspecionadas

- [Finance atual](http://localhost:3000/dashboard/finance)
- [Finance V1](http://localhost:3000/dashboard/finance-v1)
- [E-commerce](http://localhost:3000/dashboard/ecommerce)
- [Invoice](http://localhost:3000/dashboard/invoice)

### Ligação entre necessidade e componente

| Necessidade da barbearia | Representação indicada | Referência no espelho | Observação |
|---|---|---|---|
| Resumo do período | bloco 2x2 de KPIs | `finance/_components/overview-kpis.tsx` | Trocar patrimônio pessoal por Faturamento concluído, Saídas, Resultado operacional e Cortes. |
| Comparação rápida | valor, delta absoluto e percentual | `overview-kpis.tsx` e `ecommerce/_components/kpi-strip.tsx` | Sempre nomear o período comparado. Evitar seis cartões soltos. |
| Entradas versus saídas | barras divergentes acima/abaixo de zero | `(legacy)/finance-v1/_components/cash-flow-overview.tsx` | É o gráfico mais aderente ao caixa. Funciona melhor que duas linhas que se cruzam. |
| Evolução de receita | linha temporal com seletor | `finance/_components/transactions-overview-card.tsx` | Usar para tendência acumulada/receita; não esconder saídas na mesma linha. |
| Origem da receita | barras horizontais proporcionais | `finance/_components/income-breakdown.tsx` | Serviços, produtos e planos; também pode alternar para Corte, Barba e Combos. |
| Composição do faturamento | rosca com total central | `finance/_components/balance-distribution-card.tsx` | No máximo 4–5 fatias. No V1, usar serviços; forma de pagamento e planos ficam fora. |
| Despesas por categoria | lista percentual compacta | `(legacy)/finance-v1/_components/spending-breakdown.tsx` | Aluguel, materiais, equipe, taxas e outros. Melhor que pizza com muitas fatias. |
| Contas próximas | lista cronológica com total | `finance/_components/upcoming-transactions.tsx` | Adaptar para despesas agendadas; comissão e plano ficam reservados para etapas futuras. |
| Estoque financeiro | anel de disponibilidade + contadores | `ecommerce/_components/inventory.tsx` | O anel serve para saúde do estoque; margem e capital parado pedem números ao lado. |
| Histórico de movimentos | tabela filtrável com chips/status | `ecommerce/_components/recent-orders.tsx` | Adaptar colunas para data, descrição, categoria, origem e valor; não incluir forma de pagamento no V1. |
| Novo lançamento | formulário em grupos | `invoice/_components/invoice-details.tsx`, `invoice-items.tsx` e `invoice-adjustments.tsx` | Reaproveitar hierarquia de campos, não o conceito de fatura. Abrir em modal/gaveta. |
| Exportação | ação secundária no cabeçalho | `finance/page.tsx` | No template é visual; implementar só quando existir exportação real. |

### O que parece pronto, mas não está

- em `Finance`, as abas **Accounts** e **Transactions** exibem “coming soon”;
- em `Finance V1`, Activity, Insights e Utilities estão desabilitadas;
- Settings, Export e vários atalhos/ações rápidas não possuem comportamento real;
- existem primitives `dialog.tsx`, `sheet.tsx`, `drawer.tsx` e
  `alert-dialog.tsx`, mas não há um modal financeiro pronto nas páginas;
- os dados e gráficos são mock;
- copiar componentes diretamente traria Tailwind, shadcn, Radix e Recharts para uma
  interface que hoje tem outra gramática técnica.

Conclusão: o espelho oferece uma boa biblioteca de **composição**, não um módulo
financeiro funcional para transplantar.

## Modais e gavetas candidatos

### 1. Novo lançamento

Objetivo: registrar uma exceção que não nasceu de atendimento ou venda.

Campos mínimos:

- Saída ou Ajuste;
- categoria;
- valor;
- data;
- descrição;
- recorrente ou único;
- comprovante opcional;
- unidade, quando existir multiunidade.

“Investimento”, “material”, “aluguel”, “retirada” e “aporte” são categorias, não
cinco fluxos diferentes.

### 2. Comparar períodos

Objetivo: responder por que o número subiu ou caiu.

Estrutura:

- métrica selecionada;
- período A e período B com valores absolutos;
- delta em reais e percentual;
- gráfico comum aos dois períodos;
- decomposição por serviço, barbeiro ou origem;
- botão “Ver movimentações” já filtrado.

Esse é o principal “modal inteligente”: não inventa insight; mostra a decomposição
que permite ao dono chegar à conclusão.

### 3. Detalhe de KPI

Ao clicar em Faturamento, Saídas, Resultado operacional, Ticket médio ou Cortes, abrir
uma gaveta lateral com definição da métrica, comparação, composição e movimentos
responsáveis. O mesmo componente pode atender todos os KPIs por configuração.

### 4. Detalhe de movimentação

- Receita automática de serviço: leitura apenas, com vínculo para atendimento,
  cliente, profissional, serviço, preço praticado e data de conclusão.
- Saída/ajuste manual: permite editar categoria, valor, data, descrição e comprovante,
  preservando a origem do lançamento.
- Exclusão ou estorno deve pedir confirmação e motivo; não pode desaparecer sem trilha.

### 5. Futuro — Comissão do barbeiro

- produção bruta;
- base comissionável;
- comissão por serviço/produto/plano;
- taxas e descontos;
- vales/adiantamentos;
- já pago e a pagar;
- lista dos atendimentos que formam o valor;
- ação futura de marcar/pagar com origem do dinheiro.

### 6. Futuro — Movimento de produto

Pode entrar depois do núcleo. Deve mostrar quantidade, custo unitário, motivo,
fornecedor e impacto financeiro. Venda de produto baixa estoque automaticamente;
compra ou ajuste manual exige lançamento próprio e trilha.

## Combinação visual candidata para a primeira discussão

Sem aprovar escopo, a composição de menor complexidade que cobre o pedido é:

1. cabeçalho com filtro global de período e comparação;
2. superfície 2x2 de KPIs: Faturamento, Saídas, Resultado operacional e Cortes;
3. gráfico largo de faturamento versus saídas ao longo do período;
4. origem do faturamento por serviço + despesas por categoria;
5. lista de despesas agendadas, quando essa extensão entrar;
6. tabela de movimentações automáticas e manuais;
7. botão “Novo lançamento” para saída ou ajuste;
8. drill-down por modal/gaveta nos números.

O elemento memorável deve ser a leitura de **entrou / saiu / sobrou**, não uma coleção
de cartões decorativos. Pizza/rosca é adequada para composição curta; barra é melhor
para comparar categorias; linha é melhor para tendência; tabela é a fonte de verdade
operacional.

## Perguntas para fechar o escopo com o dono

1. O V1 começa em caixa realizado ou também mostra previsto/a receber?
2. “Concluído” abre uma etapa de pagamento, ou o pagamento pode acontecer antes?
3. Comissão entra no V1 ou fica como segunda etapa?
4. Produtos entram apenas como resumo financeiro ou também com estoque operacional?
5. Planos/assinaturas já entram no primeiro modelo ou ficam preparados para depois?
6. O dono precisa abrir/fechar caixa por dia e por operador?
7. A comparação padrão de Hoje deve ser ontem ou o mesmo dia da semana anterior?
8. O barbeiro terá visão própria de ganhos ou o Financeiro é exclusivo do dono?
9. Exportação CSV/PDF já é requisito do primeiro corte?
10. Quais formas de pagamento precisam existir desde o início: Pix, dinheiro, débito,
    crédito e outros?
