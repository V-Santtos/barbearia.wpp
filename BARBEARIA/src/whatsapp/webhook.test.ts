import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import type { Env } from '../config/env.js';
import type { Acao } from '../fluxo/acoes.js';
import type { Dependencias } from './webhook.js';

const env: Env = {
  META_APP_SECRET: 'app-secret-de-teste',
  WHATSAPP_VERIFY_TOKEN: 'token-de-verificacao-de-teste',
  WHATSAPP_TOKEN: 'token-de-envio-de-teste',
  WHATSAPP_PHONE_NUMBER_ID: '922642447599728',
  DATABASE_URL: 'postgresql://nao-usado-neste-teste',
  PORT: 3000,
};

const ROTA = '/webhook/whatsapp';

/**
 * Monta o app com dependencias de mentira: o teste nao abre porta, nao fala com
 * o banco e nao chama a Meta. Por padrao o registro diz "evento novo, manda
 * tudo" — cada teste sobrescreve o que precisa.
 */
function montar(sobrescreve: Partial<Dependencias> = {}) {
  const enviadas: Acao[] = [];

  const deps: Dependencias = {
    registrar: async (_evento, decidir) => ({
      novo: true,
      enviar: decidir({ clienteNovo: true, ultimaResposta: undefined, degrau: 0 }),
      clienteNovo: true,
    }),
    enviar: async (acao) => {
      enviadas.push(acao);
    },
    ...sobrescreve,
  };

  return { app: criarApp(env, deps), enviadas };
}

function assinar(corpo: string, segredo = env.META_APP_SECRET): string {
  return `sha256=${createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex')}`;
}

function postar(app: ReturnType<typeof criarApp>, corpo: string, segredo?: string) {
  return app.request(ROTA, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(corpo, segredo) },
    body: corpo,
  });
}

const MENSAGEM_DE_TEXTO = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '830103189833653',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+55 33 8459-4968', phone_number_id: '922642447599728' },
            contacts: [{ profile: { name: 'Victor' }, wa_id: '5533999999999' }],
            messages: [
              { id: 'wamid.HBgM', from: '5533999999999', timestamp: '1785585600', type: 'text', text: { body: 'Oi' } },
            ],
          },
        },
      ],
    },
  ],
});

describe('GET /webhook/whatsapp — handshake de verificacao', () => {
  const { app } = montar();

  it('devolve o hub.challenge quando modo e token conferem', async () => {
    const res = await app.request(
      `${ROTA}?hub.mode=subscribe&hub.verify_token=${env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=1158201444`,
    );

    expect(res.status).toBe(200);
    // A Meta compara o corpo com o challenge que mandou — tem que ser texto
    // puro, sem aspas de JSON e sem quebra de linha.
    expect(await res.text()).toBe('1158201444');
  });

  it('recusa com 403 quando o verify token esta errado', async () => {
    const res = await app.request(
      `${ROTA}?hub.mode=subscribe&hub.verify_token=token-errado&hub.challenge=123`,
    );
    expect(res.status).toBe(403);
  });

  it('recusa com 403 quando o hub.mode nao e subscribe', async () => {
    const res = await app.request(
      `${ROTA}?hub.mode=unsubscribe&hub.verify_token=${env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=123`,
    );
    expect(res.status).toBe(403);
  });

  it('recusa com 403 quando nao vem parametro nenhum', async () => {
    expect((await app.request(ROTA)).status).toBe(403);
  });
});

describe('POST /webhook/whatsapp — assinatura', () => {
  it('aceita evento com assinatura valida', async () => {
    const { app } = montar();
    expect((await postar(app, MENSAGEM_DE_TEXTO)).status).toBe(200);
  });

  it('rejeita com 401 quando a assinatura veio de outro segredo', async () => {
    const { app, enviadas } = montar();
    expect((await postar(app, MENSAGEM_DE_TEXTO, 'segredo-de-atacante')).status).toBe(401);
    expect(enviadas).toEqual([]);
  });

  it('rejeita com 401 quando nao ha cabecalho de assinatura', async () => {
    const { app } = montar();
    const res = await app.request(ROTA, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: MENSAGEM_DE_TEXTO,
    });
    expect(res.status).toBe(401);
  });

  it('rejeita com 401 quando o corpo foi adulterado apos a assinatura', async () => {
    const { app } = montar();
    const res = await app.request(ROTA, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(MENSAGEM_DE_TEXTO) },
      body: MENSAGEM_DE_TEXTO.replace('5533999999999', '5511888888888'),
    });

    expect(res.status).toBe(401);
  });

  it('responde 200 em corpo assinado que nao e JSON, pra nao virar loop de reenvio', async () => {
    const { app } = montar();
    expect((await postar(app, 'isto nao e json')).status).toBe(200);
  });
});

describe('POST /webhook/whatsapp — primeira interacao', () => {
  it('responde "Oi" com o menu de 3 botoes', async () => {
    const { app, enviadas } = montar();

    expect((await postar(app, MENSAGEM_DE_TEXTO)).status).toBe(200);
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]?.resposta).toBe('menu_principal');
    expect(enviadas[0]?.para).toBe('5533999999999');
  });

  it('nao envia nada quando o evento e reentrega da Meta', async () => {
    const { app, enviadas } = montar({
      registrar: async () => ({ novo: false, enviar: [], clienteNovo: false }),
    });

    expect((await postar(app, MENSAGEM_DE_TEXTO)).status).toBe(200);
    expect(enviadas).toEqual([]);
  });

  it('nao envia nada quando a trava anti-repeticao suprime a acao', async () => {
    const { app, enviadas } = montar({
      registrar: async () => ({ novo: true, enviar: [], clienteNovo: false }),
    });

    expect((await postar(app, MENSAGEM_DE_TEXTO)).status).toBe(200);
    expect(enviadas).toEqual([]);
  });

  it('a saudacao muda conforme o contato ja esteja cadastrado', async () => {
    const primeira = montar();
    await postar(primeira.app, MENSAGEM_DE_TEXTO);

    const repetida = montar({
      registrar: async (_evento, decidir) => ({
        novo: true,
        enviar: decidir({ clienteNovo: false, ultimaResposta: undefined, degrau: 0 }),
        clienteNovo: false,
      }),
    });
    await postar(repetida.app, MENSAGEM_DE_TEXTO);

    expect(primeira.enviadas[0]?.texto).not.toBe(repetida.enviadas[0]?.texto);
    expect(repetida.enviadas[0]?.texto).toContain('de novo');
    // Mesmo nome de resposta nos dois: e a trava anti-repeticao que depende disso.
    expect(primeira.enviadas[0]?.resposta).toBe(repetida.enviadas[0]?.resposta);
  });

  it('nao trata recibo de entrega como mensagem de cliente', async () => {
    const recibo = JSON.stringify({
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '922642447599728' },
                statuses: [{ id: 'wamid.X', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    });

    const { app, enviadas } = montar();
    expect((await postar(app, recibo)).status).toBe(200);
    expect(enviadas).toEqual([]);
  });

  it('aceita os campos de coexistencia sem rotear nada', async () => {
    const eco = JSON.stringify({
      entry: [
        { id: 'WABA', changes: [{ field: 'smb_message_echoes', value: { message_echoes: [{ id: 'wamid.ECO' }] } }] },
      ],
    });

    const { app, enviadas } = montar();
    expect((await postar(app, eco)).status).toBe(200);
    expect(enviadas).toEqual([]);
  });

  it('falha de envio numa mensagem nao derruba as outras do mesmo envelope', async () => {
    const enviadas: Acao[] = [];
    const app = criarApp(env, {
      registrar: async (_evento, decidir) => ({
        novo: true,
        enviar: decidir({ clienteNovo: false, ultimaResposta: undefined, degrau: 0 }),
        clienteNovo: false,
      }),
      enviar: async (acao) => {
        if (enviadas.length === 0) {
          enviadas.push(acao);
          throw new Error('Cloud API fora do ar');
        }
        enviadas.push(acao);
      },
    });

    const rajada = JSON.stringify({
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '922642447599728' },
                messages: [
                  { id: 'w1', from: '5533999999999', type: 'text', text: { body: 'Oi' } },
                  { id: 'w2', from: '5533999999999', type: 'text', text: { body: 'bom dia' } },
                ],
              },
            },
          ],
        },
      ],
    });

    expect((await postar(app, rajada)).status).toBe(200);
    expect(enviadas).toHaveLength(2);
  });
});

describe('GET /saude', () => {
  it('responde ok', async () => {
    const { app } = montar();
    const res = await app.request('/saude');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, servico: 'barbearia-bot' });
  });
});
