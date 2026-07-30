import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIXO = 'sha256=';

/**
 * Valida o cabecalho `X-Hub-Signature-256` que a Meta manda em todo POST de
 * webhook: HMAC-SHA256 do corpo BRUTO da requisicao usando o app secret.
 *
 * O corpo tem que ser exatamente os bytes recebidos. Se voce fizer
 * `JSON.stringify(await c.req.json())` a assinatura nunca vai bater, porque a
 * re-serializacao muda espacos e ordem de chaves.
 */
export function verificarAssinatura(
  corpoBruto: string,
  cabecalho: string | undefined,
  appSecret: string,
): boolean {
  if (!cabecalho || !cabecalho.startsWith(PREFIXO)) return false;

  const recebida = Buffer.from(cabecalho.slice(PREFIXO.length), 'hex');
  const esperada = createHmac('sha256', appSecret).update(corpoBruto, 'utf8').digest();

  // timingSafeEqual estoura se os tamanhos diferem, e hex invalido produz um
  // buffer curto — o guard cobre os dois casos.
  if (recebida.length !== esperada.length) return false;

  return timingSafeEqual(recebida, esperada);
}

/**
 * Comparacao de string em tempo constante, usada no `hub.verify_token` do
 * handshake. Um `===` ali vaza o token byte a byte por timing; e barato
 * fechar isso.
 */
export function compararSegredos(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
