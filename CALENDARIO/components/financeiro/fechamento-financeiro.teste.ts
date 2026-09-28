// Rodar com: npx tsx components/financeiro/fechamento-financeiro.teste.ts
import assert from "node:assert/strict";
import {
  comporFaturamentoPorServico,
  converterEventosEmReceitas,
  somarAjustesDeAtendimento,
} from "./modelo";

const profissionais = [{ id: 1, name: "Lucas Costa", color: "#fff" }];
const catalogo = [{ id: 1, name: "Corte", category: "cabelo", price: "40" }];

const comFechamento = {
  id: 10,
  title: "Ana",
  date: "2026-09-20",
  startTime: "10:00",
  endTime: "10:40",
  professionalId: 1,
  status: "concluido",
  servico: "Corte, Sobrancelha",
  fechamento: {
    servicos: [
      { servicoId: 1, nome: "Corte", preco: 35 },
      { servicoId: 5, nome: "Sobrancelha", preco: 15 },
    ],
    ajuste: { tipo: "desconto" as const, valor: 5, motivo: "Cliente fiel" },
    total: 45,
    concluidoEm: "2026-09-20T10:40:00.000Z",
  },
};

// Histórico sem fechamento: continua com o preço da tabela.
const semFechamento = { ...comFechamento, id: 11, servico: "Corte", fechamento: null };

const receitas = converterEventosEmReceitas(
  [comFechamento, semFechamento] as any,
  profissionais as any,
  catalogo as any,
);

const r10 = receitas.find((r) => r.atendimento?.atendimentoId === 10)!;
const r11 = receitas.find((r) => r.atendimento?.atendimentoId === 11)!;
assert.equal(r10.valor, 45, "usa o total do fechamento");
assert.equal(r10.atendimento?.origemPreco, "fechamento");
assert.equal(r11.valor, 40, "sem fechamento, preço da tabela de hoje");

// O preço da tabela mudou para 40, mas o corte fechado continua valendo 35.
const composicao = comporFaturamentoPorServico([r10]);
const porNome = Object.fromEntries(composicao.map((c) => [c.nome, c.valor]));
assert.deepEqual(porNome, { Corte: 35, Sobrancelha: 15 });
assert.equal(somarAjustesDeAtendimento(receitas), -5);

console.log("ok");
