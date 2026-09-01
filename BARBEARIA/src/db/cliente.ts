import pg from 'pg';

/**
 * Pool unico do processo. Nao e o pooler transacional do Supabase (porta 6543) —
 * e a conexao direta, a mesma que as ferramentas de `ferramentas/` usam.
 *
 * GATILHO DISPARADO em 2026-08-28: o bot subiu na Vercel. O que este comentario
 * pedia — trocar pelo pooler transacional (6543) — passa a ser CONFIGURACAO, nao
 * codigo: e a `DATABASE_URL` do painel do Vercel que tem que apontar pro pooler.
 * Nao e preferencia: `db.<ref>.supabase.co` so tem registro AAAA (IPv6 puro), e
 * funcao serverless nao alcanca. Foi esse o defeito de 05/08.
 *
 * O que muda no codigo e o TAMANHO do pool — ver `EM_SERVERLESS` abaixo.
 */
let pool: pg.Pool | undefined;

/**
 * Fora de serverless existe UM processo, e manter conexao de pe e o certo (ver
 * abaixo). Em serverless nao existe "o processo": existem N instancias que a
 * plataforma cria e mata sozinha, e cinco conexoes eternas vezes N estoura o teto
 * de 60 do Supabase. Quem cai junto e o painel, que bebe do mesmo banco — o bot
 * derrubaria o dono junto com ele.
 *
 * Mesmo raciocinio, e mesma solucao, que `CALENDARIO/server.js` ja aplicava: sob
 * VERCEL o pool encolhe e volta a soltar conexao ociosa.
 */
const EM_SERVERLESS = Boolean(process.env.VERCEL);

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
    max: EM_SERVERLESS ? 2 : 5,
    idleTimeoutMillis: EM_SERVERLESS ? 10_000 : 0,
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
