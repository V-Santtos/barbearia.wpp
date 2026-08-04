// Onde o cliente desiste. Conta quantas pessoas chegaram em cada passo do
// agendamento e quantas pararam ali.
//
//   npm run funil
//   npm run funil -- --dias 7
//
// Nao e metrica de barbearia, e depuracao do bot: quem faz alguma coisa com a
// resposta somos nos. Por isso e ferramenta de linha de comando e nao painel.
//
// A fonte e `webhook_eventos.acao` — o nome da resposta que o bot mandou, ja
// gravado desde o primeiro dia. Nada foi instrumentado pra isso existir.
import { conectar, alvo } from './conexao.mjs';

const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i === -1 ? padrao : (args[i + 1] ?? padrao);
};

const dias = Number(opcao('--dias', 30));
if (!Number.isFinite(dias) || dias <= 0) {
  console.error('uso: npm run funil -- [--dias N]');
  process.exit(1);
}

/**
 * A escada, em ordem de progresso. O que conta e o degrau MAIS ALTO que a pessoa
 * alcancou, nunca a soma dos degraus — com um barbeiro ativo so, `agendar` pula
 * direto pros dias, e exigir a passagem por `escolher_barbeiro` faria o pulo
 * parecer desistencia.
 */
const ESCADA = [
  { resposta: 'menu_principal', rotulo: 'viu o menu' },
  { resposta: 'escolher_barbeiro', rotulo: 'tocou em Agendar' },
  { resposta: 'escolher_dia', rotulo: 'escolheu o barbeiro' },
  { resposta: 'escolher_horario', rotulo: 'escolheu o dia' },
  { resposta: 'pedir_nome', rotulo: 'escolheu o horario' },
  { resposta: 'conferir_nome', rotulo: 'mandou o nome' },
  { resposta: 'agendado', rotulo: 'CONFIRMOU' },
];

/**
 * Becos: respostas que explicam uma parada sem que ela seja escolha do cliente.
 * Sem isso, "sumiu no passo do dia" e uma frase que acusa o cliente de algo que
 * pode ter sido culpa nossa (agenda fora do ar) ou da agenda cheia.
 */
const BECOS = [
  { resposta: 'agenda_fora_do_ar', rotulo: 'a agenda nao respondeu (nosso)' },
  { resposta: 'agenda_indisponivel', rotulo: 'nenhum barbeiro ativo' },
  { resposta: 'sem_dia_disponivel', rotulo: 'barbeiro sem dia livre' },
  { resposta: 'sem_horario_no_dia', rotulo: 'dia sem horario livre' },
  { resposta: 'horario_ocupado', rotulo: 'horario pego no meio do caminho' },
  { resposta: 'nome_invalido', rotulo: 'nome recusado' },
  { resposta: 'feedback', rotulo: 'digitou fora do trilho' },
  { resposta: 'menu_reforcado', rotulo: 'digitou de novo, menu reforcado' },
];

// ponytail: le o periodo inteiro pra memoria e agrupa em JS. Teto: uma barbearia
// em teste, onde o dia todo cabe em dezenas de linhas. Gatilho de upgrade: a
// consulta passar de alguns milhares de linhas — ai o agrupamento desce pro SQL.
const cliente = await conectar();
const { rows } = await cliente.query(
  `select de, acao
     from webhook_eventos
    where recebido_em >= now() - ($1 || ' days')::interval
    order by id`,
  [String(dias)],
);
await cliente.end();

const porPessoa = new Map();
for (const linha of rows) {
  const atual = porPessoa.get(linha.de) ?? { degrau: -1, becos: new Set() };
  for (const resposta of linha.acao ?? []) {
    const degrau = ESCADA.findIndex((passo) => passo.resposta === resposta);
    if (degrau > atual.degrau) atual.degrau = degrau;
    if (BECOS.some((beco) => beco.resposta === resposta)) atual.becos.add(resposta);
  }
  porPessoa.set(linha.de, atual);
}

const pessoas = [...porPessoa.values()];
const chegaram = (degrau) => pessoas.filter((p) => p.degrau >= degrau).length;
const pararam = (degrau) => pessoas.filter((p) => p.degrau === degrau).length;

const out = [
  `-- alvo: ${alvo()}`,
  `-- janela: ultimos ${dias} dia(s)`,
  '',
  `${pessoas.length} pessoa(s) falaram com o bot.`,
  '',
];

if (pessoas.length === 0) {
  out.push('Nada no periodo. Sem conversa nao ha funil.');
  console.log(out.join('\n'));
  process.exit(0);
}

const base = chegaram(0) || 1;
const largura = Math.max(...ESCADA.map((p) => p.rotulo.length));

for (const [degrau, passo] of ESCADA.entries()) {
  const total = chegaram(degrau);
  const parou = pararam(degrau);
  const fatia = Math.round((total / base) * 100);
  const barra = '█'.repeat(Math.round(fatia / 5)).padEnd(20);
  const perdeu = parou > 0 && degrau < ESCADA.length - 1 ? `   <- ${parou} pararam aqui` : '';
  out.push(`${passo.rotulo.padEnd(largura)}  ${barra} ${String(total).padStart(4)}  ${String(fatia).padStart(3)}%${perdeu}`);
}

const becosVistos = BECOS.map((beco) => ({
  ...beco,
  quantas: pessoas.filter((p) => p.becos.has(beco.resposta)).length,
})).filter((beco) => beco.quantas > 0);

if (becosVistos.length > 0) {
  out.push('', 'Becos no caminho (nem toda parada e escolha do cliente):');
  for (const beco of becosVistos) out.push(`  ${String(beco.quantas).padStart(4)}  ${beco.rotulo}`);
}

const fechou = chegaram(ESCADA.length - 1);
out.push('', `${fechou} de ${pessoas.length} fecharam agendamento (${Math.round((fechou / base) * 100)}%).`);

console.log(out.join('\n'));
