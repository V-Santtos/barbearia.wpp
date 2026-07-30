import { Hono } from 'hono';
import type { Env } from '../config/env.js';
import { compararSegredos, verificarAssinatura } from './assinatura.js';
import { resumirEvento, type EnvelopeWebhook } from './eventos.js';

export function criarRotasWebhook(env: Env): Hono {
  const rotas = new Hono();

  /**
   * Handshake de verificacao. A Meta bate aqui uma vez, no momento em que voce
   * clica "Verificar e salvar" no painel, e espera receber o `hub.challenge`
   * de volta como texto puro.
   */
  rotas.get('/', (c) => {
    const modo = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const desafio = c.req.query('hub.challenge');

    if (modo !== 'subscribe' || !token || !compararSegredos(token, env.WHATSAPP_VERIFY_TOKEN)) {
      console.warn(
        JSON.stringify({
          nivel: 'warn',
          evento: 'webhook.verificacao.recusada',
          modo,
          tokenRecebido: Boolean(token),
        }),
      );
      return c.text('Forbidden', 403);
    }

    console.log(JSON.stringify({ nivel: 'info', evento: 'webhook.verificacao.ok' }));
    return c.text(desafio ?? '', 200);
  });

  /**
   * Recebimento de eventos. Duas regras que a Meta impoe:
   *  - responder 200 rapido, senao ela reenvia (e o reenvio vira mensagem
   *    duplicada pro cliente da barbearia);
   *  - validar a assinatura sobre o corpo BRUTO, nunca sobre o JSON reparseado.
   */
  rotas.post('/', async (c) => {
    const corpoBruto = await c.req.text();
    const assinatura = c.req.header('x-hub-signature-256');

    if (!verificarAssinatura(corpoBruto, assinatura, env.META_APP_SECRET)) {
      console.warn(
        JSON.stringify({
          nivel: 'warn',
          evento: 'webhook.assinatura.invalida',
          temCabecalho: Boolean(assinatura),
          bytes: corpoBruto.length,
        }),
      );
      return c.text('Assinatura invalida', 401);
    }

    let envelope: EnvelopeWebhook;
    try {
      envelope = JSON.parse(corpoBruto) as EnvelopeWebhook;
    } catch {
      // Assinatura valida mas corpo nao e JSON: e a Meta mudando formato, nao
      // um atacante. Responder 200 pra ela nao entrar em loop de reenvio.
      console.error(
        JSON.stringify({ nivel: 'error', evento: 'webhook.json.invalido', corpoBruto }),
      );
      return c.text('OK', 200);
    }

    // ponytail: payload bruto so no stdout, sem persistencia. Teto: serve pra
    // validar a Fase 1 na nossa frente, no terminal. Gatilho de upgrade: criar
    // a tabela `webhook_eventos` antes de qualquer trafego real — a retencao de
    // log da Vercel e curta e replay de webhook e a ferramenta de debug que a
    // gente mais vai usar.
    for (const resumo of resumirEvento(envelope)) {
      console.log(
        JSON.stringify({
          nivel: 'info',
          evento: 'webhook.recebido',
          campo: resumo.campo,
          wabaId: resumo.wabaId,
          wamids: resumo.wamids,
        }),
      );
    }
    console.log(JSON.stringify({ nivel: 'debug', evento: 'webhook.bruto', payload: envelope }));

    return c.text('OK', 200);
  });

  return rotas;
}
