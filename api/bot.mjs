// O bot de WhatsApp rodando como funcao do Vercel.
//
// Repasse, e nao o adaptador em si: `@hono/node-server` e `hono` sao dependencias
// de BARBEARIA/, e um import escrito AQUI procuraria em /node_modules da raiz —
// que nao existe. Dentro de BARBEARIA/dist/ resolve normalmente.
//
// METODOS NOMEADOS, E NAO `export default`. Isto NAO e estilo: e o que faz o Vercel
// entregar a `Request` do fetch em vez do par (IncomingMessage, ServerResponse).
// Medido em producao (2026-09-01): com `export default`, o corpo do POST chega ja
// parseado e com o stream esgotado, e a leitura do webhook pendurava por 30s — a
// Meta desiste em ~15-20s. Como a assinatura HMAC precisa dos BYTES EXATOS, nao
// dava pra remontar o corpo a partir do objeto parseado.
//
// `dist/` e gerado por `npm run build --prefix BARBEARIA` (ver vercel.json).
import { atenderWeb } from '../BARBEARIA/dist/vercel.js';

export const GET = atenderWeb;
export const POST = atenderWeb;
export const PUT = atenderWeb;
export const PATCH = atenderWeb;
export const DELETE = atenderWeb;
