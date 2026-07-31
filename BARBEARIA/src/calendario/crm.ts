import type { Acao } from '../fluxo/acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { pedir, type Resultado } from './http.js';

/**
 * O espelho das conversas no painel do dono (`POST /whatsapp/events`).
 *
 * O painel tem uma aba de WhatsApp que existia para o fluxo n8n: os nos `Saida #N`
 * mandavam uma copia de cada mensagem pra ca. Morreram com o fluxo, e sem eles o dono
 * ve o agendamento aparecer na agenda sem nunca ver a conversa que o produziu.
 *
 * **Isto nunca pode atrasar nem derrubar a resposta ao cliente.** O painel ficar
 * alguns segundos atras e chato; o cliente esperar por causa do painel e inaceitavel.
 * Por isso o espelho roda depois do envio e toda falha vira log.
 */

export type Espelho = {
  /** A mensagem do cliente. */
  entrada: (evento: EventoRecebido, nome: string | undefined) => Promise<Resultado<unknown>>;
  /** Uma resposta do bot que REALMENTE saiu, com o id que a Meta devolveu. */
  saida: (acao: Acao, wamid: string | undefined) => Promise<Resultado<unknown>>;
};

export function criarEspelho(base: string, token: string): Espelho {
  const url = `${base}/whatsapp/events`;

  return {
    entrada: (evento, nome) =>
      enviar(url, token, {
        direction: 'inbound',
        sender_type: 'customer',
        phone: evento.de,
        wa_id: evento.de,
        // Cadastro primeiro, perfil do WhatsApp como reserva. Decisao do dono do
        // produto: o painel nunca mostrar so um numero. Isto NAO afrouxa a regra de
        // 2026-07-30 — o bot continua chamando pelo nome so quem se apresentou a ele.
        // Aqui o nome e para o dono LER, nunca para o bot dizer.
        name: nome ?? evento.nome,
        type: tipoDaEntrada(evento),
        body: corpoDaEntrada(evento),
        whatsapp_message_id: evento.wamid,
        timestamp: evento.recebidoEm.toISOString(),
        raw_payload: evento.cru ?? {},
      }),

    saida: (acao, wamid) =>
      enviar(url, token, {
        direction: 'outbound',
        sender_type: 'bot',
        phone: acao.para,
        wa_id: acao.para,
        type: acao.tipo === 'enviar_texto' ? 'text' : 'interactive',
        body: renderizar(acao),
        // Sem id estavel, repetir a chamada duplicaria a mensagem do bot no painel e
        // a conversa apareceria gaguejando pro dono. O `ON CONFLICT` do endpoint so
        // funciona se este campo vier.
        whatsapp_message_id: wamid,
        timestamp: new Date().toISOString(),
        raw_payload: { resposta: acao.resposta, tipo: acao.tipo },
      }),
  };
}

function enviar(url: string, token: string, corpo: unknown): Promise<Resultado<unknown>> {
  // O endpoint devolve 201 com `{ contact, conversation, message }`. Nao usamos nada
  // disso — basta ter sido aceito —, entao qualquer objeto serve como sucesso.
  return pedir({ url, metodo: 'POST', corpo, token }, (resposta) => resposta ?? {});
}

/**
 * A mensagem do bot como o dono vai ler no painel.
 *
 * Sai da PROPRIA acao enviada, e isso e o ponto. No n8n o espelho era uma parafrase
 * escrita a mao, num no separado: o painel dizia `"Qual dia voce prefere? para o
 * agendamento"` enquanto o WhatsApp dizia `"*Qual dia voce prefere?*"`. Duas verdades
 * pra mesma frase, e a errada era a que o dono lia.
 */
export function renderizar(acao: Acao): string {
  if (acao.tipo === 'enviar_texto') return acao.texto;

  const linhas = [acao.cabecalho, acao.texto].filter((linha): linha is string => Boolean(linha));
  const opcoes = acao.opcoes.map((opcao) => `▸ ${opcao.titulo}`);

  return [linhas.join('\n'), opcoes.join('\n')].filter(Boolean).join('\n\n');
}

/**
 * Um toque em botao vira o rotulo que o cliente viu, com o id atras. O titulo pode
 * nao vir (a Meta manda so em algumas formas), e ai o id sozinho ja diz o que ele
 * escolheu — quem le o painel precisa entender a conversa, nao depurar o bot.
 */
function corpoDaEntrada(evento: EventoRecebido): string {
  if (evento.tipo === 'texto') return evento.texto;
  if (evento.tipo === 'botao') {
    return evento.titulo ? `${evento.titulo}  (${evento.botaoId})` : evento.botaoId;
  }

  return `[${evento.formato}]`;
}

function tipoDaEntrada(evento: EventoRecebido): string {
  if (evento.tipo === 'texto') return 'text';
  if (evento.tipo === 'botao') return 'interactive';
  return evento.formato;
}
