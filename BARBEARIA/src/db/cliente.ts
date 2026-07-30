import pg from 'pg';

/**
 * Pool unico do processo. Nao e o pooler transacional do Supabase (porta 6543) —
 * e a conexao direta, a mesma que as ferramentas de `ferramentas/` usam.
 *
 * ponytail: conexao direta com pool pequeno. Teto: um processo local ou uma
 * funcao serverless de baixa concorrencia. Gatilho de upgrade: quando subir na
 * Vercel de verdade, trocar pelo pooler transacional (6543) — conexao direta nao
 * aguenta uma funcao por requisicao.
 */
let pool: pg.Pool | undefined;

export function obterPool(url: string): pg.Pool {
  pool ??= new pg.Pool({
    connectionString: url,
    // O certificado do Supabase vem de uma CA que o Node nao carrega por padrao.
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

export async function encerrarPool(): Promise<void> {
  const atual = pool;
  pool = undefined;
  await atual?.end();
}
