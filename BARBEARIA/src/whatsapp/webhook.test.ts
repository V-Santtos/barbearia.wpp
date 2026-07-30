import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import type { Env } from '../config/env.js';

const env: Env = {
  META_APP_SECRET: 'app-secret-de-teste',
  WHATSAPP_VERIFY_TOKEN: 'token-de-verificacao-de-teste',
  PORT: 3000,
};

const app = criarApp(env);
const ROTA = '/webhook/whatsapp';

function postAssinado(corpo: string, segredo = env.META_APP_SECRET) {
  return app.request(ROTA, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex')}`,
    },
    body: corpo,
  });
}

describe('GET /webhook/whatsapp — handshake de verificacao', () => {
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

describe('POST /webhook/whatsapp — recebimento de evento', () => {
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5533845949688', phone_number_id: '1234' },
              messages: [{ id: 'wamid.HBgM', from: '5511999999999', type: 'text' }],
            },
          },
        ],
      },
    ],
  });

  it('aceita evento com assinatura valida', async () => {
    const res = await postAssinado(payload);
    expect(res.status).toBe(200);
  });

  it('rejeita com 401 quando a assinatura veio de outro segredo', async () => {
    const res = await postAssinado(payload, 'segredo-de-atacante');
    expect(res.status).toBe(401);
  });

  it('rejeita com 401 quando nao ha cabecalho de assinatura', async () => {
    const res = await app.request(ROTA, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    expect(res.status).toBe(401);
  });

  it('rejeita com 401 quando o corpo foi adulterado apos a assinatura', async () => {
    const assinaturaDoOriginal = createHmac('sha256', env.META_APP_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const res = await app.request(ROTA, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${assinaturaDoOriginal}`,
      },
      body: payload.replace('5511999999999', '5511888888888'),
    });

    expect(res.status).toBe(401);
  });

  it('responde 200 em corpo assinado que nao e JSON, pra nao virar loop de reenvio', async () => {
    const res = await postAssinado('isto nao e json');
    expect(res.status).toBe(200);
  });

  it('aceita os campos de coexistencia (smb_message_echoes)', async () => {
    const eco = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '102290129340398',
          changes: [
            { field: 'smb_message_echoes', value: { message_echoes: [{ id: 'wamid.ECO' }] } },
          ],
        },
      ],
    });

    expect((await postAssinado(eco)).status).toBe(200);
  });
});

describe('GET /saude', () => {
  it('responde ok', async () => {
    const res = await app.request('/saude');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, servico: 'barbearia-bot' });
  });
});
