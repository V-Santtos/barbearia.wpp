import { serve } from '@hono/node-server';
import { criarApp } from './app.js';
import { carregarEnv } from './config/env.js';
import { aquecerPool, obterPool } from './db/cliente.js';

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

// Depois do `serve`, nao antes: o webhook ja responde enquanto as conexoes abrem.
// Quem chegar nesse meio tempo espera o pool como sempre esperou.
void aquecerPool(obterPool(env.DATABASE_URL)).then((abertas) => {
  console.log(JSON.stringify({ nivel: 'info', evento: 'banco.aquecido', conexoes: abertas }));
});
