import { describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import type { Env } from '../config/env.js';
import type { Acao } from '../fluxo/acoes.js';
import type { Dependencias } from './webhook.js';

const ENV: Env = {
  META_APP_SECRET: 'app-secret-de-teste',
  WHATSAPP_VERIFY_TOKEN: 'token-de-verificacao-de-teste',
  WHATSAPP_TOKEN: 'token-de-envio-de-teste',
  WHATSAPP_PHONE_NUMBER_ID: '922642447599728',
  DATABASE_URL: 'postgresql://nao-usado-neste-teste',
  CALENDARIO_URL: 'http://localhost:3334',
  CALENDARIO_WEBHOOK_TOKEN: 'token-de-espelho-de-teste',
  PAINEL_TOKEN: 'token-do-painel-de-teste',
  PORT: 3000,
};

const ROTA = '/mensagens';

function montar(env: Env = ENV, aoEnviar?: (acao: Acao) => Promise<string | undefined>) {
  const enviadas: Acao[] = [];

  const deps: Dependencias = {
    registrar: async () => ({ novo: true, enviar: [], clienteNovo: false, nome: undefined }),
    enviar: async (acao) => {
      enviadas.push(acao);
      return aoEnviar ? aoEnviar(acao) : 'wamid.DO_PAINEL';
    },
  };

  return { app: criarApp(env, deps), enviadas };
}

function postar(app: ReturnType<typeof criarApp>, corpo: unknown, token?: string) {
  return app.request(ROTA, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-painel-token': token } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

const MENSAGEM = { para: '553384246770', texto: 'Bom dia! Consigo te encaixar às 15h.' };

describe('POST /mensagens — o dono falando pelo painel', () => {
  it('envia o texto e devolve o wamid que a Meta gerou', async () => {
    const { app, enviadas } = montar();

    const res = await postar(app, MENSAGEM, ENV.PAINEL_TOKEN);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wamid: 'wamid.DO_PAINEL' });
    expect(enviadas).toEqual([
      { tipo: 'enviar_texto', para: MENSAGEM.para, resposta: 'feedback', texto: MENSAGEM.texto },
    ]);
  });

  it('sai como texto puro — o dono nao monta cartao com opcoes', async () => {
    // Cartao roteia por id de botao, e id de botao e coisa do fluxo. Se esta rota
    // aceitasse opcoes, os ids teriam que sair de algum lugar — e nao ha lugar.
    const { app, enviadas } = montar();

    await postar(app, { ...MENSAGEM, opcoes: [{ id: '1.agendar', titulo: 'Agendar' }] }, ENV.PAINEL_TOKEN);

    expect(enviadas[0]?.tipo).toBe('enviar_texto');
  });

  it('sem token, recusa com 403 e nao envia nada', async () => {
    const { app, enviadas } = montar();

    expect((await postar(app, MENSAGEM)).status).toBe(403);
    expect((await postar(app, MENSAGEM, 'token-errado')).status).toBe(403);
    expect(enviadas).toEqual([]);
  });

  it('sem PAINEL_TOKEN configurado, a porta nao abre — 503, e o bot atende igual', async () => {
    const { app, enviadas } = montar({ ...ENV, PAINEL_TOKEN: '' });

    // Nem com o token certo do OUTRO segredo: sao portas diferentes de proposito.
    expect((await postar(app, MENSAGEM, ENV.CALENDARIO_WEBHOOK_TOKEN)).status).toBe(503);
    expect(enviadas).toEqual([]);

    const saude = await app.request('/saude');
    expect(saude.status).toBe(200);
  });

  it('o token do espelho NAO abre esta porta', async () => {
    const { app, enviadas } = montar();

    expect((await postar(app, MENSAGEM, ENV.CALENDARIO_WEBHOOK_TOKEN)).status).toBe(403);
    expect(enviadas).toEqual([]);
  });

  it('recusa corpo sem `para` ou sem `texto`, e texto so de espaco', async () => {
    const { app, enviadas } = montar();

    expect((await postar(app, { texto: 'oi' }, ENV.PAINEL_TOKEN)).status).toBe(400);
    expect((await postar(app, { para: '5533' }, ENV.PAINEL_TOKEN)).status).toBe(400);
    expect((await postar(app, { para: '5533', texto: '   ' }, ENV.PAINEL_TOKEN)).status).toBe(400);
    expect(enviadas).toEqual([]);
  });

  it('Meta recusando vira 502 — o calendario precisa saber que NAO saiu', async () => {
    // E o que impede o painel de gravar uma mensagem do dono que nunca chegou no
    // celular do cliente.
    const { app } = montar(ENV, async () => {
      throw new Error('Cloud API recusou o envio (400): fora da janela de 24h');
    });

    const res = await postar(app, MENSAGEM, ENV.PAINEL_TOKEN);

    expect(res.status).toBe(502);
    const corpo = (await res.json()) as { motivo: string };
    expect(corpo.motivo).toContain('janela de 24h');
  });
});
