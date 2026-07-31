/**
 * O jeito de falar com a API do calendario. Um so, para consulta e para espelho.
 *
 * Existe separado porque as duas coisas que o bot pede ao calendario tem
 * necessidades identicas — teto de espera, falha que nao lanca, motivo pro log — e
 * duas implementacoes disso divergiriam na primeira vez que uma ganhasse retentativa
 * e a outra nao.
 */

export type Resultado<T> = { ok: true; dados: T } | { ok: false; motivo: string };

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
 * ponytail: valor fixo, sem retentativa e sem conexao aquecida. Teto: a Meta desiste
 * de esperar o webhook por volta de 15-20s, entao 8s ja e metade do orcamento de uma
 * resposta. Gatilho de upgrade: a espera media passar de ~1s, ou aparecer uma segunda
 * consulta na mesma resposta — ai o caminho e aquecer a conexao do calendario, nao
 * aumentar o teto de novo.
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
    return { ok: false, motivo: `status ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''}` };
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
