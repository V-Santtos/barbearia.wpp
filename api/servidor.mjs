// A API do calendario rodando como funcao do Vercel.
//
// `.mjs` de proposito: a raiz do repositorio nao tem package.json, entao sem a
// extensao o Vercel leria este arquivo como CommonJS e o `import` quebraria.
//
// O `server.js` mora em CALENDARIO/ e e de la que ele resolve `fastify` e `pg` —
// por isso o import relativo funciona sem a raiz ter dependencia nenhuma.
//
// NOME ESTATICO, DE PROPOSITO. Este arquivo se chamava `[...caminho].mjs`, contando
// que o Vercel o lesse como catch-all. Ele nao leu: gerou uma rota de UM segmento
// chamada `...caminho` — dava pra ver na querystring que chegava aqui,
// `?...caminho=`, com os tres pontos dentro do nome do parametro. Na pratica, toda
// rota com mais de um nivel (`/api/dashboard/resumo`, `/api/profissionais/1/agenda`)
// respondia 404 do Vercel sem nunca chegar no Fastify.
//
// Agora quem decide o roteamento e o `vercel.json`, explicitamente. Inferencia a
// partir de nome de arquivo foi o que falhou; nao voltar pra ela.
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
