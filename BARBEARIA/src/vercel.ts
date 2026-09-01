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
 * nao acharia. `api/bot.mjs` e so o repasse de uma linha.
 *
 * `carregarEnv()` roda no carregamento do modulo, e falha alto se faltar
 * variavel: a funcao inteira responde 500 com a lista do que falta, em vez de
 * subir pela metade e dar erro obscuro no primeiro cliente que escrever.
 */
const app = criarApp(carregarEnv());

/** Tira o prefixo com que a funcao e servida; as rotas do Hono comecam em `/`. */
function semPrefixo(caminho: string): string {
  return caminho.replace(/^\/api\/bot(?=\/|$)/, '') || '/';
}

/**
 * ESTILO WEB — o caminho bom, e o motivo de ele existir.
 *
 * O adaptador Node (`getRequestListener`) NAO serve aqui, e isso custou um
 * diagnostico em producao (2026-09-01): o runtime do Vercel entrega o POST com o
 * corpo JA PARSEADO em `req.body` e o stream esgotado — `complete: true` e
 * `readableEnded: false` ao mesmo tempo. O `await c.req.text()` do webhook ficava
 * esperando bytes que nunca viriam, e a requisicao pendurava por 30s. A Meta
 * desiste em ~15-20s, entao o webhook nunca teria funcionado.
 *
 * Reconstruir o corpo a partir do objeto parseado NAO e opcao: a assinatura
 * HMAC-SHA256 e calculada sobre os BYTES EXATOS que a Meta mandou, e
 * `JSON.stringify` de um objeto ja parseado nao garante os mesmos bytes (ordem de
 * chave, escape de unicode, formato de numero). Verificacao de assinatura que
 * depende de sorte de serializacao e pior que nenhuma.
 *
 * No estilo Web a `Request` chega intacta, e `arrayBuffer()` devolve os bytes
 * originais. E o formato nativo do Hono — `app.fetch` ja e `(Request) => Response`.
 *
 * COMO SE PEDE ESSE ESTILO: exportando METODOS HTTP NOMEADOS (`export const POST`),
 * e nao um `export default`. Medido em 2026-09-01: com `export default`, o Vercel
 * chama no formato antigo — `IncomingMessage` + `ServerResponse` — e o corpo chega
 * ja consumido. E `api/bot.mjs` quem faz essa exportacao.
 */
export async function atenderWeb(requisicao: Request): Promise<Response> {
  const url = new URL(requisicao.url);
  url.pathname = semPrefixo(url.pathname);

  const temCorpo = requisicao.method !== 'GET' && requisicao.method !== 'HEAD';

  // O corpo vai como ArrayBuffer, e nao como stream, de proposito: stream em
  // `Request` exige `duplex: 'half'` e varia entre runtimes. Bytes crus nao variam.
  return app.fetch(
    new Request(url.toString(), {
      method: requisicao.method,
      headers: requisicao.headers,
      ...(temCorpo ? { body: await requisicao.arrayBuffer() } : {}),
    }),
  );
}

/** ESTILO NODE — reserva, caso a plataforma chame no formato antigo. */
const atenderNode = getRequestListener(app.fetch);

/**
 * Aceita as DUAS convencoes de chamada em vez de apostar numa.
 *
 * A diferenca observavel e barata: `Request` do fetch tem `headers.get()`, o
 * `IncomingMessage` do Node tem `headers` como objeto simples. Custa uma checagem
 * por requisicao e evita que uma mudanca de runtime da plataforma derrube o
 * webhook em silencio.
 */
export default function handler(
  a: Request | IncomingMessage,
  b?: ServerResponse,
): Promise<Response | void> {
  if (typeof (a as Request).headers?.get === 'function') {
    return atenderWeb(a as Request);
  }

  const req = a as IncomingMessage;
  req.url = semPrefixo(req.url ?? '/');
  return atenderNode(req, b as ServerResponse);
}
