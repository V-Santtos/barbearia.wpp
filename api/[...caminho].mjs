// A API do calendario rodando como funcao do Vercel.
//
// `.mjs` de proposito: a raiz do repositorio nao tem package.json, entao sem a
// extensao o Vercel leria este arquivo como CommonJS e o `import` quebraria.
//
// O `server.js` mora em CALENDARIO/ e e de la que ele resolve `fastify` e `pg` —
// por isso o import relativo funciona sem a raiz ter dependencia nenhuma.
import { buildServer } from '../CALENDARIO/server.js';

const app = buildServer();
const pronto = app.ready();

export default async function handler(req, res) {
  // A funcao atende em `/api/...`, mas as rotas do Fastify comecam em `/`
  // (`/profissionais`, `/agendamentos`). Sem tirar o prefixo, tudo daria 404.
  req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';

  await pronto;
  app.server.emit('request', req, res);
}
