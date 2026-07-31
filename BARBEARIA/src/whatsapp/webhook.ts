import { Hono } from 'hono';
import type { Espelho } from '../calendario/crm.js';
import type { Env } from '../config/env.js';
import type { Acao, ContextoFluxo } from '../fluxo/acoes.js';
import { rotear } from '../fluxo/rotear.js';
import { compararSegredos, verificarAssinatura } from './assinatura.js';
import type { Emissor } from './enviar.js';
import { traduzirEnvelope, type EnvelopeWebhook, type EventoRecebido } from './eventos.js';

/** O que o webhook precisa do mundo externo. Injetado pra o teste nao tocar em rede nem banco. */
export type Dependencias = {
  /**
   * Grava o evento, cadastra o contato e decide o que enviar (dedupe +
   * anti-repeticao). Recebe o roteamento como funcao porque a resposta depende de
   * o contato ser novo ou nao — coisa que so se sabe dentro da transacao.
   */
  registrar: (
    evento: EventoRecebido,
    decidir: (contexto: ContextoFluxo) => Acao[],
  ) => Promise<{
    novo: boolean;
    enviar: Acao[];
    clienteNovo: boolean;
    /** Nome do cadastro, quando existe. Vai pro espelho identificar a conversa. */
    nome: string | undefined;
  }>;
  enviar: Emissor;
  /** Copia a conversa pro painel do dono. Opcional: sem ele, o bot funciona igual. */
  espelho?: Espelho;
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
  const decisao = await deps.registrar(recebido, (contexto) => rotear(recebido, contexto));

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
  const enviadas: { acao: Acao; wamid: string | undefined }[] = [];
  for (const acao of decisao.enviar) {
    enviadas.push({ acao, wamid: await deps.enviar(acao) });
  }

  await espelhar(recebido, decisao.nome, enviadas, deps);

  console.log(
    JSON.stringify({
      nivel: 'info',
      evento: 'webhook.processado',
      wamid: recebido.wamid,
      tipo: recebido.tipo,
      de: recebido.de,
      clienteNovo: decisao.clienteNovo,
      enviadas: decisao.enviar.map((acao) => acao.resposta),
    }),
  );
}

/**
 * Copia a conversa pro painel do dono — os dois lados.
 *
 * Roda DEPOIS do envio, de proposito: o painel atrasar alguns segundos e chato, o
 * cliente esperar por causa do painel e inaceitavel. E o `catch` daqui e o que garante
 * que calendario fora do ar nunca vire mensagem perdida.
 *
 * A entrada e espelhada mesmo quando `enviadas` esta vazio. Vazio quer dizer que a
 * trava de rajada calou o bot — e e exatamente nessa hora que o dono mais quer ver o
 * que o cliente esta escrevendo.
 */
async function espelhar(
  recebido: EventoRecebido,
  nome: string | undefined,
  enviadas: { acao: Acao; wamid: string | undefined }[],
  deps: Dependencias,
): Promise<void> {
  if (!deps.espelho) return;

  try {
    const resultados = [
      await deps.espelho.entrada(recebido, nome),
      ...(await Promise.all(
        enviadas.map(({ acao, wamid }) => deps.espelho!.saida(acao, wamid)),
      )),
    ];

    const falhas = resultados.filter((r) => !r.ok);
    if (falhas.length > 0) {
      console.error(
        JSON.stringify({
          nivel: 'error',
          evento: 'crm.espelho.falhou',
          wamid: recebido.wamid,
          falhas: falhas.map((r) => (r.ok ? '' : r.motivo)),
        }),
      );
    }
  } catch (erro) {
    // `pedir()` ja engole tudo, entao chegar aqui e defeito nosso — nao pode virar
    // mensagem nao entregue por causa do painel.
    console.error(
      JSON.stringify({
        nivel: 'error',
        evento: 'crm.espelho.quebrou',
        wamid: recebido.wamid,
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
  }
}
