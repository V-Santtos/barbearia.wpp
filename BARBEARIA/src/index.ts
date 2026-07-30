import { serve } from '@hono/node-server';
import { criarApp } from './app.js';
import { carregarEnv } from './config/env.js';

// Node 22 le o .env nativamente com --env-file; o script `dev` no package.json
// nao precisa de dotenv por causa disso.
const env = carregarEnv();
const app = criarApp(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    JSON.stringify({
      nivel: 'info',
      evento: 'servidor.iniciado',
      porta: info.port,
      webhook: `http://localhost:${info.port}/webhook/whatsapp`,
    }),
  );
});
