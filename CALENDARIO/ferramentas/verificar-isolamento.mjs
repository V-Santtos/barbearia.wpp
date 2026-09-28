// Verificacao ponta a ponta do isolamento entre barbearias: autenticacao, RLS e
// rotas publicas. Sobe o `server.js` de verdade, contra o banco de verdade.
//
//   cd CALENDARIO && npm run verificar
//
// POR QUE ESTE ARQUIVO EXISTE: a API do calendario nao tem teste nenhum, e e onde
// moraram tres dos quatro bugs de 01/09/2026. Esta verificacao foi escrita tres
// vezes num diretorio temporario e se perdeu duas — ate virar arquivo versionado.
//
// O QUE E FALSO AQUI: so o EMISSOR do token. Um servidor local faz o papel do
// Supabase Auth, com uma chave gerada na hora; a verificacao do JWT, a troca de
// papel no Postgres e as politicas de RLS sao as reais.
//
// ESCREVE NO BANCO, e por isso tem duas travas:
//  1. So roda se o banco tiver o seed de teste (`source = 'seed-teste'`). Em
//     producao esse discriminador responde zero, e o script para antes de tocar em
//     qualquer coisa.
//  2. O dono REAL de cada loja e guardado antes e devolvido no fim, aconteca o que
//     acontecer. A versao anterior zerava o `user_id` na limpeza — o que, depois que a
//     loja ganhou dono de verdade (28/09), a desligaria dele sem aviso.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import pg from "pg";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTA_API = 3399;
const PORTA_JWKS = 3398;
const API = `http://127.0.0.1:${PORTA_API}`;

const banco = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await banco.connect();

// ── Trava 1: so em banco de teste ──
const { rows: [trava] } = await banco.query(
  `select count(*)::int n from agendamentos where source = 'seed-teste'`,
);
if (!trava.n) {
  console.error("RECUSADO: este banco nao tem o seed de teste. Nao rodo fora dele.");
  await banco.end();
  process.exit(2);
}
console.log(`banco de teste confirmado (${trava.n} agendamentos de seed)\n`);

// ── Trava 2: guarda os donos reais ──
const { rows: donosOriginais } = await banco.query(`select slug, user_id from barbearias`);

const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), kid: "teste", alg: "ES256", use: "sig" };
const emissor = createServer((_q, r) => {
  r.setHeader("content-type", "application/json");
  r.end(JSON.stringify({ keys: [jwk] }));
}).listen(PORTA_JWKS);

const criados = [];
let servidor;
const falhas = [];
const ok = (nome, cond, det) => {
  console.log(`  ${cond ? "ok    " : "FALHOU"} ${nome}${det ? ` — ${det}` : ""}`);
  if (!cond) falhas.push(nome);
};

try {
  for (const _ of [0, 1]) {
    const { rows: [u] } = await banco.query(
      `insert into auth.users (id) values (gen_random_uuid()) returning id`,
    );
    criados.push(u.id);
  }
  const [donoA, donoB] = criados;
  await banco.query(`update barbearias set user_id = $1 where slug = 'lucas-costa'`, [donoA]);
  await banco.query(`update barbearias set user_id = $1 where slug = 'central-teste'`, [donoB]);

  const assinar = (sub, chave = privateKey, extra = {}) =>
    new SignJWT({ role: "authenticated", ...extra })
      .setProtectedHeader({ alg: "ES256", kid: "teste" })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(chave);

  servidor = spawn("node", ["server.js"], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORT: String(PORTA_API),
      SUPABASE_JWKS_URL: `http://127.0.0.1:${PORTA_JWKS}/jwks`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  servidor.stdout.on("data", (d) => (log += d));
  servidor.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${API}/`); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  ok("servidor subiu em modo JWT", /"modo":"jwt"/.test(log));

  const pedir = async (caminho, { token, metodo = "GET", corpo } = {}) => {
    const r = await fetch(API + caminho, {
      method: metodo,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(corpo ? { "content-type": "application/json" } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  const tokenA = await assinar(donoA);
  const tokenB = await assinar(donoB);
  const periodo = "?from=2000-01-01&to=2100-01-01";
  const { rows: [conta] } = await banco.query(`
    select
      (select count(*)::int from agendamentos a join barbearias b on b.id=a.barbearia_id where b.slug='lucas-costa') ag_a,
      (select count(*)::int from agendamentos a join barbearias b on b.id=a.barbearia_id where b.slug='central-teste') ag_b,
      (select p.id from profissionais p join barbearias b on b.id=p.barbearia_id where b.slug='lucas-costa' order by p.id limit 1) prof_a,
      (select p.id from profissionais p join barbearias b on b.id=p.barbearia_id where b.slug='central-teste' order by p.id limit 1) prof_b`);

  // ── Painel: RLS ──
  console.log("\npainel (RLS pela sessao):");
  let r = await pedir("/agendamentos" + periodo, { token: tokenA });
  ok(`dono A ve so os ${conta.ag_a} agendamentos dele`, r.corpo?.length === conta.ag_a, `viu ${r.corpo?.length}`);
  r = await pedir("/agendamentos" + periodo, { token: tokenB });
  ok(`dono B ve so os ${conta.ag_b} dele`, r.corpo?.length === conta.ag_b, `viu ${r.corpo?.length}`);
  r = await pedir("/profissionais", { token: tokenA });
  ok("painel resolve a barbearia pela sessao, sem slug", r.status === 200 && r.corpo?.every?.((p) => p.nome !== "Ana Ribeiro"), `HTTP ${r.status}`);
  r = await pedir("/servicos", { token: tokenA });
  ok('o discriminador: "SO DA LOJA B" nao aparece para A', !JSON.stringify(r.corpo).includes("LOJA B"));

  const telefoneB = "554888880001";
  r = await pedir(`/clientes/buscar?telefone=${telefoneB}`, { token: tokenB });
  ok("clientes/buscar: B acha o proprio cliente", r.corpo?.encontrado === true);
  r = await pedir(`/clientes/buscar?telefone=${telefoneB}`, { token: tokenA });
  ok("clientes/buscar: A NAO acha o cliente da B", r.corpo?.encontrado === false, JSON.stringify(r.corpo));

  const novo = await pedir("/profissionais", { token: tokenB, metodo: "POST", corpo: { nome: "Teste Verificacao", cor: "#123456" } });
  ok("dono B cria profissional (sem 42501)", novo.status === 201, `HTTP ${novo.status}`);
  if (novo.status === 201) {
    const { rows: [onde] } = await banco.query(
      `select b.slug from profissionais p join barbearias b on b.id=p.barbearia_id where p.id=$1`, [novo.corpo.id]);
    ok("e ele cai na loja B", onde?.slug === "central-teste", onde?.slug);
    await banco.query(`delete from profissionais where id = $1`, [novo.corpo.id]);
  }

  // ── Tokens recusados ──
  console.log("\ntokens recusados:");
  ok("sem token -> 401", (await pedir("/agendamentos" + periodo)).status === 401);
  if (process.env.ADMIN_API_TOKEN)
    ok("ADMIN_API_TOKEN antigo -> 401", (await pedir("/agendamentos" + periodo, { token: process.env.ADMIN_API_TOKEN })).status === 401);
  ok("role=anon -> 401", (await pedir("/agendamentos" + periodo, { token: await assinar(donoA, privateKey, { role: "anon" }) })).status === 401);
  const { privateKey: outra } = await generateKeyPair("ES256", { extractable: true });
  ok("assinado com outra chave -> 401", (await pedir("/agendamentos" + periodo, { token: await assinar(donoA, outra) })).status === 401);

  // ── Rotas publicas ──
  console.log("\nrotas publicas (slug obrigatorio):");
  ok("sem slug e sem sessao -> 400", (await pedir("/profissionais")).status === 400);
  ok("slug inexistente -> 404", (await pedir("/profissionais?barbearia=nao-existe")).status === 404);
  r = await pedir("/servicos?barbearia=lucas-costa");
  ok("loja A pelo slug nao ve servico da B", !JSON.stringify(r.corpo).includes("LOJA B"));
  for (const rota of [
    `/profissionais/${conta.prof_b}/agenda`,
    `/profissionais/${conta.prof_b}/agenda-config`,
    `/profissionais/${conta.prof_b}/dias-bloqueados`,
    `/agendamentos/dias-disponiveis?professionalId=${conta.prof_b}`,
  ]) {
    const x = await pedir(rota + (rota.includes("?") ? "&" : "?") + "barbearia=lucas-costa");
    ok(`profissional da B pelo slug da A -> 404: ${rota.split("?")[0]}`, x.status === 404, `HTTP ${x.status}`);
  }
  ok("verificar-telefone nao vaza entre lojas",
    (await pedir(`/agendamentos/verificar-telefone?phone=${telefoneB}&barbearia=lucas-costa`)).corpo?.exists === false);

  const grade = await pedir(`/agendamentos/dias-disponiveis?professionalId=${conta.prof_a}&barbearia=lucas-costa`);
  const dia = grade.corpo?.openDays?.find((d) => d.availableSlotsCount > 0);
  if (dia) {
    const livres = await pedir(`/agendamentos/horarios-disponiveis?professionalId=${conta.prof_a}&date=${dia.date}&barbearia=lucas-costa`);
    const hora = livres.corpo?.availableSlots?.[0];
    r = await pedir("/agendamentos", { metodo: "POST", corpo: {
      barbearia: "lucas-costa", cliente: "Verificacao", profissional_id: conta.prof_a,
      servico: "Corte", dia_marcado: dia.date, hora_marcada: hora, source: "verificacao-isolamento" } });
    ok("POST /agendamentos valido -> 201", r.status === 201, `HTTP ${r.status} ${r.corpo?.error ?? ""}`);
    const dup = await pedir("/agendamentos", { metodo: "POST", corpo: {
      barbearia: "lucas-costa", cliente: "Duplicado", profissional_id: conta.prof_a,
      servico: "Corte", dia_marcado: dia.date, hora_marcada: hora, source: "verificacao-isolamento" } });
    ok("mesmo horario de novo -> 409", dup.status === 409, `HTTP ${dup.status}`);
  } else {
    ok("havia vaga para testar o POST", false, "nenhum dia com vaga na janela");
  }
} finally {
  servidor?.kill();
  emissor.close();
  await banco.query(`delete from agendamentos where source = 'verificacao-isolamento'`).catch(() => {});
  for (const { slug, user_id } of donosOriginais) {
    await banco.query(`update barbearias set user_id = $1 where slug = $2`, [user_id, slug]).catch(() => {});
  }
  if (criados.length) await banco.query(`delete from auth.users where id = any($1)`, [criados]).catch(() => {});
  await banco.end();
  console.log("\nlimpeza: donos originais devolvidos, dados de teste removidos.");
}

console.log(falhas.length ? `\nRESULTADO: ${falhas.length} FALHA(S) — ${falhas.join("; ")}` : "\nRESULTADO: todas passaram.");
process.exit(falhas.length ? 1 : 0);
