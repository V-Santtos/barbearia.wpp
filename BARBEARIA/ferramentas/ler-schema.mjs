// Leitura completa do schema public: tabelas, colunas, chaves, índices, RLS, contagem.
// Uso: npm run db:schema -- [arquivo-de-saida.md]   (default: schema-atual.md)
import { writeFileSync } from 'node:fs';
import { conectar } from './conexao.mjs';

const destino = process.argv[2] ?? 'schema-atual.md';
const c = await conectar();

const out = [];
const p = (s = '') => out.push(s);

// tabelas + RLS + contagem
const tabelas = (
  await c.query(`
  select c.relname as tabela, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forced,
         obj_description(c.oid) as comentario
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`)
).rows;

p('# Schema public — ' + tabelas.length + ' tabelas');
p('');

for (const t of tabelas) {
  const cnt = (await c.query(`select count(*)::int as n from public."${t.tabela}"`)).rows[0].n;
  p(`\n## ${t.tabela}  (${cnt} linhas)  RLS: ${t.rls ? 'ATIVADO' : 'DESATIVADO'}`);
  if (t.comentario) p(`> ${t.comentario}`);

  const cols = (
    await c.query(
      `select column_name, data_type, udt_name, is_nullable, column_default,
              character_maximum_length, numeric_precision
       from information_schema.columns
       where table_schema='public' and table_name=$1
       order by ordinal_position`,
      [t.tabela],
    )
  ).rows;

  p('');
  p('| coluna | tipo | nulo? | default |');
  p('|---|---|---|---|');
  for (const col of cols) {
    let tipo = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
    if (col.character_maximum_length) tipo += `(${col.character_maximum_length})`;
    const def = col.column_default ? String(col.column_default).slice(0, 60) : '';
    p(`| ${col.column_name} | ${tipo} | ${col.is_nullable === 'YES' ? 'sim' : 'NAO'} | ${def} |`);
  }

  // constraints
  const cons = (
    await c.query(
      `select con.conname, pg_get_constraintdef(con.oid) as def, con.contype
       from pg_constraint con
       join pg_class cl on cl.oid = con.conrelid
       join pg_namespace n on n.oid = cl.relnamespace
       where n.nspname='public' and cl.relname=$1
       order by con.contype, con.conname`,
      [t.tabela],
    )
  ).rows;
  if (cons.length) {
    p('');
    p('constraints:');
    for (const k of cons) p(`  - [${k.contype}] ${k.conname}: ${k.def}`);
  }

  // indices
  const idx = (await c.query(`select indexname, indexdef from pg_indexes where schemaname='public' and tablename=$1`, [t.tabela])).rows;
  if (idx.length) {
    p('');
    p('indices:');
    for (const i of idx) p(`  - ${i.indexdef.replace('CREATE ', '')}`);
  }

  // politicas RLS
  const pol = (
    await c.query(
      `select policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename=$1`,
      [t.tabela],
    )
  ).rows;
  if (pol.length) {
    p('');
    p('politicas RLS:');
    for (const x of pol) p(`  - ${x.policyname} [${x.cmd}] roles=${x.roles} using=${x.qual} check=${x.with_check}`);
  } else if (t.rls) {
    p('');
    p('  ⚠ RLS ativado mas SEM politicas (nega tudo)');
  }
}

// views, funcoes, triggers, enums
const views = (await c.query(`select table_name from information_schema.views where table_schema='public' order by 1`)).rows;
p('\n\n# Views: ' + (views.map((v) => v.table_name).join(', ') || 'nenhuma'));

const fns = (
  await c.query(`select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer
                 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`)
).rows;
p('\n# Funcoes em public: ' + (fns.length || 'nenhuma'));
for (const fn of fns) p(`  - ${fn.proname}(${fn.args})${fn.security_definer ? '  [SECURITY DEFINER]' : ''}`);

const trg = (
  await c.query(`select c.relname as tabela, t.tgname, pg_get_triggerdef(t.oid) as def
                 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and not t.tgisinternal order by 1,2`)
).rows;
p('\n# Triggers: ' + (trg.length || 'nenhum'));
for (const g of trg) p(`  - ${g.tabela}.${g.tgname}`);

const enums = (
  await c.query(`select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as valores
                 from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' group by t.typname order by 1`)
).rows;
p('\n# Enums: ' + (enums.length || 'nenhum'));
for (const e of enums) p(`  - ${e.typname}: ${e.valores}`);

await c.end();
writeFileSync(destino, out.join('\n'), 'utf8');
console.log('ok —', out.length, 'linhas escritas em', destino);
