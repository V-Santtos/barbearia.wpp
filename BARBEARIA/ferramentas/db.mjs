// Roda SQL avulso no banco e mostra o resultado. Ferramenta de trabalho do dia a dia.
//
//   npm run db -- "select count(*) from agendamentos"
//   npm run db -- -f consulta.sql --out resultado.md
//   npm run db -- "update servicos set preco = 50 where id = 1" --gravar
//
// Por padrao roda dentro de uma transacao que sofre ROLLBACK no fim: da pra ver quantas
// linhas UM update/DDL afetaria sem efetivar nada. So com --gravar ha COMMIT.
import { readFileSync, writeFileSync } from 'node:fs';
import { conectar, alvo } from './conexao.mjs';

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  if (i === -1) return null;
  return args.splice(i, 2)[1] ?? '';
};
const flag = (nome) => {
  const i = args.indexOf(nome);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const arquivoSql = opcao('-f');
const saida = opcao('--out');
const gravar = flag('--gravar');
const tudo = flag('--tudo');
const comoJson = flag('--json');
const sql = arquivoSql ? readFileSync(arquivoSql, 'utf8') : args.join(' ');

if (!sql.trim()) {
  console.error('uso: npm run db -- "<sql>" | -f arquivo.sql   [--gravar] [--out arq] [--json] [--tudo]');
  process.exit(1);
}

const LIMITE_LINHAS = tudo ? Infinity : 50;
const LARGURA_CELULA = 60;

const texto = (v) => {
  if (v === null) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function tabela(linhas) {
  const colunas = Object.keys(linhas[0]);
  const corta = (s) => (s.length > LARGURA_CELULA ? s.slice(0, LARGURA_CELULA - 1) + '…' : s);
  const celulas = linhas.map((l) => colunas.map((c) => corta(texto(l[c]))));
  const largura = colunas.map((c, i) => Math.max(c.length, ...celulas.map((l) => l[i].length)));
  const linha = (vals) => '| ' + vals.map((v, i) => v.padEnd(largura[i])).join(' | ') + ' |';
  return [
    linha(colunas),
    '|' + largura.map((w) => '-'.repeat(w + 2)).join('|') + '|',
    ...celulas.map(linha),
  ].join('\n');
}

const cliente = await conectar();
const out = [`-- alvo: ${alvo()}`, `-- modo: ${gravar ? 'GRAVANDO (commit)' : 'ensaio (rollback no fim)'}`, ''];

let erro = null;
try {
  await cliente.query('begin');
  const resultados = [].concat(await cliente.query(sql));
  for (const r of resultados) {
    if (r.rows?.length) {
      out.push(`${r.command} — ${r.rows.length} linha(s)${r.rows.length > LIMITE_LINHAS ? ` (mostrando ${LIMITE_LINHAS}, use --tudo)` : ''}`);
      const mostrar = r.rows.slice(0, LIMITE_LINHAS);
      out.push(comoJson ? JSON.stringify(mostrar, null, 1) : tabela(mostrar));
    } else {
      out.push(`${r.command} — ${r.rowCount ?? 0} linha(s) afetada(s)`);
    }
    out.push('');
  }
  await cliente.query(gravar ? 'commit' : 'rollback');
  if (!gravar) out.push('(ROLLBACK aplicado — nada foi gravado. Repita com --gravar para efetivar.)');
} catch (e) {
  await cliente.query('rollback').catch(() => {});
  erro = e;
  out.push(`ERRO ${e.code ?? ''}: ${e.message}`);
  if (e.detail) out.push(`detalhe: ${e.detail}`);
  if (e.hint) out.push(`dica: ${e.hint}`);
} finally {
  await cliente.end();
}

const relatorio = out.join('\n');
if (saida) {
  writeFileSync(saida, relatorio, 'utf8');
  console.log(`escrito em ${saida} (${relatorio.split('\n').length} linhas)`);
} else {
  console.log(relatorio);
}
process.exit(erro ? 1 : 0);
