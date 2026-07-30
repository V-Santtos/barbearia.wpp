import { Hono } from 'hono';
import type { Env } from './config/env.js';
import { obterPool } from './db/cliente.js';
import { registrarEDecidir } from './db/eventos.js';
import { criarEmissor } from './whatsapp/enviar.js';
import { criarRotasWebhook, type Dependencias } from './whatsapp/webhook.js';

/**
 * Monta o app. Fica separado do `index.ts` (que sobe o servidor Node) pra que
 * o mesmo Hono possa ser exportado como handler serverless na Vercel sem
 * duplicar rota, e pra que os testes montem o app sem abrir porta.
 */
export function criarApp(env: Env, deps: Dependencias = dependenciasReais(env)): Hono {
  const app = new Hono();

  app.get('/saude', (c) => c.json({ ok: true, servico: 'barbearia-bot' }));

  app.route('/webhook/whatsapp', criarRotasWebhook(env, deps));

  return app;
}

/**
 * Ponto de composicao: e aqui, e so aqui, que banco e Cloud API sao ligados no
 * fluxo. O teste passa `deps` proprias e nao encosta em nenhum dos dois.
 */
export function dependenciasReais(env: Env): Dependencias {
  const pool = obterPool(env.DATABASE_URL);

  return {
    registrar: (evento, decidir) => registrarEDecidir(pool, evento, decidir),
    enviar: criarEmissor(env),
  };
}
