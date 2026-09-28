// Rodar com: npx tsx lib/fechamento.teste.ts
import assert from "node:assert/strict";
import {
  calcularTotais,
  itensDoCatalogo,
  juntarServicos,
  precoDoCatalogo,
  separarServicos,
  validarFechamento,
} from "./fechamento";

const catalogo = [
  { id: 1, name: "Corte", category: "cabelo", price: "35" },
  { id: 2, name: "Corte + Barba", category: "combos", price: "55" },
  { id: 5, name: "Sobrancelha", category: "outros", price: "R$ 15,00" },
];

// Texto de vários serviços: vírgula separa, "+" é parte do nome do combo.
assert.deepEqual(separarServicos("Corte + Barba, Sobrancelha"), ["Corte + Barba", "Sobrancelha"]);
assert.deepEqual(separarServicos(" Corte ,, "), ["Corte"]);
assert.deepEqual(separarServicos(null), []);
assert.equal(juntarServicos(["Corte + Barba", "Sobrancelha"]), "Corte + Barba, Sobrancelha");

assert.equal(precoDoCatalogo("35"), 35);
assert.equal(precoDoCatalogo("R$ 15,00"), 15);
assert.equal(precoDoCatalogo("1.250,50"), 1250.5);
assert.equal(precoDoCatalogo(undefined), 0);
assert.equal(precoDoCatalogo("sob consulta"), 0);

// Casa por nome sem caixa nem acento; fora da tabela entra com preço 0.
assert.deepEqual(itensDoCatalogo(["corte", "SOBRANCELHA", "Pigmentação"], catalogo as any), [
  { servicoId: 1, nome: "Corte", preco: 35 },
  { servicoId: 5, nome: "Sobrancelha", preco: 15 },
  { nome: "Pigmentação", preco: 0 },
]);

const itens = [
  { nome: "Corte", preco: 35 },
  { nome: "Sobrancelha", preco: 15 },
];
assert.deepEqual(calcularTotais(itens, null), { subtotal: 50, total: 50 });
assert.deepEqual(calcularTotais(itens, { tipo: "acrescimo", valor: 10 }), { subtotal: 50, total: 60 });
assert.deepEqual(calcularTotais(itens, { tipo: "desconto", valor: 0.1 }), { subtotal: 50, total: 49.9 });

assert.deepEqual(validarFechamento({ servicos: itens, ajuste: null }), {});
assert.equal(validarFechamento({ servicos: [], ajuste: null }).servicos, "Selecione pelo menos um serviço.");
assert.equal(
  validarFechamento({ servicos: itens, ajuste: { tipo: "desconto", valor: 60 } }).ajuste,
  "O desconto não pode passar do subtotal.",
);
assert.equal(
  validarFechamento({ servicos: itens, ajuste: { tipo: "acrescimo", valor: 0 } }).ajuste,
  "Informe o valor do ajuste.",
);
assert.equal(
  validarFechamento({ servicos: itens, ajuste: null, cliente: { nome: "Ana", telefone: "1199" } }).telefone,
  "Telefone incompleto.",
);
assert.deepEqual(validarFechamento({ servicos: itens, ajuste: null, cliente: { nome: "", telefone: "" } }), {});
assert.deepEqual(
  validarFechamento({ servicos: itens, ajuste: null, cliente: { nome: "Ana", telefone: "(11) 98888-7777" } }),
  {},
);

console.log("ok");
