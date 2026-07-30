/**
 * Contrato do id de botao. E a unica coisa que sobrevive a ida e volta pelo
 * WhatsApp, entao ele — e nunca o titulo visivel — decide a rota.
 *
 *   1.agendar
 *   1.hora?b=1&d=2026-08-04&h=13:00
 *   │ │      └── parametros em querystring (URLSearchParams, biblioteca padrao)
 *   │ └───────── acao, minuscula e curta
 *   └─────────── versao do contrato
 *
 * Por que versao na frente: botao que o cliente recebeu ontem continua clicavel
 * amanha. Se o formato mudar, o id antigo se identifica em vez de ser
 * interpretado errado.
 *
 * Por que querystring: nao precisa de parser proprio, e os campos tem NOME —
 * formato posicional (`hora|1|20260804|1300`) quebra em silencio no dia em que
 * alguem troca a ordem.
 *
 * O id NUNCA carrega autorizacao. Ele diz o que o cliente quis, jamais o que ele
 * pode: `b=1` so vira barbeiro 1 depois que o banco confirmar que ele existe e e
 * daquela barbearia.
 */

export const VERSAO_ID = '1';

/** Teto da Meta: 256 no `button_reply`, 200 no `list_reply`. Vale o menor. */
const LIMITE_CARACTERES = 200;

const FORMATO = /^(\d+)\.([a-z][a-z0-9_]*)(?:\?(.*))?$/;

export type IdBotao = {
  versao: string;
  acao: string;
  params: URLSearchParams;
};

export function montarId(acao: string, params?: Record<string, string>): string {
  const consulta = params ? new URLSearchParams(params).toString() : '';
  const id = `${VERSAO_ID}.${acao}` + (consulta ? `?${consulta}` : '');

  // Estourar o limite e erro de programacao, nao de dado: a Meta recusaria a
  // mensagem inteira e o cliente ficaria sem resposta. Melhor quebrar no teste.
  if (id.length > LIMITE_CARACTERES) {
    throw new Error(`id de botao com ${id.length} caracteres, acima do limite de ${LIMITE_CARACTERES}: ${id}`);
  }

  return id;
}

/**
 * Devolve `undefined` para qualquer coisa fora do formato — inclusive os ids do
 * fluxo n8n antigo (`MENU_AGENDAR`), que nao sao herdados. Quem chama decide o
 * que responder; silencio nao e opcao.
 */
export function lerId(id: string): IdBotao | undefined {
  const encontrado = FORMATO.exec(id.trim());
  if (!encontrado) return undefined;

  const [, versao, acao, consulta] = encontrado;
  if (!versao || !acao) return undefined;

  return { versao, acao, params: new URLSearchParams(consulta ?? '') };
}
