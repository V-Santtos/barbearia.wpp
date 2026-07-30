// Conexao direta com o Postgres do Supabase, compartilhada pelas ferramentas.
// Le DATABASE_URL do ambiente (npm run db passa --env-file=.env) e, se nao houver,
// do proprio .env ao lado do package.json. Nunca imprime a senha.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const raizProjeto = dirname(dirname(fileURLToPath(import.meta.url)));

export function urlDoBanco() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const linha = readFileSync(join(raizProjeto, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='));
    if (linha) return linha.slice('DATABASE_URL='.length).trim();
  } catch {
    /* sem .env: cai no erro abaixo */
  }
  throw new Error('DATABASE_URL nao encontrada (nem no ambiente, nem em BARBEARIA/.env)');
}

/** Identifica o alvo sem expor credencial: host + database. */
export function alvo(url = urlDoBanco()) {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`;
}

export async function conectar() {
  // ponytail: Client unico (sem Pool), porque as ferramentas sao processos de vida curta.
  // Gatilho de upgrade: quando o codigo do app (nao a ferramenta) falar com o banco.
  const cliente = new pg.Client({
    connectionString: urlDoBanco(),
    ssl: { rejectUnauthorized: false },
  });
  await cliente.connect();
  return cliente;
}
