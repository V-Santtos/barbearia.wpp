import { createRemoteJWKSet, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";

/**
 * Autenticacao do painel do dono, e a ponte entre o JWT e a RLS do Postgres.
 *
 * Ate 09/2026 esta API tinha UM segredo compartilhado (`ADMIN_API_TOKEN`) que viajava
 * no bundle do painel — quem abrisse o DevTools tinha acesso total. E o banco, embora
 * com RLS ligada nas 10 tabelas, nao era protegido por ela: a conexao usa `postgres`,
 * que tem `rolbypassrls`, entao politica nenhuma se aplicava.
 *
 * Aqui as duas coisas se resolvem juntas, porque sao a mesma: o JWT diz QUEM e, e o
 * `set local role` faz o Postgres passar a cobrar isso.
 *
 * ── O MODO LEGADO, e por que ele existe ──────────────────────────────────────
 *
 * Sem `SUPABASE_JWKS_URL` configurada, o guard cai no token compartilhado de antes.
 * Nao e indecisao: e o que permite subir este codigo sem dia-D. Deploy e configuracao
 * sao gestos separados (a Vercel aqui e deploy manual por CLI), entao um guard que
 * exigisse JWT no instante do deploy deixaria o painel fora do ar ate a ultima variavel
 * entrar.
 *
 * TEM DATA PRA MORRER: assim que o modo JWT estiver de pe em producao, o ramo legado
 * sai daqui junto com `ADMIN_API_TOKEN`. Enquanto existir, ele avisa no log a cada
 * inicializacao — divida silenciosa e divida que fica.
 */

const JWKS_URL = (process.env.SUPABASE_JWKS_URL || "").trim();
const JWT_ISSUER = (process.env.SUPABASE_JWT_ISSUER || "").trim();

export const MODO_JWT = Boolean(JWKS_URL);

// `createRemoteJWKSet` cacheia as chaves e so vai na rede quando aparece um `kid`
// desconhecido (rotacao). Criar UMA vez, no modulo: um por requisicao anularia o
// cache e transformaria todo request numa ida a internet.
const jwks = MODO_JWT ? createRemoteJWKSet(new URL(JWKS_URL)) : null;

export function avisarModo(log) {
  if (MODO_JWT) {
    log.info({ evento: "auth.modo", modo: "jwt", jwks: JWKS_URL });
  } else {
    log.warn({
      evento: "auth.modo",
      modo: "legado",
      aviso:
        "SUPABASE_JWKS_URL nao configurada: o painel ainda entra com ADMIN_API_TOKEN, " +
        "que viaja no bundle e da acesso a TODAS as barbearias. A RLS nao protege nada " +
        "neste modo. Configurar o JWT encerra isto.",
    });
  }
}

/**
 * Verifica o token do Supabase Auth e devolve o `sub` (o uuid do usuario).
 *
 * `jwtVerify` cobre assinatura, `exp` e `nbf`. O `issuer` so e cobrado quando
 * configurado — o valor certo sai do painel do Supabase, e cobrar um valor errado
 * derrubaria todo login com uma mensagem que aponta pro lugar errado.
 */
async function lerToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
  });

  // `role` vem do Supabase e distingue usuario logado de chave anonima. Um token
  // `anon` e valido e assinado — e nao pode virar sessao de dono.
  if (payload.role !== "authenticated") {
    throw new Error(`token com role "${payload.role}", esperado "authenticated"`);
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("token sem `sub`");
  }

  return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

function tokenDaRequisicao(request) {
  const cru = request.headers.authorization;
  const cabecalho = Array.isArray(cru) ? cru[0] : cru;
  if (cabecalho?.toLowerCase().startsWith("bearer ")) return cabecalho.slice(7).trim();

  const alternativo = request.headers["x-admin-token"];
  return String(Array.isArray(alternativo) ? alternativo[0] : (alternativo ?? "")).trim();
}

function iguaisEmTempoConstante(a, b) {
  const esquerda = Buffer.from(String(a));
  const direita = Buffer.from(String(b));
  if (esquerda.length !== direita.length) return false;
  return timingSafeEqual(esquerda, direita);
}

/**
 * O preHandler das rotas do painel. Em modo JWT, deixa `request.usuario` pronto para
 * o `comUsuario`; em modo legado, `request.usuario` fica `null` e o acesso segue
 * irrestrito, como sempre foi.
 */
export function criarGuardaDoPainel() {
  return async function guardaDoPainel(request, reply) {
    if (!MODO_JWT) {
      const esperado = process.env.ADMIN_API_TOKEN?.trim();
      if (!esperado) {
        return reply.status(503).send({ error: "ADMIN_API_TOKEN nao configurado." });
      }
      const recebido = tokenDaRequisicao(request);
      if (!recebido || !iguaisEmTempoConstante(recebido, esperado)) {
        return reply.status(401).send({ error: "Nao autorizado." });
      }
      request.usuario = null;
      return;
    }

    const token = tokenDaRequisicao(request);
    if (!token) return reply.status(401).send({ error: "Nao autorizado." });

    try {
      request.usuario = await lerToken(token);
    } catch (erro) {
      // O motivo vai pro log e NAO pra resposta: dizer ao cliente se o token expirou,
      // se a assinatura falhou ou se o `sub` sumiu e entregar mapa de sondagem.
      request.log.warn({ evento: "auth.token.recusado", motivo: erro.message });
      return reply.status(401).send({ error: "Nao autorizado." });
    }
  };
}

/**
 * Roda `fn` com o Postgres enxergando o usuario da requisicao — e, por consequencia,
 * com a RLS valendo.
 *
 * TRES coisas fazem isso funcionar, e faltar qualquer uma silencia o isolamento:
 *
 *  1. **Transacao.** `set local` so existe dentro de uma; fora dela o `set` vazaria
 *     para a proxima requisicao que pegasse a mesma conexao do pool — o pior tipo de
 *     bug, porque o vazamento seria intermitente e dependeria de concorrencia.
 *  2. **`set local role authenticated`.** O bypass de RLS e propriedade do papel
 *     CORRENTE. E por isso que o pool precisa conectar como `app_api` (sem bypass) e
 *     nao como `postgres`: se alguem esquecer esta linha num caminho novo, com
 *     `app_api` a consulta devolve ZERO linhas — falha fechada, visivel. Com
 *     `postgres`, devolveria o banco inteiro, calada.
 *  3. **`request.jwt.claims`.** E daqui que `auth.uid()` le o `sub` (conferido no
 *     `prosrc` da funcao, nao suposto), e e `auth.uid()` que `barbearia_atual()` usa.
 */
export async function comUsuario(pool, request, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query("set local role authenticated");
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: request.usuario.sub, role: "authenticated" }),
    ]);

    const saida = await fn(cliente);
    await cliente.query("commit");
    return saida;
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    // `reset role` antes de devolver ao pool: `set local` ja morre no commit, mas a
    // conexao volta pra fila e nao pode carregar resto de contexto por acidente.
    await cliente.query("reset role").catch(() => undefined);
    cliente.release();
  }
}
