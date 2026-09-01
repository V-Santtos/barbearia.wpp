// O bot de WhatsApp rodando como funcao do Vercel.
//
// Repasse de uma linha, e nao o adaptador em si: `@hono/node-server` e `hono` sao
// dependencias de BARBEARIA/, e um import escrito AQUI procuraria em /node_modules
// da raiz — que nao existe. Dentro de BARBEARIA/dist/ ele resolve normalmente.
//
// `dist/` e gerado por `npm run build --prefix BARBEARIA` (ver vercel.json) e nao
// e versionado.
export { default } from '../BARBEARIA/dist/vercel.js';
