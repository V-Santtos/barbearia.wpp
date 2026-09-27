# Fechar atendimento

Data: 2026-09-27. Decidido com o dono, uma pergunta por vez.

## Problema

O cliente muda o pedido na cadeira: agendou só corte e fez bigode e
sobrancelha também. No presencial, ninguém sabe o serviço até o fim. Hoje o
atendimento guarda um único serviço em texto, e o Financeiro acha o preço
procurando esse nome na tabela de serviços. O valor real do atendimento nunca
é conferido.

## Decisões

1. **Resumo em todo "Marcar como feito".** Vale para card agendado e presencial.
   Serve para evitar esquecimento: o barbeiro confere e conclui.
2. **Ajuste de valor com acréscimo e desconto**, motivo opcional.
3. **Preço guardado no dia da conclusão.** Reajuste na tabela não muda o
   passado.
4. **O lápis também permite vários serviços.** A mudança pode ser feita antes;
   o resumo abre com ela.
5. **Produto não entra no resumo.** O ajuste serve só para mudar o preço do
   serviço. Produto vendido na hora vai como entrada manual em "Venda de
   produtos", no Financeiro, separado do corte.

Já feito na mesma rodada: o presencial não se apaga sozinho e nenhum card é
concluído automaticamente. Todo card espera o "Marcar como feito".

## A folha "Fechar atendimento"

Abre ao tocar em "Marcar como feito". De cima para baixo:

- **Cabeçalho:** nome do cliente (no presencial, "Presencial") e barbeiro.
- **Serviços:** tabela de serviços em dois grupos, Combos e Serviços, com
  seleção múltipla e preço ao lado.
  - Agendado: o serviço do agendamento vem marcado. Se o nome não existir mais
    na tabela, ele aparece marcado com o preço que a tabela tinha (ou R$ 0,00
    se nunca teve), para o barbeiro trocar.
  - Presencial: vem vazio.
- **Ajuste de valor** (recolhido por padrão): "+ Acréscimo" ou "− Desconto",
  valor com a máscara de moeda (`components/ui/CurrencyField.tsx`) e motivo
  opcional de até 60 caracteres.
- **Cliente** (só presencial, opcional): nome e telefone.
- **Rodapé:** subtotal, ajuste, total e o botão "Concluir · R$ X".

Validação:

- pelo menos um serviço marcado;
- desconto não pode passar do subtotal (total nunca negativo);
- telefone, se preenchido, completo; nome sem telefone é aceito;
- presencial sem nome conclui como "Cliente presencial".

Celular: folha que sobe do rodapé, como as janelas do Financeiro. Desktop:
modal central.

## O lápis

A seleção de serviço do `EventModal` vira a mesma seleção múltipla da folha,
com o mesmo componente. Adicionar serviço não muda o horário de término.

## Dados

O atendimento ganha:

```ts
interface ServicoDoAtendimento {
  servicoId?: number;   // id da tabela, quando existir
  nome: string;
  preco: number;        // preço do dia, em reais
}

interface FechamentoDoAtendimento {
  servicos: ServicoDoAtendimento[];
  ajuste: { tipo: "acrescimo" | "desconto"; valor: number; motivo?: string } | null;
  total: number;        // soma dos preços ± ajuste
  concluidoEm: string;  // ISO
}
```

- Antes de concluir, a lista escolhida (agendamento ou lápis) viaja no próprio
  `Event.servico`, com os nomes separados por ", " ("Corte, Sobrancelha").
  Vírgula e não " + ", porque nomes de combo já usam "+" ("Corte + Barba").
  As telas que só leem texto continuam funcionando sem mudança.
- Ao concluir, `Event.fechamento` é gravado com os preços daquele momento.
- Presencial com cliente grava nome e telefone no próprio atendimento.

## Contrato para o dev

Uma rota de conclusão substitui o `updateEventStatus(id, "concluido")`:

```
POST /events/:id/concluir
body: { servicos, ajuste, cliente?: { nome, telefone } }
resposta: o evento com status "concluido" e fechamento preenchido
```

O servidor recalcula o total a partir dos itens recebidos e rejeita desconto
maior que o subtotal. Entra em `services/calendarApi.ts` e no adapter em
memória de `services/mock/`, no mesmo padrão das rotas existentes.

## Financeiro

- Atendimento com `fechamento`: o faturamento é `fechamento.total`.
- Atendimento sem `fechamento` (histórico): continua com o preço da tabela,
  como hoje.
- Faturamento por serviço: cada item conta separado; o ajuste entra numa
  linha "Ajustes de atendimento".
- Ticket médio usa o total, ajuste incluído.

## Fora do escopo

- Recalcular duração ao trocar serviço.
- Editar um atendimento depois de concluído.
- Forma de pagamento.

## Verificação

- `npx tsc --noEmit` e `npm run build` em `CALENDARIO/`.
- No mock: concluir agendado sem mudança, com serviço a mais, com desconto;
  concluir presencial com e sem cliente; conferir o total no Financeiro.
