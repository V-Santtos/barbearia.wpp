import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const url = readFileSync('C:/Users/victo/Desktop/SAAS-BARBEARIA/BARBEARIA/.env', 'utf8')
  .split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice(13).trim();

const require = createRequire(import.meta.url);
const pg = require('pg');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const out = [];
const p = (s = '') => out.push(s);
const q = async (label, sql) => {
  p(`\n### ${label}`);
  try {
    const r = await c.query(sql);
    p('```json');
    p(JSON.stringify(r.rows, null, 1));
    p('```');
  } catch (e) {
    p('ERRO: ' + e.message);
  }
};

await q('profissionais', 'select * from profissionais order by id');
await q('agenda_profissional', 'select * from agenda_profissional order by profissional_id');
await q('dias_bloqueados', 'select * from dias_bloqueados order by data');
await q('categorias_servicos', 'select * from categorias_servicos order by ordem');
await q('servicos', 'select id, slug, nome, descricao, preco, categoria_id, ativo, ordem from servicos order by ordem, id');
await q('configuracao', 'select * from configuracao order by chave');
await q('documentos_bot', 'select * from documentos_bot');
await q('agendamentos (todos)', 'select * from agendamentos order by dia_marcado desc, hora_marcada desc');
await q('agendamentos: valores de status', "select status, count(*)::int as n from agendamentos group by status order by n desc");
await q('agendamentos: valores de source', "select source, count(*)::int as n from agendamentos group by source order by n desc");
await q('agendamentos: valores de profissional', "select profissional, count(*)::int as n from agendamentos group by profissional");
await q('agendamentos: valores de servico', "select servico, count(*)::int as n from agendamentos group by servico");
await q('dados_cliente: valores de fluxo', 'select fluxo, etapa, count(*)::int as n from dados_cliente group by fluxo, etapa order by n desc');
await q('dados_cliente: amostra de estrutura (telefone mascarado)', `select id, created_at, left(telefone, 6) || '***' as telefone_mask, nomewpp, fluxo, etapa, atendimento_temporario, data_hora, barbeiro_id, atendimento_ia from dados_cliente order by id desc limit 6`);
await q('dados_cliente: formato de data_hora', 'select distinct jsonb_typeof(data_hora) as tipo, count(*)::int as n from dados_cliente group by 1');
await q('whatsapp_contacts: amostra', `select id, left(phone,6)||'***' as phone_mask, left(coalesce(wa_id,''),6)||'***' as wa_id_mask, name, last_message_at, service_window_until from whatsapp_contacts order by id limit 5`);
await q('whatsapp_conversations: status', 'select status, assigned_to, count(*)::int as n from whatsapp_conversations group by status, assigned_to');
await q('whatsapp_messages: direction x sender_type x message_type', 'select direction, sender_type, message_type, count(*)::int as n from whatsapp_messages group by 1,2,3 order by n desc');
await q('whatsapp_messages: amostra de raw_payload (1 inbound)', `select message_type, body, raw_payload from whatsapp_messages where direction='inbound' order by id desc limit 1`);
await q('whatsapp_messages: intervalo de datas', 'select min(created_at) as primeira, max(created_at) as ultima from whatsapp_messages');
await q('funcao rls_auto_enable', "select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable'");
await q('funcao set_updated_at', "select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_updated_at'");
await q('event triggers (fora de public)', "select evtname, evtevent, p.proname from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid");
await q('sequences / identity', `select c.relname as tabela, a.attname as coluna, a.attidentity, pg_get_serial_sequence('public.'||c.relname, a.attname) as seq from pg_class c join pg_attribute a on a.attrelid=c.oid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (a.attidentity <> '' or pg_get_serial_sequence('public.'||c.relname, a.attname) is not null) order by 1,2`);
await q('extensoes instaladas', 'select extname, extversion from pg_extension order by extname');
await q('schemas existentes', "select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by 1");
await q('storage buckets', 'select id, name, public, created_at from storage.buckets order by name');
await q('storage: objetos por bucket', 'select bucket_id, count(*)::int as n from storage.objects group by 1');
await q('auth.users (contagem)', 'select count(*)::int as n from auth.users');

await c.end();
writeFileSync(process.argv[2], out.join('\n'), 'utf8');
console.log('ok', out.length, 'linhas');
