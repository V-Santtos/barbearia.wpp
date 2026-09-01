import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { criarApp } from './app.js';
import { carregarEnv } from './config/env.js';

/**
 * O bot rodando como funcao do Vercel.
 *
 * Existe SEPARADO do `index.ts` porque os dois sobem o mesmo app de jeitos
 * diferentes: la um servidor Node que fica de pe e escuta uma porta; aqui um
 * handler que a plataforma chama e descarta. O `criarApp` de `app.ts` e o mesmo
 * nos dois — foi desenhado assim desde o inicio, justamente pra esta hora.
 *
 * MORA AQUI, E NAO EM `api/`, POR CAUSA DA RESOLUCAO DE MODULO. A raiz do
 * repositorio nao tem `package.json` nem `node_modules`: um `import
 * '@hono/node-server'` escrito em `api/bot.mjs` procuraria em `/node_modules` e
 * nao acharia. Escrito aqui, resolve em `BARBEARIA/node_modules` como qualquer
 * outro arquivo do bot. `api/bot.mjs` e so o repasse de uma linha.
 *
 * `carregarEnv()` roda no carregamento do modulo, e falha alto se faltar
 * variavel: a funcao inteira responde 500 com a lista do que falta, em vez de
 * subir pela metade e dar erro obscuro no primeiro cliente que escrever.
 */
const app = criarApp(carregarEnv());
const atender = getRequestListener(app.fetch);

export default function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // A funcao atende em `/api/bot/...`, mas as rotas do Hono comecam em `/`
  // (`/webhook/whatsapp`, `/mensagens`). Sem tirar o prefixo, tudo daria 404.
  //
  // O `(?=\/|$)` impede que um caminho como `/api/botanica` perca pedaco. E se a
  // plataforma ja entregar o caminho sem prefixo, o replace nao casa e nada muda —
  // funciona nos dois casos, que e o que evita depender de detalhe de roteamento
  // que so da pra observar depois de publicar.
  req.url = (req.url ?? '/').replace(/^\/api\/bot(?=\/|$)/, '') || '/';

  return atender(req, res);
}
