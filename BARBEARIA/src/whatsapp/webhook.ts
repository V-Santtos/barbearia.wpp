import { Hono } from 'hono';
import type { Env } from '../config/env.js';
import type { Acao } from '../fluxo/acoes.js';
import { rotear } from '../fluxo/rotear.js';
import { compararSegredos, verificarAssinatura } from './assinatura.js';
import type { Emissor } from './enviar.js';
import { traduzirEnvelope, type EnvelopeWebhook, type EventoRecebido } from './eventos.js';

/** O que o webhook precisa do mundo externo. Injetado pra o teste nao tocar em rede nem banco. */
export type Dependencias = {
  /** Grava o evento e decide o que ainda deve ser enviado (dedupe + anti-repeticao). */
  registrar: (evento: EventoRecebido, acoes: Acao[]) => Promise<{ novo: boolean; enviar: Acao[] }>;
  enviar: Emissor;
};

export function criarRotasWebhook(env: Env, deps: Dependencias): Hono {
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
   *  - responder 200 rapido, senao ela reenvia;
   *  - validar a assinatura sobre o corpo BRUTO, nunca sobre o JSON reparseado.
   *
   * O processamento e sincrono dentro da requisicao, e isso e seguro por causa
   * do dedupe: se a Meta desistir de esperar e reentregar, o `on conflict`
   * absorve em vez de o cliente receber a resposta duas vezes.
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

    const { eventos, ignorados } = traduzirEnvelope(envelope);

    if (ignorados.length > 0) {
      console.log(JSON.stringify({ nivel: 'debug', evento: 'webhook.ignorado', motivos: ignorados }));
    }

    for (const recebido of eventos) {
      // Uma mensagem com problema nao pode derrubar as outras do mesmo envelope.
      try {
        await processar(recebido, deps);
      } catch (erro) {
        console.error(
          JSON.stringify({
            nivel: 'error',
            evento: 'webhook.processamento.falhou',
            wamid: recebido.wamid,
            erro: erro instanceof Error ? erro.message : String(erro),
          }),
        );
      }
    }

    return c.text('OK', 200);
  });

  return rotas;
}

async function processar(recebido: EventoRecebido, deps: Dependencias): Promise<void> {
  const acoes = rotear(recebido);
  const decisao = await deps.registrar(recebido, acoes);

  if (!decisao.novo) {
    console.log(
      JSON.stringify({ nivel: 'info', evento: 'webhook.reentrega.ignorada', wamid: recebido.wamid }),
    );
    return;
  }

  // ponytail: envio que falha nao e retentado — o evento ja esta gravado, entao
  // a reentrega da Meta cai no dedupe e a mensagem se perde (com log de erro).
  // Gatilho de upgrade: quando existir a tabela `envios_pendentes` (outbox), o
  // envio passa por ela e ganha retentativa de graca.
  for (const acao of decisao.enviar) {
    await deps.enviar(acao);
  }

  console.log(
    JSON.stringify({
      nivel: 'info',
      evento: 'webhook.processado',
      wamid: recebido.wamid,
      tipo: recebido.tipo,
      de: recebido.de,
      enviadas: decisao.enviar.map((acao) => acao.resposta),
      suprimidas: acoes.length - decisao.enviar.length,
    }),
  );
}
