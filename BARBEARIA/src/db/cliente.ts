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

/**
 * `idleTimeoutMillis: 0` — conexao aberta NUNCA e fechada por ociosidade.
 *
 * O padrao do `pg` e 10s, e ele custava caro aqui: entre dois toques do cliente
 * passam mais de 10s com folga, entao a conexao morria no intervalo e a mensagem
 * seguinte pagava um handshake TLS novo com o Supabase — que fica na internet, nao
 * no localhost. Medido em 2026-08-01: ~4,8s so pra reabrir, e a resposta inteira
 * levava 7-9s onde a Meta espera 15-20s antes de reentregar o webhook.
 *
 * O banco topa: `idle_session_timeout` do Supabase e 0 (nunca derruba sessao
 * parada) e `max_connections` e 60 — cinco conexoes vivas aqui nao apertam nada.
 * `keepAlive` mantem o TCP de pe contra NAT e roteador no meio do caminho.
 */
export function obterPool(url: string): pg.Pool {
  pool ??= new pg.Pool({
    connectionString: url,
    // O certificado do Supabase vem de uma CA que o Node nao carrega por padrao.
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 0,
    keepAlive: true,
  });

  return pool;
}

/**
 * Abre as conexoes na subida, e nao no primeiro cliente que mandar mensagem.
 *
 * Sem isso o `idleTimeoutMillis: 0` so adiaria o problema: a primeira conversa
 * depois de cada restart continuaria pagando o handshake. Como sao abertas em
 * paralelo, o custo e de uma so.
 *
 * Falha nao derruba o servico: sem banco o bot nao serve pra nada de qualquer
 * jeito, e a mensagem de erro real aparece melhor no primeiro webhook do que numa
 * subida que morreu sem explicacao.
 */
export async function aquecerPool(pool: pg.Pool, quantidade = 2): Promise<number> {
  const conexoes = await Promise.allSettled(
    Array.from({ length: quantidade }, async () => {
      const cliente = await pool.connect();
      try {
        await cliente.query('select 1');
      } finally {
        cliente.release();
      }
    }),
  );

  return conexoes.filter((resultado) => resultado.status === 'fulfilled').length;
}

export async function encerrarPool(): Promise<void> {
  const atual = pool;
  pool = undefined;
  await atual?.end();
}
