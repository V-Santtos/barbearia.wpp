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

// ── Trava 3: fotografa o que o teste de configuracoes vai alterar ──
// Catalogo, categorias e configuracao da pagina das DUAS lojas. Se o isolamento
// falhar e a loja A conseguir mexer na B, a limpeza devolve a B como estava — o
// teste nao pode deixar como rastro justamente o estrago que veio medir.
const foto = {
  servicos: (await banco.query(
    `select id, nome, descricao, preco, categoria_id, slug, ordem, ativo from servicos`)).rows,
  categorias: (await banco.query(`select id, rotulo, ativa, ordem from categorias_servicos`)).rows,
  config: (await banco.query(`select * from configuracoes_site`)).rows,
};

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

// ── A limpeza, num lugar so ──
//
// Chamada no fim E ao receber SIGINT/SIGTERM. Em 28/09/2026 rodadas interrompidas no
// meio pularam o `finally`: a loja ficou ligada a um dono falso, o dono real
// desligado e oito usuarios de teste orfaos no banco. `kill -9` continua sem remedio —
// nada roda depois dele —, mas Ctrl+C e `timeout` agora limpam.
let limpo = false;
async function limpar() {
  if (limpo) return;
  limpo = true;
  servidor?.kill();
  emissor.close();
  await banco.query(`delete from agendamentos where source = 'verificacao-isolamento'`).catch(() => {});
  await banco.query(`delete from profissionais where nome = 'Teste Verificacao'`).catch(() => {});
  // Configuracoes do site: servicos primeiro (apontam para categorias), depois as
  // categorias, depois a linha de configuracao.
  const idsServicos = foto.servicos.map((sv) => sv.id);
  await banco.query(`delete from servicos where not (id = any($1))`, [idsServicos]).catch(() => {});
  for (const sv of foto.servicos) {
    await banco.query(
      `update servicos set nome=$2, descricao=$3, preco=$4, categoria_id=$5, slug=$6, ordem=$7, ativo=$8 where id=$1`,
      [sv.id, sv.nome, sv.descricao, sv.preco, sv.categoria_id, sv.slug, sv.ordem, sv.ativo],
    ).catch(() => {});
  }
  await banco.query(`delete from categorias_servicos where not (id = any($1))`,
    [foto.categorias.map((c) => c.id)]).catch(() => {});
  for (const c of foto.categorias) {
    await banco.query(`update categorias_servicos set rotulo=$2, ativa=$3, ordem=$4 where id=$1`,
      [c.id, c.rotulo, c.ativa, c.ordem]).catch(() => {});
  }
  await banco.query(`delete from configuracoes_site`).catch(() => {});
  for (const c of foto.config) {
    await banco.query(
      `insert into configuracoes_site (barbearia_id, titulo_linha1, nome_destaque, texto_botao, filtro_categorias, atualizado_em)
       values ($1,$2,$3,$4,$5,$6)`,
      [c.barbearia_id, c.titulo_linha1, c.nome_destaque, c.texto_botao, c.filtro_categorias, c.atualizado_em],
    ).catch(() => {});
  }
  for (const { slug, user_id } of donosOriginais) {
    await banco.query(`update barbearias set user_id = $1 where slug = $2`, [user_id, slug]).catch(() => {});
  }
  if (criados.length) await banco.query(`delete from auth.users where id = any($1)`, [criados]).catch(() => {});
  await banco.end().catch(() => {});
  console.log("\nlimpeza: donos originais devolvidos, dados de teste removidos.");
}
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, async () => {
    console.log(`\n${sinal} recebido — limpando antes de sair.`);
    await limpar();
    process.exit(130);
  });
}

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
      // Prazo por requisicao. Sem ele, uma rota que nunca responde deixa o script
      // esperando para sempre — e quem mata o processo na mao pula a limpeza.
      signal: AbortSignal.timeout(15_000),
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

  // ── Configuracoes do site (29/09/2026) ──
  console.log("\nconfiguracoes do site:");
  const servicosDe = async (slug) => (await banco.query(
    `select s.id, s.nome, s.ativo from servicos s join barbearias b on b.id=s.barbearia_id where b.slug=$1 order by s.id`,
    [slug])).rows;

  r = await pedir("/configuracao/home?barbearia=central-teste");
  ok("site le a pagina inicial pelo slug", r.status === 200 && !!r.corpo?.heroName, `HTTP ${r.status}`);
  const homeB = r.corpo;

  r = await pedir("/configuracao/home", { token: tokenA, metodo: "PUT",
    corpo: { heroLine1: "Teste", heroName: "Loja A Verificacao", ctaLabel: "Marcar" } });
  ok("dono A grava a propria pagina inicial", r.status === 200, `HTTP ${r.status}`);
  ok("e a loja A passa a ler o texto novo",
    (await pedir("/configuracao/home", { token: tokenA })).corpo?.heroName === "Loja A Verificacao");
  ok("a pagina da loja B nao mudou",
    (await pedir("/configuracao/home?barbearia=central-teste")).corpo?.heroName === homeB.heroName);
  ok("sem nome da barbearia -> 400", (await pedir("/configuracao/home", { token: tokenA, metodo: "PUT",
    corpo: { heroLine1: "x", heroName: "", ctaLabel: "x" } })).status === 400);

  const catsA = (await pedir("/categorias-servicos", { token: tokenA })).corpo;
  ok("categorias da A pela sessao", catsA?.items?.length >= 1, `${catsA?.items?.length} categorias`);
  r = await pedir("/categorias-servicos", { token: tokenA, metodo: "PUT",
    corpo: { filtersEnabled: true, items: [...catsA.items, { id: "teste-verif", label: "Teste", active: true }] } });
  ok("dono A cria categoria", r.status === 200 && r.corpo?.items?.some((c) => c.id === "teste-verif"), `HTTP ${r.status}`);
  const catsB = (await pedir("/categorias-servicos?barbearia=central-teste")).corpo;
  ok("mesmo slug 'cabelo' nas duas lojas, sem colisao",
    catsA.items.some((c) => c.id === "cabelo") && catsB.items.some((c) => c.id === "cabelo"));
  ok("a categoria nova nao aparece na loja B", !catsB.items.some((c) => c.id === "teste-verif"));

  const antesA = await servicosDe("lucas-costa");
  const listaA = (await pedir("/servicos", { token: tokenA })).corpo;
  r = await pedir("/servicos", { token: tokenA, metodo: "PUT", corpo: [...listaA,
    { id: -1, name: "Verificacao Servico", desc: "teste", category: "teste-verif", price: "12,50" }] });
  const criado = r.corpo?.find?.((sv) => sv.name === "Verificacao Servico");
  ok("servico novo volta com id REAL", r.status === 200 && criado?.id > 0, `HTTP ${r.status}, id ${criado?.id}`);
  ok("preco com virgula gravado como decimal", criado?.price === "12.50", criado?.price);

  // O bug que o mock escondia: salvar de novo a lista devolvida nao pode duplicar.
  r = await pedir("/servicos", { token: tokenA, metodo: "PUT", corpo: r.corpo });
  const duplicados = (await servicosDe("lucas-costa")).filter((sv) => sv.nome === "Verificacao Servico");
  ok("salvar de novo NAO duplica o servico", duplicados.length === 1, `${duplicados.length} copia(s)`);

  r = await pedir("/servicos", { token: tokenA, metodo: "PUT",
    corpo: r.corpo.filter((sv) => sv.name !== "Verificacao Servico") });
  const removido = (await servicosDe("lucas-costa")).find((sv) => sv.nome === "Verificacao Servico");
  ok("servico retirado da lista e DESATIVADO, nao apagado", removido && removido.ativo === false,
    removido ? `ativo=${removido.ativo}` : "apagado");

  const [servicoB] = await servicosDe("central-teste");
  r = await pedir("/servicos", { token: tokenA, metodo: "PUT", corpo: [...listaA,
    { id: servicoB.id, name: "Sequestrado", desc: "x", category: "cabelo", price: "1" }] });
  ok("A NAO edita servico da B pelo id -> 400", r.status === 400, `HTTP ${r.status}`);
  ok("e o servico da B continua intacto", (await servicosDe("central-teste"))[0].nome === servicoB.nome);
  const depoisA = await servicosDe("lucas-costa");
  ok("e a tentativa nao gravou nada pela metade na loja A",
    depoisA.filter((sv) => sv.ativo).length === antesA.filter((sv) => sv.ativo).length);

  r = await pedir("/categorias-servicos", { token: tokenA, metodo: "PUT",
    corpo: { filtersEnabled: true, items: catsA.items.filter((c) => c.id !== "cabelo") } });
  ok("categoria com servico ativo nao pode sumir -> 409", r.status === 409, `HTTP ${r.status}`);

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
} catch (erro) {
  falhas.push(`erro inesperado: ${erro.message}`);
  console.log(`\n  ERRO ${erro.message}`);
} finally {
  await limpar();
}

console.log(falhas.length ? `\nRESULTADO: ${falhas.length} FALHA(S) — ${falhas.join("; ")}` : "\nRESULTADO: todas passaram.");
process.exit(falhas.length ? 1 : 0);
