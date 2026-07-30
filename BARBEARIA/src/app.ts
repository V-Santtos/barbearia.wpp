import { Hono } from 'hono';
import type { Env } from './config/env.js';
import { criarRotasWebhook } from './whatsapp/webhook.js';

/**
 * Monta o app. Fica separado do `index.ts` (que sobe o servidor Node) pra que
 * o mesmo Hono possa ser exportado como handler serverless na Vercel sem
 * duplicar rota, e pra que os testes montem o app sem abrir porta.
 */
export function criarApp(env: Env): Hono {
  const app = new Hono();

  app.get('/saude', (c) => c.json({ ok: true, servico: 'barbearia-bot' }));

  app.route('/webhook/whatsapp', criarRotasWebhook(env));

  return app;
}
