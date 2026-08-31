// Aplica as migracoes de db/migracoes/ que ainda nao rodaram neste banco.
//
//   npm run db:migrar              -> ensaio: executa de verdade e da ROLLBACK (valida o SQL)
//
// O ensaio roda as pendentes numa TRANSACAO SO, revertida no fim. Tem que ser assim:
// com uma transacao por migracao, a terceira nao enxergaria a tabela que a primeira
// criou (ja revertida) e acusaria erro que nao existe — foi o que apareceu ao validar
// a reconstrucao do banco em 08/2026. Ja o modo --gravar mantem uma transacao POR
// migracao de proposito: se a terceira falhar, as duas primeiras ficam aplicadas.
//   npm run db:migrar -- --gravar  -> aplica e registra
//   npm run db:migrar -- --lista   -> so mostra o que esta aplicado e o que falta
//
// O historico fica em supabase_migrations.schema_migrations, a mesma tabela que o CLI do
// Supabase usa — para nao existirem duas verdades sobre o que foi aplicado.
// Cada migracao roda numa transacao propria: se a terceira falhar, as duas primeiras ficam.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { conectar, alvo } from './conexao.mjs';

const PASTA = join(dirname(dirname(fileURLToPath(import.meta.url))), 'db', 'migracoes');
const PADRAO = /^(\d{14})_([a-z0-9_]+)\.sql$/;

const args = process.argv.slice(2);
const gravar = args.includes('--gravar');
const soLista = args.includes('--lista');

const arquivos = readdirSync(PASTA)
  .filter((n) => n.endsWith('.sql'))
  .sort();

const invalidos = arquivos.filter((n) => !PADRAO.test(n));
if (invalidos.length) {
  console.error('nome fora do padrao AAAAMMDDHHMMSS_nome_em_snake_case.sql:', invalidos.join(', '));
  process.exit(1);
}

const cliente = await conectar();
console.log(`alvo: ${alvo()}`);

// Banco novo nao tem esta tabela, e sem ela a consulta abaixo derruba a ferramenta
// antes de aplicar a primeira migracao — foi o que travou a reconstrucao de 08/2026.
// No Supabase ela nasce com o CLI; num Postgres comum (container, Neon, RDS) nunca
// existe. Criar aqui e `if not exists`: onde ela ja esta, isto nao faz nada, e o
// formato e o mesmo que o CLI do Supabase usa, pra continuar havendo uma verdade so.
await cliente.query('create schema if not exists supabase_migrations');
await cliente.query(`create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  name       text,
  statements text[]
)`);

const aplicadas = new Set(
  (await cliente.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version),
);
const pendentes = arquivos.filter((n) => !aplicadas.has(n.match(PADRAO)[1]));

console.log(`${aplicadas.size} migracao(oes) ja aplicada(s) no banco, ${arquivos.length} arquivo(s) aqui, ${pendentes.length} pendente(s).`);
if (!pendentes.length || soLista) {
  for (const n of pendentes) console.log(`  pendente: ${n}`);
  await cliente.end();
  process.exit(0);
}

console.log(gravar ? 'modo GRAVAR — vai efetivar.' : 'modo ensaio — cada migracao roda e sofre ROLLBACK. Use --gravar para efetivar.');

let falhou = false;

// Uma transacao para o ensaio inteiro (ver cabecalho); no --gravar, uma por migracao.
if (!gravar) await cliente.query('begin');

for (const nome of pendentes) {
  const [, versao, titulo] = nome.match(PADRAO);
  const sql = readFileSync(join(PASTA, nome), 'utf8');
  process.stdout.write(`\n[${versao}] ${titulo} ... `);
  try {
    if (gravar) await cliente.query('begin');
    await cliente.query(sql);
    await cliente.query(
      'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
      [versao, titulo, [sql]],
    );
    if (gravar) await cliente.query('commit');
    console.log(gravar ? 'APLICADA' : 'ok');
  } catch (e) {
    await cliente.query('rollback').catch(() => {});
    console.log(`FALHOU\n  ERRO ${e.code ?? ''}: ${e.message}`);
    if (e.detail) console.log(`  detalhe: ${e.detail}`);
    if (e.hint) console.log(`  dica: ${e.hint}`);
    falhou = true;
    break; // ordem importa: nao pular por cima de uma migracao quebrada
  }
}

if (!gravar && !falhou) {
  await cliente.query('rollback');
  console.log('\nensaio: as ' + pendentes.length + ' migracao(oes) rodaram e foram revertidas. Nada mudou no banco.');
  console.log('Use --gravar para efetivar.');
}

await cliente.end();
process.exit(falhou ? 1 : 0);
