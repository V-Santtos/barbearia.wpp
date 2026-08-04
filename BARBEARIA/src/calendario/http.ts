/**
 * O jeito de falar com a API do calendario. Um so, para consulta e para espelho.
 *
 * Existe separado porque as duas coisas que o bot pede ao calendario tem
 * necessidades identicas — teto de espera, falha que nao lanca, motivo pro log — e
 * duas implementacoes disso divergiriam na primeira vez que uma ganhasse retentativa
 * e a outra nao.
 */

/**
 * O `status` so aparece quando a falha veio COM resposta HTTP — rede caida e timeout
 * nao tem status. Ele existe por um caso unico e importante: o `409` de horario ja
 * ocupado, que nao e falha do sistema e merece frase propria pro cliente. Todo o
 * resto continua sendo "nao consegui", porque distinguir 500 de 502 nao muda nada
 * do que o bot tem a dizer.
 */
export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; motivo: string; status?: number };

/**
 * Teto de espera. A Meta reentrega o webhook se ele demorar, e pendurar num fetch sem
 * limite transformaria "calendario lento" em "bot mudo" — o pior estado possivel,
 * porque o cliente nao tem o que tocar nem o que ler.
 *
 * **8s nao e chute, e medicao.** A API esta em localhost, mas o banco DELA nao: e o
 * Supabase, pela internet. Medido em 2026-07-30 contra o banco real:
 *
 *   primeira chamada do processo  4805ms   (abre a conexao com o Supabase)
 *   chamadas seguintes             755ms / 1004ms
 *
 * Um teto de 4s reprovava justamente a primeira, e o primeiro cliente depois de cada
 * deploy veria "nao consegui abrir a agenda" sem nada estar quebrado.
 *
 * **O gatilho disparou em 2026-08-01, e a conexao foi aquecida.** O teto nao mudou —
 * o que mudou foi o outro lado: o pool do calendario fechava conexao ociosa a cada
 * 10s (padrao do `pg`), entao uma rajada normal — painel do dono fazendo polling +
 * espelho da conversa gravando + o bot perguntando os dias — reabria varias conexoes
 * com o Supabase ao mesmo tempo e as chamadas empilhavam. O `dias-disponiveis`
 * respondeu em 8711ms, o bot desistiu aos 8000ms, e o cliente leu "nao consegui abrir
 * a agenda" com a agenda no ar. Com o pool aquecido (`CALENDARIO/server.js`), a mesma
 * chamada, na mesma rajada, leva ~630ms.
 *
 * ponytail: valor fixo e sem retentativa. Teto: a Meta desiste de esperar o webhook
 * por volta de 15-20s, entao 8s ja e metade do orcamento de uma resposta — e uma
 * retentativa aqui dobraria o pior caso. Gatilho de upgrade: a espera media passar de
 * ~1s de novo, agora com a conexao ja quente; ai a conta e do numero de idas ao banco
 * dentro de cada rota, nao do handshake.
 */
export const ESPERA_MAXIMA_MS = 8000;

export type Pedido = {
  url: string;
  metodo?: 'GET' | 'POST';
  corpo?: unknown;
  token?: string;
};

/**
 * Faz a chamada e traduz TUDO que pode dar errado — rede, timeout, status fora da
 * faixa de sucesso, corpo em formato inesperado — em `{ ok: false }` com motivo pro
 * log. **Nunca lanca**: quem chama esta no meio de atender um cliente, e excecao ali
 * viraria silencio.
 */
export async function pedir<T>(
  pedido: Pedido,
  extrair: (corpo: unknown) => T | undefined,
): Promise<Resultado<T>> {
  let resposta: Response;

  try {
    resposta = await fetch(pedido.url, {
      method: pedido.metodo ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(pedido.corpo === undefined ? {} : { 'content-type': 'application/json' }),
        // O guard do calendario aceita `Authorization: Bearer` ou este cabecalho.
        ...(pedido.token ? { 'x-webhook-token': pedido.token } : {}),
      },
      ...(pedido.corpo === undefined ? {} : { body: JSON.stringify(pedido.corpo) }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : String(erro) };
  }

  if (!resposta.ok) {
    // O corpo do erro costuma trazer a mensagem util do Fastify. Sem ele, depurar
    // 400 e 401 vira adivinhacao.
    const detalhe = await resposta.text().catch(() => '');
    return {
      ok: false,
      motivo: `status ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''}`,
      status: resposta.status,
    };
  }

  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    return { ok: false, motivo: 'corpo nao e JSON' };
  }

  const dados = extrair(corpo);
  if (dados === undefined) {
    return { ok: false, motivo: 'formato inesperado' };
  }

  return { ok: true, dados };
}
