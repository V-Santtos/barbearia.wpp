// PRIMEIRO import, e a posicao e o conserto. Em ES modules os `import` executam
// antes do corpo do arquivo; com `dotenv.config()` no corpo, o `lib/autenticacao.js`
// lia `SUPABASE_JWKS_URL` antes de o `.env` existir e subia SEMPRE em modo legado.
// So localmente, e em silencio: na Vercel as variaveis sao do processo e o bug nao
// aparece. Achado em 28/09/2026 pelo aviso de modo na subida.
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { timingSafeEqual } from "crypto";
import pkg from "pg";
import {
  MODO_JWT,
  avisarModo,
  comUsuario,
  criarGuardaDoPainel,
} from "./lib/autenticacao.js";


// O relogio do processo, fixado antes de qualquer `new Date()`.
//
// `isWithinBookingWindow` e `isAfterMinimumNotice` perguntam a hora ao processo,
// nao ao banco. Na VPS do sistema antigo isso funcionava porque a maquina era de
// Brasilia; num host UTC (o padrao em plataforma de deploy) a antecedencia minima
// de 15 min e a virada do dia ficam 3 horas fora — sem erro e sem log, so
// oferecendo ou recusando horario errado.
//
// Corrigir aqui em vez de nas quatro funcoes de data: elas ja estao certas desde
// que o relogio esteja.
//
// ATENCAO AO QUE ESTA LINHA JA FOI. Ela era:
//
//     process.env.TZ = process.env.TZ || "America/Sao_Paulo";
//
// A intencao era "respeitar o fuso do ambiente quando houver". Em serverless isso
// se vira contra: a Vercel define `TZ=UTC` sozinha, "UTC" e truthy, e o fallback
// NUNCA aplicava. O servico rodou tres horas adiantado em producao (01/09/2026).
//
// O sintoma nao parecia de fuso: `horarios-disponiveis` devolvia lista VAZIA para
// hoje e cheia para amanha. As 16h58 de Brasilia o servidor achava que eram 19h58,
// entao todo horario do dia caia atras da antecedencia minima de 15 min — sem erro,
// sem log, so a barbearia perdendo as tres ultimas horas de agenda todo dia.
//
// `TZ` e nome RESERVADO na Vercel e nao pode ser definido por variavel de ambiente
// (a API recusa). Entao o fuso e cravado aqui, e a porta para uma barbearia em
// outro fuso fica num nome proprio, que a plataforma nao toca.
//
// Nota: o bot (BARBEARIA/) nunca teve esse problema. Ele nao pergunta a hora ao
// processo — passa o fuso explicito no SQL (`now() at time zone $2`). Quando as
// duas metades do sistema discordam de metodo, a que confia no relogio do processo
// e a que quebra ao mudar de host.
process.env.TZ = process.env.FUSO_BARBEARIA || "America/Sao_Paulo";

const { Pool } = pkg;

// `idleTimeoutMillis: 0` — conexao aberta nunca e fechada por ociosidade.
//
// O padrao do `pg` e 10s, e ele derrubou o bot em 2026-08-01. Esta API responde em
// ~200ms com a conexao de pe, mas o Supabase esta na internet e reabrir custa ~2s.
// Com o pool esvaziando a cada 10s parados, uma rajada normal (o painel do dono
// fazendo polling + o espelho da conversa gravando + o bot perguntando os dias)
// abria varias conexoes ao mesmo tempo, e as chamadas empilhavam: 1,6s, 2,2s,
// 4,6s, 5,5s e por fim 8,7s no `GET /agendamentos/dias-disponiveis`. O bot desiste
// em 8s, entao o cliente leu "nao consegui abrir a agenda" com a agenda no ar.
//
// `max_connections` do Supabase e 60 e `idle_session_timeout` e 0 (ele nunca
// derruba sessao parada), entao manter estas dez de pe nao aperta nada.
//
// Nada disso vale em serverless: la nao existe UM processo de pe, existem N
// instancias que a plataforma cria e mata sozinha. Dez conexoes eternas vezes N
// estoura o teto de 60 do Supabase, e quem cai junto e o bot, que bebe do mesmo
// banco. Por isso, sob VERCEL, o pool encolhe e volta a soltar conexao ociosa.
const EM_SERVERLESS = Boolean(process.env.VERCEL);

const opcoesDePool = {
  ssl: { rejectUnauthorized: false },
  max: EM_SERVERLESS ? 2 : 10,
  idleTimeoutMillis: EM_SERVERLESS ? 10_000 : 0,
  keepAlive: true,
};

// O pool de SERVICO: conecta como `postgres`, que tem `rolbypassrls`. E dele que saem
// as rotas publicas (site e bot), que sao anonimas por natureza — nao ha identidade em
// que ancorar politica de RLS, entao o recorte por barbearia e explicito no codigo.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...opcoesDePool,
});

// O pool do PAINEL: conecta como `app_api`, que NAO tem bypass de RLS. Toda rota do
// dono passa por aqui, dentro de `comUsuario`, e o Postgres cobra a barbearia.
//
// A diferenca entre os dois pools e o que faz o esquecimento falhar FECHADO. Se uma
// rota nova do painel usar o pool errado ou esquecer o `set local role`, ela devolve
// zero linhas em vez de devolver o banco inteiro calada.
//
// Sem `DATABASE_URL_APP` ele cai no mesmo destino do outro. Isso mantem o servidor de
// pe antes da variavel existir — mas nesse estado a RLS nao protege nada, e e por isso
// que `avisarModo` grita na subida.
const poolUsuario = new Pool({
  connectionString: process.env.DATABASE_URL_APP || process.env.DATABASE_URL,
  ...opcoesDePool,
});

/**
 * Abre as conexoes na subida, em paralelo, em vez de deixar a conta pro primeiro
 * cliente. Quatro porque e o tamanho da rajada real medida: painel + espelho + bot.
 *
 * Falhar aqui nao derruba o servidor — sem banco cada rota ja responde 500 com o
 * motivo, o que e mais util que uma subida que morre calada.
 */
async function aquecerPool(quantidade = 4) {
  const conexoes = await Promise.allSettled(
    Array.from({ length: quantidade }, async () => {
      const client = await pool.connect();
      try {
        await client.query("select 1");
      } finally {
        client.release();
      }
    }),
  );

  return conexoes.filter((r) => r.status === "fulfilled").length;
}

const BOOKED_STATUSES = ["agendado", "reagendado", "confirmado"];
const BLOCK_PERIODS = ["morning", "afternoon", "night"];
const MIN_BOOKING_NOTICE_MIN = 15;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 30);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const EFFECTIVE_RATE_LIMIT_WINDOW_MS =
  Number.isFinite(RATE_LIMIT_WINDOW_MS) && RATE_LIMIT_WINDOW_MS > 0
    ? RATE_LIMIT_WINDOW_MS
    : 60_000;
const DEFAULT_AGENDA = {
  dias_semana: [1, 2, 3, 4, 5, 6],
  hora_inicio: "08:00",
  hora_fim: "19:00",
  duracao_min: 60,
  intervalo_inicio: null,
  intervalo_duracao_min: null,
  janela_agendamento_dias: 10,
};

// 3334, nao 3333: a 3333 e do bot de WhatsApp (BARBEARIA), e a integracao precisa
// dos dois servicos no ar ao mesmo tempo.
const PORT = process.env.PORT || 3334;

// Como esta API manda o dono falar no WhatsApp. Quem tem o token da Meta e o bot,
// e so ele: pedir que ele envie evita uma segunda implementacao do payload da Cloud
// API vivendo aqui. Sem barra no fim — quem monta o caminho concatena.
const BOT_URL = (process.env.BOT_URL || "http://localhost:3333").replace(
  /\/+$/,
  "",
);
// Segredo DIFERENTE do WHATSAPP_WEBHOOK_TOKEN, que protege a direcao contraria.
// Vazio => `/send` responde 503 dizendo o que falta, em vez de 500 sem pista.
const BOT_PAINEL_TOKEN = (process.env.BOT_PAINEL_TOKEN || "").trim();
// So a porta do painel do calendario. A 3001 saiu junto com o site publico.
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];
const ALLOWED_CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(process.env.CORS_ORIGINS ? [] : DEFAULT_CORS_ORIGINS),
);
const rateLimitBuckets = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Telefone canônico: só dígitos, com DDI (`5533990223209`). 10/11 dígitos é
// número brasileiro sem o 55. Devolve as formas do mesmo número para procurar,
// com e sem o nono dígito. Cópia de `lib/telefone.ts` (este arquivo não importa
// TypeScript) -- mudar lá é mudar aqui.
function variantesDeBusca(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return [];
  const canonico =
    digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  const variantes = new Set([canonico]);
  if (canonico.startsWith("55") && (canonico.length === 12 || canonico.length === 13)) {
    const ddd = canonico.slice(2, 4);
    const resto = canonico.slice(4);
    if (resto.length === 9 && resto.startsWith("9")) variantes.add(`55${ddd}${resto.slice(1)}`);
    if (resto.length === 8) variantes.add(`55${ddd}9${resto}`);
  }
  return [...variantes];
}

function fmtTime(val) {
  return String(val ?? "").substring(0, 5);
}

function getHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestToken(request) {
  const authorization = getHeaderValue(request.headers.authorization);
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return (
    getHeaderValue(request.headers["x-admin-token"]) ??
    getHeaderValue(request.headers["x-webhook-token"]) ??
    ""
  ).trim();
}

function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function buildTokenGuard(envName, label) {
  return async function tokenGuard(request, reply) {
    const expected = process.env[envName]?.trim();
    if (!expected) {
      return reply.status(503).send({ error: `${label} nao configurado.` });
    }

    const provided = getRequestToken(request);
    if (!provided || !constantTimeEquals(provided, expected)) {
      return reply.status(401).send({ error: "Nao autorizado." });
    }
  };
}

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_CORS_ORIGINS.has(origin);
}

function getRateLimitPolicy(request) {
  const method = request.method.toUpperCase();
  const path = request.url.split("?")[0];

  if (method === "POST" && path === "/agendamentos")
    return { max: 10, label: "booking" };
  if (method === "GET" && path === "/agendamentos/verificar-telefone") {
    return { max: 20, label: "phone-check" };
  }
  // O espelho da conversa entra por aqui, e quem chama e o bot: UM IP atendendo
  // todos os clientes da barbearia. Um agendamento inteiro gera ~14 chamadas (cada
  // mensagem do cliente e cada resposta do bot), entao o teto antigo de 30/min
  // estourava com dois clientes conversando no mesmo minuto — e o terceiro sumiria
  // do painel sem ninguem notar, porque o espelho falha em silencio de proposito.
  // A rota e protegida por token, entao o balde estreito defendia pouco.
  if (method === "POST" && path === "/whatsapp/events")
    return { max: 600, label: "whatsapp-webhook" };
  if (path.startsWith("/whatsapp/")) {
    // Leitura (polling do CRM) tem balde proprio e generoso para nao
    // esgotar quando varias abas/o painel estao abertos.
    if (method === "GET") return { max: 240, label: "whatsapp-read" };
    // Escrita (enviar, marcar como lida) fica num balde separado, modesto,
    // pra que o polling de leitura NUNCA consiga starvar o envio.
    return { max: 40, label: "whatsapp-write" };
  }

  const adminWriteMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (adminWriteMethods.includes(method))
    return { max: RATE_LIMIT_MAX, label: "admin-write" };
  if (method === "GET" && path === "/agendamentos")
    return { max: RATE_LIMIT_MAX, label: "admin-read" };

  return null;
}

function rateLimitKey(request, policy) {
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  const ip = String(
    forwardedFor ?? request.ip ?? request.socket?.remoteAddress ?? "unknown",
  )
    .split(",")[0]
    .trim();
  return `${policy.label}:${ip}`;
}

async function applyBasicRateLimit(request, reply) {
  const policy = getRateLimitPolicy(request);
  if (!policy) return;

  const now = Date.now();
  const windowMs = EFFECTIVE_RATE_LIMIT_WINDOW_MS;
  const max = Number.isFinite(policy.max) && policy.max > 0 ? policy.max : 30;
  const key = rateLimitKey(request, policy);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count <= max) return;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  reply.header("Retry-After", String(Math.max(retryAfter, 1)));
  return reply
    .status(429)
    .send({ error: "Muitas tentativas. Tente novamente em instantes." });
}

setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
    }
  },
  Math.min(Math.max(EFFECTIVE_RATE_LIMIT_WINDOW_MS, 10_000), 60_000),
).unref?.();

function fmtDate(val) {
  return String(val ?? "").substring(0, 10);
}

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const [h, m] = fmtTime(time).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const total = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Faixa 4..10, espelhando o CHECK da tabela. O teto e o limite de linhas de uma
// lista do WhatsApp: acima de 10 a Meta recusa a mensagem inteira e o cliente fica
// sem resposta. Prender aqui e o que permite o bot pedir os dias sem `days=` e
// confiar no que voltar.
const JANELA_MIN_DIAS = 4;
const JANELA_MAX_DIAS = 10;

function normalizeBookingWindowDays(
  value,
  fallback = DEFAULT_AGENDA.janela_agendamento_dias,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), JANELA_MIN_DIAS), JANELA_MAX_DIAS);
}

function isWithinBookingWindow(date, windowDays) {
  const normalizedWindowDays = normalizeBookingWindowDays(windowDays);
  const [year, month, day] = String(date).split("-").map(Number);
  if (!year || !month || !day) return false;

  const target = new Date(year, month - 1, day, 0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastAllowed = new Date(today);
  lastAllowed.setDate(today.getDate() + normalizedWindowDays - 1);

  return target >= today && target <= lastAllowed;
}

function isUndefinedColumnError(err) {
  return err?.code === "42703";
}

// `toISOString()` devolve UTC, e no Brasil isso vira o dia SEGUINTE a partir das
// 21:00 — o dashboard mostraria "hoje" errado justo no fim do expediente. Estas
// duas trabalham no fuso de quem roda o processo, como o front ja faz com
// `toLocaleDateString("en-CA")`.
function dataLocalISO(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function somarDias(dateISO, dias) {
  const [year, month, day] = String(dateISO).split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + dias);
  return dataLocalISO(d);
}

function getBreakWindow(config) {
  if (!config?.intervalo_inicio || !config?.intervalo_duracao_min) return null;
  const start = timeToMinutes(config.intervalo_inicio);
  const end = start + Number(config.intervalo_duracao_min);
  return { start, end };
}

function overlapsBreak(slotStart, duracaoMin, breakWindow) {
  if (!breakWindow) return false;
  const start = timeToMinutes(slotStart);
  const end = start + Number(duracaoMin);
  return start < breakWindow.end && end > breakWindow.start;
}

function normalizePeriods(periodos) {
  if (!Array.isArray(periodos)) return null;
  const unique = [...new Set(periodos)].filter((period) =>
    BLOCK_PERIODS.includes(period),
  );
  return unique.length ? unique : [];
}

function slotPeriod(slotStart, config) {
  const start = timeToMinutes(slotStart);
  const breakWindow = getBreakWindow(config);
  const morningEnd = breakWindow?.start ?? 12 * 60;
  const afternoonStart = breakWindow?.end ?? 12 * 60;
  const nightStart = 18 * 60;

  if (start < morningEnd) return "morning";
  if (start >= nightStart) return "night";
  if (start >= afternoonStart) return "afternoon";
  return "afternoon";
}

function isSlotBlockedByPeriods(slotStart, blockedPeriods, config) {
  if (blockedPeriods === undefined) return false;
  if (blockedPeriods === null) return true;
  return blockedPeriods.includes(slotPeriod(slotStart, config));
}

function buildSlots(horaInicio, horaFim, duracaoMin, config = null) {
  const slots = [];
  let current = fmtTime(horaInicio);
  const end = fmtTime(horaFim);
  const breakWindow = getBreakWindow(config);
  while (addMinutes(current, Number(duracaoMin)) <= end) {
    if (!overlapsBreak(current, duracaoMin, breakWindow)) {
      slots.push(current);
    }
    current = addMinutes(current, Number(duracaoMin));
  }
  return slots;
}

/**
 * A grade de um dia para um profissional: os horarios que EXISTEM ali, ja
 * descontados o dia de folga, o intervalo de descanso e o bloqueio manual.
 * Devolve `null` quando o dia inteiro nao existe (folga ou bloqueio cheio), o
 * que e diferente de devolver `[]` — o dashboard escreve palavras diferentes
 * para cada um, e colapsar os dois foi o defeito do grid antigo.
 *
 * Nao aplica antecedencia minima de proposito: quem conta capacidade do dia
 * conta o dia inteiro. Quem oferece horario para marcar e outra rota, e essa
 * filtra.
 */
function gradeDoDia(date, config, blockedPeriods) {
  if (!isWorkingDate(date, config)) return null;
  if (blockedPeriods === null) return null; // bloqueio do dia inteiro
  const todos = buildSlots(
    config.hora_inicio,
    config.hora_fim,
    config.duracao_min,
    config,
  );
  return todos.filter((s) => !isSlotBlockedByPeriods(s, blockedPeriods, config));
}

function isAfterMinimumNotice(date, time) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = fmtTime(time).split(":").map(Number);
  const slotDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  const minAllowed = new Date(Date.now() + MIN_BOOKING_NOTICE_MIN * 60 * 1000);
  return slotDate >= minAllowed;
}

function dayOfWeekFromISO(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isWorkingDate(date, config) {
  return config.dias_semana.includes(dayOfWeekFromISO(date));
}

function mapEvent(row, duracaoMin = 60) {
  const start = fmtTime(row.hora_marcada);
  const date = fmtDate(row.dia_marcado);
  return {
    id: row.id,
    telefone: row.telefone,
    cliente: row.cliente,
    profissional: row.profissional,
    professional_id: row.professional_id ?? null,
    servico: row.servico,
    dia_marcado: date,
    hora_marcada: start,
    startTime: start,
    endTime: addMinutes(start, duracaoMin),
    status: row.status,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapProfessional(row) {
  return {
    id: row.id,
    nome: row.nome,
    cor: row.cor,
    ativo: row.ativo,
    created_at: row.created_at,
  };
}

// Le a agenda de UM profissional pelo pool de servico, sem RLS. Mesma invariante do
// `registrarMensagem`: o unico chamador do painel (`/dashboard/resumo`) so passa ids
// que ele acabou de ler por `db.query`, sob RLS. Chamador novo tem que provar a posse
// do `profissional_id` antes.
async function getAgendaConfig(professionalId) {
  let rows;
  try {
    const result = await pool.query(
      `SELECT dias_semana, hora_inicio::text, hora_fim::text, duracao_min,
              intervalo_inicio::text, intervalo_duracao_min,
              COALESCE(janela_agendamento_dias, 10) AS janela_agendamento_dias
       FROM public.agenda_profissional WHERE profissional_id = $1`,
      [professionalId],
    );
    rows = result.rows;
  } catch (err) {
    if (!isUndefinedColumnError(err)) throw err;
    const result = await pool.query(
      `SELECT dias_semana, hora_inicio::text, hora_fim::text, duracao_min,
              intervalo_inicio::text, intervalo_duracao_min
       FROM public.agenda_profissional WHERE profissional_id = $1`,
      [professionalId],
    );
    rows = result.rows;
  }
  if (!rows.length) return { ...DEFAULT_AGENDA };
  return {
    dias_semana: rows[0].dias_semana,
    hora_inicio: fmtTime(rows[0].hora_inicio),
    hora_fim: fmtTime(rows[0].hora_fim),
    duracao_min: rows[0].duracao_min,
    intervalo_inicio: rows[0].intervalo_inicio
      ? fmtTime(rows[0].intervalo_inicio)
      : null,
    intervalo_duracao_min: rows[0].intervalo_duracao_min,
    janela_agendamento_dias: normalizeBookingWindowDays(
      rows[0].janela_agendamento_dias,
    ),
  };
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function parseWhatsAppTimestamp(value) {
  if (!value) return new Date();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getWhatsAppMessageBody(rawMessage, fallback = null) {
  if (!rawMessage || typeof rawMessage !== "object") return fallback;

  if (rawMessage.text?.body) return rawMessage.text.body;

  const interactive = rawMessage.interactive;
  if (interactive?.button_reply) {
    const { title, id } = interactive.button_reply;
    return title || id || fallback;
  }
  if (interactive?.list_reply) {
    const { title, description, id } = interactive.list_reply;
    return [title, description].filter(Boolean).join("\n") || id || fallback;
  }

  if (rawMessage.image?.caption) return rawMessage.image.caption;
  if (rawMessage.video?.caption) return rawMessage.video.caption;
  if (rawMessage.document?.caption) return rawMessage.document.caption;
  if (rawMessage.document?.filename) return rawMessage.document.filename;
  if (rawMessage.audio) return "[audio]";
  if (rawMessage.image) return "[image]";
  if (rawMessage.video) return "[video]";
  if (rawMessage.document) return "[document]";
  if (rawMessage.sticker) return "[sticker]";

  return fallback;
}

function extractInboundEvent(body) {
  const payload = body ?? {};
  const message = payload.message ?? {};
  const raw = payload.raw ?? payload.raw_payload ?? payload;
  const rawMessage = raw?.messages?.[0] ?? payload?.messages?.[0] ?? {};
  const rawContact = raw?.contacts?.[0] ?? payload?.contacts?.[0] ?? {};

  const direction =
    payload.direction ??
    (message.event === "outgoing" || payload.event === "outgoing"
      ? "outbound"
      : "inbound");

  const phone = normalizeWhatsAppPhone(
    payload.phone ??
      payload.telefone ??
      payload.Telefone ??
      payload.wa_id ??
      payload.remotejid ??
      message.chat_id ??
      rawContact.wa_id ??
      rawMessage.from,
  );

  return {
    direction,
    sender_type:
      payload.sender_type ?? (direction === "inbound" ? "customer" : "bot"),
    phone,
    wa_id:
      payload.wa_id ??
      payload.remotejid ??
      message.chat_id ??
      rawContact.wa_id ??
      rawMessage.from ??
      phone,
    name: (() => {
      if (direction !== "inbound") return null;
      const candidate =
        payload.name ?? payload.NomeWpp ?? rawContact.profile?.name ?? null;
      if (candidate == null) return null;
      const trimmed = String(candidate).trim();
      return trimmed === "" ? null : trimmed;
    })(),
    message_type:
      payload.type ??
      payload.message_type ??
      message.content_type ??
      rawMessage.type ??
      "text",
    body:
      payload.body ??
      payload.content ??
      message.content ??
      getWhatsAppMessageBody(rawMessage, null),
    whatsapp_message_id:
      payload.whatsapp_message_id ??
      payload.message_id ??
      rawMessage.id ??
      null,
    occurred_at: parseWhatsAppTimestamp(
      payload.timestamp ?? message.timestamp ?? rawMessage.timestamp,
    ),
    raw_payload: raw,
  };
}

function mapWhatsAppMessage(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    contact_id: row.contact_id,
    direction: row.direction,
    sender_type: row.sender_type,
    whatsapp_message_id: row.whatsapp_message_id,
    message_type: row.message_type,
    body: row.body,
    media_id: row.media_id,
    status: row.status,
    created_at: row.created_at,
    received_at: row.received_at,
  };
}

function mapWhatsAppConversation(row) {
  return {
    id: row.id,
    status: row.status,
    assigned_to: row.assigned_to,
    last_message_at: row.last_message_at,
    unread_count: Number(row.unread_count ?? 0),
    contact: {
      id: row.contact_id,
      phone: row.phone,
      wa_id: row.wa_id,
      name: row.name,
      service_window_until: row.service_window_until,
    },
    last_message: row.last_body
      ? {
          direction: row.last_direction,
          sender_type: row.last_sender_type,
          message_type: row.last_message_type,
          body: row.last_body,
          created_at: row.last_message_created_at,
        }
      : null,
  };
}

function mapServiceRow(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    // O contrato fala em SLUG de categoria ("cabelo"), nao no id numerico que liga as
    // tabelas. Ate 29/09/2026 saia o `categoria_id` cru — que nunca estava preenchido,
    // entao a tela recebia "" e ninguem notava a diferenca de tipo.
    category: row.categoria_slug ?? "",
    name: row.nome,
    desc: row.descricao ?? "",
    price: row.preco ?? "",
  };
}

// `barbeariaId` e OBRIGATORIO, e nao opcional com um "se vier, filtra". Parametro
// opcional aqui significaria que um chamador futuro que esquecesse dele receberia o
// catalogo de todas as barbearias do SaaS — e a lista de servicos e precos de um
// concorrente e exatamente o tipo de coisa que ninguem descobre ter vazado.
async function getServicesFromTables(barbeariaId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.slug, s.nome, s.descricao, s.preco, c.slug AS categoria_slug
     FROM public.servicos s
     LEFT JOIN public.categorias_servicos c ON c.id = s.categoria_id
     WHERE s.ativo = TRUE AND s.barbearia_id = $1
     ORDER BY s.ordem ASC NULLS LAST, s.id ASC`,
    [barbeariaId],
  );
  return rows.map(mapServiceRow);
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

function buildServer() {
  const fastify = Fastify({ logger: true });
  const guardaDoPainel = criarGuardaDoPainel();
  const requireAdmin = guardaDoPainel;

  /**
   * Envolve um handler do painel para ele rodar com a RLS valendo.
   *
   * O handler recebe um terceiro argumento, `db`, e TODA consulta dele tem que sair
   * dali — nunca do `pool` direto, que ignora RLS. Em modo legado `db` E o pool de
   * servico, entao o comportamento fica identico ao de antes e a troca nao tem dia-D.
   *
   * A RESPOSTA SO SAI DEPOIS DO COMMIT. Os handlers terminam com
   * `return reply.status(201).send(x)`, e o `send` do Fastify despacha na hora —
   * antes de `comUsuario` commitar. Ate 28/09/2026 era assim, e custava duas coisas:
   *
   *  - o cliente recebia 201 e, se relesse logo em seguida, podia NAO ver o que
   *    acabou de criar (a leitura corria contra o commit). Achado pela verificacao
   *    ponta a ponta, que falhava em metade das rodadas;
   *  - um commit que falhasse ja teria respondido sucesso por uma escrita perdida.
   *
   * O conserto intercepta o `send`: o handler recebe um `reply` que guarda o corpo
   * em vez de enviar; `status`, `header` e afins passam direto para o verdadeiro. O
   * envio de fato acontece aqui, depois do commit. Os handlers nao mudaram uma linha.
   *
   * Handler que DEVOLVE o dado (`return rows`) ja era seguro: o Fastify so serializa
   * o retorno depois que esta funcao resolve, e ela so resolve depois do commit.
   */
  const noPainel = (handler) => async (request, reply) => {
    if (!MODO_JWT) return handler(request, reply, pool);

    let corpoAdiado;
    let adiou = false;
    const replyAdiado = new Proxy(reply, {
      get(alvo, chave) {
        // O `reply` do Fastify e AGUARDAVEL: tem `then`, que resolve quando a resposta
        // sai. Um handler que devolve este proxy faria o `await` esperar por esse
        // `then` — que so resolve depois do envio, que so acontece depois que o handler
        // termina. Impasse: a requisicao pendurava para sempre (achado em 28/09/2026,
        // na primeira escrita pelo proxy). Escondido aqui, o proxy vira objeto comum.
        if (chave === "then") return undefined;
        if (chave === "send") {
          return (corpo) => {
            corpoAdiado = corpo;
            adiou = true;
            return replyAdiado;
          };
        }
        const valor = alvo[chave];
        if (typeof valor !== "function") return valor;
        // Metodos encadeaveis (`status`, `code`, `header`) devolvem o proprio reply;
        // devolver o proxy no lugar mantem o `.send()` do fim da cadeia interceptado.
        return (...args) => {
          const saida = valor.apply(alvo, args);
          return saida === alvo ? replyAdiado : saida;
        };
      },
    });

    const retorno = await comUsuario(poolUsuario, request, (db) =>
      handler(request, replyAdiado, db),
    );

    if (adiou) return reply.send(corpoAdiado);
    return retorno === replyAdiado ? reply : retorno;
  };
  const requireWebhookToken = buildTokenGuard(
    "WHATSAPP_WEBHOOK_TOKEN",
    "WHATSAPP_WEBHOOK_TOKEN",
  );

  fastify.register(cors, {
    origin: (origin, cb) => cb(null, isCorsOriginAllowed(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Admin-Token",
      "X-Webhook-Token",
    ],
  });
  fastify.addHook("onRequest", applyBasicRateLimit);

  // Dito na subida, e nao so na doc: em modo legado a RLS nao protege nada, e isso
  // precisa aparecer em todo boot ate ser resolvido.
  avisarModo(fastify.log);

  // ─── HEALTH CHECK ──────────────────────────────────────────────────────────
  fastify.get("/", async () => ({
    status: "ok",
    message: "API da barbearia funcionando!",
  }));

  /**
   * De qual barbearia esta requisicao publica esta falando.
   *
   * As rotas publicas (site e, um dia, o bot) sao anonimas por natureza — nao ha
   * usuario, logo nao ha `auth.uid()`, logo a RLS nao tem em que se ancorar. O
   * recorte por barbearia tem que vir explicito, e e este helper que o exige.
   *
   * **O slug e OBRIGATORIO, e nao "opcional com padrao".** Um padrao silencioso
   * repetiria aqui o problema que o `barbearia_em_transicao()` tem no banco: quem
   * esquecesse o parametro atenderia a loja errada sem nenhum erro. 400 e barulhento,
   * e barulho e o que se quer quando a alternativa e servir a barbearia errada.
   *
   * A ORIGEM do slug e problema do site: subdominio, caminho, o que ele preferir. Aqui
   * ele chega como parametro, e essa neutralidade e de proposito — a hospedagem do
   * site ainda nao esta decidida.
   *
   * Devolve `null` quando ja respondeu (400/404); o chamador so precisa parar.
   *
   * ponytail: uma consulta por requisicao, sem cache. Teto: a tabela tem uma linha por
   * cliente do SaaS e o `slug` e UNIQUE, entao e uma leitura de indice. Gatilho de
   * upgrade: quando `barbearias` passar de algumas centenas de linhas, ou quando o
   * perfil mostrar esta consulta pesando no tempo das rotas publicas.
   */
  async function resolverBarbearia(request, reply) {
    const bruto =
      request.query?.barbearia ?? request.body?.barbearia ?? "";
    const slug = String(bruto).trim().toLowerCase();

    if (!slug) {
      reply.status(400).send({
        error: "Informe a barbearia: `?barbearia=<slug>` (ou `barbearia` no corpo).",
        codigo: "barbearia_ausente",
      });
      return null;
    }

    const { rows } = await pool.query(
      `SELECT id, nome, slug FROM public.barbearias WHERE slug = $1`,
      [slug],
    );

    if (!rows.length) {
      reply.status(404).send({ error: "Barbearia nao encontrada.", codigo: "barbearia_desconhecida" });
      return null;
    }

    return rows[0];
  }

  /**
   * Envolve uma rota publica: resolve a barbearia e entrega pronta ao handler.
   *
   * DUAS FORMAS DE DIZER QUAL BARBEARIA, e nao e indecisao — sao dois chamadores
   * diferentes, cada um com a informacao que ele naturalmente tem:
   *
   *  - **o site** e anonimo e sabe de qual loja e (subdominio, caminho): manda o slug;
   *  - **o painel** e logado e NAO sabe o proprio slug: quem diz e o JWT.
   *
   * Quatro destas rotas sao usadas pelos dois (`/profissionais`, `/servicos`,
   * `agenda-config`, `dias-bloqueados`). Exigir o slug do painel o obrigaria a
   * descobrir o proprio slug so pra devolve-lo ao servidor que ja sabe — e a alternativa
   * (um padrao quando falta) e justamente o silencio que estamos removendo.
   *
   * O slug tem precedencia: se veio, e ele que vale, mesmo com sessao aberta.
   */
  const noSite =
    (handler) =>
    async (request, reply) => {
      const pedido = String(
        request.query?.barbearia ?? request.body?.barbearia ?? "",
      ).trim();

      const barbearia = pedido
        ? await resolverBarbearia(request, reply)
        : await barbeariaDoUsuario(request, reply);

      if (!barbearia) return reply;
      return handler(request, reply, barbearia);
    };

  /**
   * A barbearia de quem esta logado — o caminho do painel, quando nao veio slug.
   *
   * Em modo LEGADO isto nao tem resposta: nao ha usuario, logo nao ha barbearia, e
   * responder qualquer uma seria escolher uma loja no escuro. O 400 diz exatamente o
   * que fazer, porque descobrir isso por tentativa custaria caro.
   */
  async function barbeariaDoUsuario(request, reply) {
    // SEM cabecalho de autorizacao, quem chama e o site — e para ele a resposta certa
    // e "informe a barbearia", nao "nao autorizado". Deixar o guard responder 401 aqui
    // mandaria o site tentar fazer login para consertar um erro que se conserta com um
    // parametro na URL. Mensagem que aponta pro lugar errado custa uma tarde.
    if (!request.headers.authorization && !request.headers["x-admin-token"]) {
      reply.status(400).send({
        error: "Informe a barbearia: `?barbearia=<slug>` (ou `barbearia` no corpo).",
        codigo: "barbearia_ausente",
      });
      return null;
    }

    if (!MODO_JWT) {
      reply.status(400).send({
        error:
          "Informe a barbearia: `?barbearia=<slug>`. (Sem SUPABASE_JWKS_URL nao ha " +
          "sessao de onde deduzi-la.)",
        codigo: "barbearia_ausente",
      });
      return null;
    }

    await guardaDoPainel(request, reply);
    if (reply.sent || !request.usuario) return null;

    const { rows } = await pool.query(
      `SELECT id, nome, slug FROM public.barbearias WHERE user_id = $1`,
      [request.usuario.sub],
    );

    if (!rows.length) {
      reply.status(403).send({
        error: "Sua conta não está ligada a nenhuma barbearia.",
        codigo: "sem_barbearia",
      });
      return null;
    }

    return rows[0];
  }

  /**
   * O profissional, se ele for MESMO daquela barbearia.
   *
   * Existe para as rotas que recebem `professionalId` do cliente. Sem esta checagem,
   * o id seria a porta de entrada para o dado da loja vizinha: pedir a agenda do
   * profissional 3 informando o slug da loja A devolveria a agenda da loja B, porque
   * nenhuma das consultas seguintes olha a barbearia — elas olham o `profissional_id`.
   *
   * Devolve `null` para quem nao existe, nao esta ativo, ou e de outra loja: os tres
   * viram o mesmo 404. Distinguir "nao existe" de "e de outra barbearia" entregaria
   * um mapa de quem tem quem.
   */
  async function profissionalDaBarbearia(id, barbeariaId) {
    const { rows } = await pool.query(
      `SELECT id, nome FROM public.profissionais
        WHERE id = $1 AND barbearia_id = $2 AND ativo = TRUE`,
      [id, barbeariaId],
    );
    return rows[0] ?? null;
  }

  // ─── PROFISSIONAIS ─────────────────────────────────────────────────────────

  // GET /profissionais — lista ativos
  fastify.get(
    "/profissionais",
    noSite(async (_req, reply, barbearia) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, nome, cor, ativo, created_at
         FROM public.profissionais
         WHERE ativo = TRUE AND barbearia_id = $1
         ORDER BY nome ASC`,
        [barbearia.id],
      );
      return rows.map(mapProfessional);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar profissionais." });
    }
    }),
  );

  // GET /profissionais/:id/agenda — DisableDays reais (fora de dias_semana + bloqueados manualmente)
  fastify.get(
    "/profissionais/:id/agenda",
    noSite(async (request, reply, barbearia) => {
    const { id } = request.params;
    try {
      if (!(await profissionalDaBarbearia(id, barbearia.id)))
        return reply
          .status(404)
          .send({ error: "Profissional não encontrado." });

      const config = await getAgendaConfig(id);

      const { rows: blockedRows } = await pool.query(
        `SELECT data::text FROM public.dias_bloqueados
         WHERE profissional_id = $1
           AND periodos IS NULL
           AND data >= CURRENT_DATE
           AND data <= CURRENT_DATE + INTERVAL '90 days'`,
        [id],
      );
      const manuallyBlocked = new Set(blockedRows.map((r) => fmtDate(r.data)));

      const disabledDays = [];
      const today = new Date();
      for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().substring(0, 10);
        if (
          !config.dias_semana.includes(dayOfWeek) ||
          manuallyBlocked.has(dateStr)
        ) {
          disabledDays.push(dateStr);
        }
      }

      return { DisableDays: disabledDays };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar agenda." });
    }
    }),
  );

  // GET /profissionais/:id/agenda-config — configuração de dias e horários
  fastify.get(
    "/profissionais/:id/agenda-config",
    noSite(async (request, reply, barbearia) => {
    const { id } = request.params;
    try {
      if (!(await profissionalDaBarbearia(id, barbearia.id)))
        return reply
          .status(404)
          .send({ error: "Profissional não encontrado." });

      const { rows } = await pool.query(
        `SELECT dias_semana, hora_inicio::text, hora_fim::text, duracao_min,
                intervalo_inicio::text, intervalo_duracao_min,
                COALESCE(janela_agendamento_dias, 10) AS janela_agendamento_dias,
                atualizado_em
         FROM public.agenda_profissional WHERE profissional_id = $1`,
        [id],
      );

      if (!rows.length) {
        return {
          profissional_id: Number(id),
          ...DEFAULT_AGENDA,
          atualizado_em: null,
        };
      }

      return {
        profissional_id: Number(id),
        dias_semana: rows[0].dias_semana,
        hora_inicio: fmtTime(rows[0].hora_inicio),
        hora_fim: fmtTime(rows[0].hora_fim),
        duracao_min: rows[0].duracao_min,
        intervalo_inicio: rows[0].intervalo_inicio
          ? fmtTime(rows[0].intervalo_inicio)
          : null,
        intervalo_duracao_min: rows[0].intervalo_duracao_min,
        janela_agendamento_dias: normalizeBookingWindowDays(
          rows[0].janela_agendamento_dias,
        ),
        atualizado_em: rows[0].atualizado_em,
      };
    } catch (err) {
      if (isUndefinedColumnError(err)) {
        try {
          const { rows } = await pool.query(
            `SELECT dias_semana, hora_inicio::text, hora_fim::text, duracao_min,
                    intervalo_inicio::text, intervalo_duracao_min, atualizado_em
             FROM public.agenda_profissional WHERE profissional_id = $1`,
            [id],
          );

          if (!rows.length) {
            return {
              profissional_id: Number(id),
              ...DEFAULT_AGENDA,
              atualizado_em: null,
            };
          }

          return {
            profissional_id: Number(id),
            dias_semana: rows[0].dias_semana,
            hora_inicio: fmtTime(rows[0].hora_inicio),
            hora_fim: fmtTime(rows[0].hora_fim),
            duracao_min: rows[0].duracao_min,
            intervalo_inicio: rows[0].intervalo_inicio
              ? fmtTime(rows[0].intervalo_inicio)
              : null,
            intervalo_duracao_min: rows[0].intervalo_duracao_min,
            janela_agendamento_dias: DEFAULT_AGENDA.janela_agendamento_dias,
            atualizado_em: rows[0].atualizado_em,
          };
        } catch (fallbackErr) {
          fastify.log.error(fallbackErr);
        }
      }
      fastify.log.error(err);
      return reply
        .status(500)
        .send({ error: "Erro ao buscar configuração de agenda." });
    }
    }),
  );

  // PUT /profissionais/:id/agenda-config — salva config (upsert)
  fastify.put(
    "/profissionais/:id/agenda-config",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const {
        dias_semana,
        hora_inicio,
        hora_fim,
        duracao_min,
        intervalo_inicio = null,
        intervalo_duracao_min = null,
        janela_agendamento_dias = DEFAULT_AGENDA.janela_agendamento_dias,
      } = request.body ?? {};

      if (!dias_semana || !hora_inicio || !hora_fim || !duracao_min) {
        return reply.status(400).send({
          error:
            "dias_semana, hora_inicio, hora_fim, duracao_min são obrigatórios.",
        });
      }

      if (
        (intervalo_inicio && !intervalo_duracao_min) ||
        (!intervalo_inicio && intervalo_duracao_min)
      ) {
        return reply.status(400).send({
          error:
            "intervalo_inicio e intervalo_duracao_min devem ser informados juntos.",
        });
      }

      if (
        intervalo_duracao_min !== null &&
        ![30, 60, 90, 120].includes(Number(intervalo_duracao_min))
      ) {
        return reply.status(400).send({
          error: "intervalo_duracao_min deve ser 30, 60, 90 ou 120.",
        });
      }

      if (intervalo_inicio) {
        const breakStart = timeToMinutes(intervalo_inicio);
        const breakEnd = breakStart + Number(intervalo_duracao_min);
        if (
          breakStart < timeToMinutes(hora_inicio) ||
          breakEnd > timeToMinutes(hora_fim)
        ) {
          return reply.status(400).send({
            error: "O descanso precisa ficar dentro do horário de trabalho.",
          });
        }
      }

      const bookingWindowDays = normalizeBookingWindowDays(
        janela_agendamento_dias,
      );
      if (Number(janela_agendamento_dias) !== bookingWindowDays) {
        return reply.status(400).send({
          error: `janela_agendamento_dias deve ficar entre ${JANELA_MIN_DIAS} e ${JANELA_MAX_DIAS}.`,
        });
      }

      try {
        const { rows } = await db.query(
          `INSERT INTO public.agenda_profissional
           (profissional_id, dias_semana, hora_inicio, hora_fim, duracao_min,
            intervalo_inicio, intervalo_duracao_min, janela_agendamento_dias, atualizado_em)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (profissional_id) DO UPDATE
           SET dias_semana  = $2::jsonb,
               hora_inicio  = $3,
               hora_fim     = $4,
               duracao_min  = $5,
               intervalo_inicio = $6,
               intervalo_duracao_min = $7,
               janela_agendamento_dias = $8,
               atualizado_em = NOW()
         RETURNING profissional_id, dias_semana, hora_inicio::text, hora_fim::text,
                   duracao_min, intervalo_inicio::text, intervalo_duracao_min,
                   janela_agendamento_dias, atualizado_em`,
          [
            id,
            JSON.stringify(dias_semana),
            hora_inicio,
            hora_fim,
            duracao_min,
            intervalo_inicio,
            intervalo_duracao_min,
            bookingWindowDays,
          ],
        );

        return {
          profissional_id: rows[0].profissional_id,
          dias_semana: rows[0].dias_semana,
          hora_inicio: fmtTime(rows[0].hora_inicio),
          hora_fim: fmtTime(rows[0].hora_fim),
          duracao_min: rows[0].duracao_min,
          intervalo_inicio: rows[0].intervalo_inicio
            ? fmtTime(rows[0].intervalo_inicio)
            : null,
          intervalo_duracao_min: rows[0].intervalo_duracao_min,
          janela_agendamento_dias: normalizeBookingWindowDays(
            rows[0].janela_agendamento_dias,
          ),
          atualizado_em: rows[0].atualizado_em,
        };
      } catch (err) {
        if (isUndefinedColumnError(err)) {
          try {
            const { rows } = await db.query(
              `INSERT INTO public.agenda_profissional
               (profissional_id, dias_semana, hora_inicio, hora_fim, duracao_min,
                intervalo_inicio, intervalo_duracao_min, atualizado_em)
             VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (profissional_id) DO UPDATE
               SET dias_semana  = $2::jsonb,
                   hora_inicio  = $3,
                   hora_fim     = $4,
                   duracao_min  = $5,
                   intervalo_inicio = $6,
                   intervalo_duracao_min = $7,
                   atualizado_em = NOW()
             RETURNING profissional_id, dias_semana, hora_inicio::text, hora_fim::text,
                       duracao_min, intervalo_inicio::text, intervalo_duracao_min, atualizado_em`,
              [
                id,
                JSON.stringify(dias_semana),
                hora_inicio,
                hora_fim,
                duracao_min,
                intervalo_inicio,
                intervalo_duracao_min,
              ],
            );

            return {
              profissional_id: rows[0].profissional_id,
              dias_semana: rows[0].dias_semana,
              hora_inicio: fmtTime(rows[0].hora_inicio),
              hora_fim: fmtTime(rows[0].hora_fim),
              duracao_min: rows[0].duracao_min,
              intervalo_inicio: rows[0].intervalo_inicio
                ? fmtTime(rows[0].intervalo_inicio)
                : null,
              intervalo_duracao_min: rows[0].intervalo_duracao_min,
              janela_agendamento_dias: DEFAULT_AGENDA.janela_agendamento_dias,
              atualizado_em: rows[0].atualizado_em,
            };
          } catch (fallbackErr) {
            fastify.log.error(fallbackErr);
          }
        }
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao salvar configuração de agenda." });
      }
    }),
  );

  // GET /profissionais/:id/dias-bloqueados — lista datas bloqueadas manualmente
  fastify.get(
    "/profissionais/:id/dias-bloqueados",
    noSite(async (request, reply, barbearia) => {
    const { id } = request.params;
    const { date } = request.query ?? {};
    try {
      // Sem esta linha o `profissional_id` seria a porta de entrada para a agenda da
      // loja vizinha: `dias_bloqueados` nao tem `barbearia_id`, ela pendura em
      // `profissionais` — entao quem valida a posse e esta checagem, nao a consulta.
      if (!(await profissionalDaBarbearia(id, barbearia.id)))
        return reply.status(404).send({ error: "Profissional não encontrado." });

      const { rows } = await pool.query(
        `SELECT id, data::text, motivo, periodos, created_at
         FROM public.dias_bloqueados
         WHERE profissional_id = $1
           AND ($2::date IS NULL OR data = $2::date)
         ORDER BY data ASC`,
        [id, date || null],
      );
      return rows.map((r) => ({
        id: r.id,
        data: fmtDate(r.data),
        motivo: r.motivo,
        periodos: r.periodos,
        created_at: r.created_at,
      }));
    } catch (err) {
      fastify.log.error(err);
      return reply
        .status(500)
        .send({ error: "Erro ao buscar dias bloqueados." });
    }
    }),
  );

  // POST /profissionais/:id/dias-bloqueados — bloqueia uma data
  fastify.post(
    "/profissionais/:id/dias-bloqueados",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const { data, motivo = null, periodos } = request.body ?? {};

      if (!data)
        return reply.status(400).send({ error: "data é obrigatório." });
      const normalizedPeriods =
        periodos === undefined ? null : normalizePeriods(periodos);
      if (periodos !== undefined && normalizedPeriods === null) {
        return reply
          .status(400)
          .send({ error: "periodos deve ser uma lista." });
      }

      try {
        if (
          Array.isArray(normalizedPeriods) &&
          normalizedPeriods.length === 0
        ) {
          const { rowCount } = await db.query(
            `DELETE FROM public.dias_bloqueados WHERE profissional_id = $1 AND data = $2`,
            [id, data],
          );
          return {
            message: rowCount
              ? "Bloqueio removido."
              : "Nenhum bloqueio encontrado.",
            data,
            periodos: [],
          };
        }

        const persistedPeriods =
          normalizedPeriods && normalizedPeriods.length === BLOCK_PERIODS.length
            ? null
            : normalizedPeriods;

        const { rows } = await db.query(
          `INSERT INTO public.dias_bloqueados (profissional_id, data, motivo, periodos)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (profissional_id, data) DO UPDATE
           SET motivo = EXCLUDED.motivo,
               periodos = EXCLUDED.periodos
         RETURNING id, data::text, motivo, periodos, created_at`,
          [id, data, motivo, persistedPeriods],
        );
        return reply.status(201).send({
          id: rows[0].id,
          data: fmtDate(rows[0].data),
          motivo: rows[0].motivo,
          periodos: rows[0].periodos,
          created_at: rows[0].created_at,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao bloquear dia." });
      }
    }),
  );

  // DELETE /profissionais/:id/dias-bloqueados/:data — desbloqueia uma data
  fastify.delete(
    "/profissionais/:id/dias-bloqueados/:data",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id, data } = request.params;
      try {
        const { rowCount } = await db.query(
          `DELETE FROM public.dias_bloqueados WHERE profissional_id = $1 AND data = $2`,
          [id, data],
        );
        if (!rowCount)
          return reply
            .status(404)
            .send({ error: "Dia bloqueado não encontrado." });
        return { message: "Dia desbloqueado.", data };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao desbloquear dia." });
      }
    }),
  );

  // POST /profissionais — cria
  fastify.post(
    "/profissionais",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { nome, cor } = request.body ?? {};
      if (!nome || !cor)
        return reply
          .status(400)
          .send({ error: "nome e cor são obrigatórios." });

      try {
        const { rows } = await db.query(
          // `barbearia_atual()` e nao o default de transicao: o default aponta SEMPRE
          // para a loja A, entao o dono da loja B tomaria 42501 do `with check` da RLS
          // ao cadastrar um barbeiro — erro correto, causa incompreensivel. A funcao
          // resolve a barbearia de quem esta logado, que e o que se quer aqui.
          `INSERT INTO public.profissionais (nome, cor, ativo, barbearia_id)
         VALUES ($1, $2, TRUE, public.barbearia_atual())
         RETURNING id, nome, cor, ativo, created_at`,
          [nome, cor],
        );
        return reply.status(201).send(mapProfessional(rows[0]));
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao criar profissional." });
      }
    }),
  );

  // PATCH /profissionais/:id — atualiza campos
  fastify.patch(
    "/profissionais/:id",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const { nome, cor, ativo } = request.body ?? {};

      const fields = [];
      const params = [];
      if (nome !== undefined) {
        params.push(nome);
        fields.push(`nome = $${params.length}`);
      }
      if (cor !== undefined) {
        params.push(cor);
        fields.push(`cor = $${params.length}`);
      }
      if (ativo !== undefined) {
        params.push(ativo);
        fields.push(`ativo = $${params.length}`);
      }

      if (!fields.length)
        return reply
          .status(400)
          .send({ error: "Nenhum campo para atualizar." });

      params.push(id);
      try {
        const { rows } = await db.query(
          `UPDATE public.profissionais
         SET ${fields.join(", ")}
         WHERE id = $${params.length}
         RETURNING id, nome, cor, ativo, created_at`,
          params,
        );
        if (!rows.length)
          return reply
            .status(404)
            .send({ error: "Profissional não encontrado." });
        return mapProfessional(rows[0]);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao atualizar profissional." });
      }
    }),
  );

  // DELETE /profissionais/:id — soft delete
  fastify.delete(
    "/profissionais/:id",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      try {
        const { rows } = await db.query(
          `UPDATE public.profissionais SET ativo = FALSE WHERE id = $1 RETURNING id`,
          [id],
        );
        if (!rows.length)
          return reply
            .status(404)
            .send({ error: "Profissional não encontrado." });
        return { message: "Profissional removido.", id: Number(id) };
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao remover profissional." });
      }
    }),
  );

  // ─── CLIENTES ──────────────────────────────────────────────────────────────

  // GET /clientes/buscar?telefone= — o nome de quem já é cliente.
  //
  // O modal de agendamento pede o telefone primeiro: se o número já passou por
  // aqui, o nome vem preenchido; se é novo, o barbeiro digita e o nome fica
  // gravado no próprio agendamento para a próxima vez. Mesmo fluxo do site de
  // agendamento.
  //
  // Onde o nome mora hoje: em cada agendamento (`agendamentos.cliente`, o mais
  // recente vence) e, na falta, no cadastro do bot (`dados_cliente.nome`). A
  // comparação é por DÍGITOS, dos dois lados, porque há telefone gravado com
  // máscara antiga e sem; e procura também a forma sem/com o nono dígito, que o
  // WhatsApp às vezes entrega sem. `variantesDeBusca` é a mesma regra de
  // `lib/telefone.ts` -- mudar lá é mudar aqui.
  //
  // ponytail: duas leituras em vez de uma tabela de clientes própria; gatilho
  // de upgrade: o banco novo ter cadastro de cliente, e esta rota passa a ler só
  // dele.
  //
  // Protegida: devolve nome de pessoa a partir do telefone.
  //
  // Integracao 28/09: entrou em `noPainel`. Ela chegou da casca protegida pelo guard,
  // mas lendo pelo `pool` de servico — que ignora RLS. Com o login ligado, o dono de
  // uma loja acharia pelo telefone o cliente de QUALQUER loja. As duas leituras agora
  // saem de `db`, e as politicas de `agendamentos` e `dados_cliente` fazem o recorte.
  fastify.get(
    "/clientes/buscar",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
    const variantes = variantesDeBusca(request.query?.telefone);
    if (!variantes.length)
      return reply.status(400).send({ error: "telefone é obrigatório." });

    try {
      const { rows } = await db.query(
        `SELECT cliente AS nome
           FROM public.agendamentos
          WHERE regexp_replace(coalesce(telefone, ''), '\\D', '', 'g') = ANY($1)
            AND coalesce(trim(cliente), '') <> ''
            AND coalesce(source, '') <> 'presencial'
          ORDER BY created_at DESC
          LIMIT 1`,
        [variantes],
      );
      let nome = rows[0]?.nome?.trim();

      if (!nome) {
        const cadastro = await db.query(
          `SELECT nome
             FROM public.dados_cliente
            WHERE regexp_replace(coalesce(telefone, ''), '\\D', '', 'g') = ANY($1)
              AND coalesce(trim(nome), '') <> ''
            LIMIT 1`,
          [variantes],
        );
        nome = cadastro.rows[0]?.nome?.trim();
      }

      return nome
        ? { encontrado: true, nome, telefone: variantes[0] }
        : { encontrado: false, telefone: variantes[0] };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar cliente." });
    }
  }),
  );

  // ─── AGENDAMENTOS ──────────────────────────────────────────────────────────

  // GET /agendamentos/verificar-telefone?phone=
  fastify.get(
    "/agendamentos/verificar-telefone",
    noSite(async (request, reply, barbearia) => {
    const { phone } = request.query;
    if (!phone)
      return reply.status(400).send({ error: "phone é obrigatório." });

    try {
      // O recorte por barbearia aqui nao e so higiene de dado: sem ele, esta rota
      // responde se um telefone tem horario marcado em QUALQUER barbearia do SaaS.
      // Um concorrente com a lista de clientes descobriria onde cada um corta o
      // cabelo, uma consulta por vez, sem precisar de login.
      const { rows } = await pool.query(
        `SELECT servico, profissional, dia_marcado::text, hora_marcada::text, source
         FROM public.agendamentos
         WHERE telefone = $1
           AND status = ANY($2)
           AND barbearia_id = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [phone, BOOKED_STATUSES, barbearia.id],
      );

      if (!rows.length) return { exists: false };

      const r = rows[0];
      return {
        exists: true,
        servico: r.servico,
        barbeiro: r.profissional,
        data: fmtDate(r.dia_marcado),
        horario: fmtTime(r.hora_marcada),
        source: r.source,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao verificar telefone." });
    }
    }),
  );

  // GET /agendamentos/horarios-disponiveis?professionalId=&date= — slots dinâmicos por profissional
  fastify.get(
    "/agendamentos/horarios-disponiveis",
    noSite(async (request, reply, barbearia) => {
    const { professionalId, date } = request.query;
    if (!professionalId || !date)
      return reply
        .status(400)
        .send({ error: "professionalId e date são obrigatórios." });

    try {
      if (!(await profissionalDaBarbearia(professionalId, barbearia.id)))
        return reply.status(404).send({ error: "Profissional não encontrado." });

      const [config, blockedResult, bookedResult] = await Promise.all([
        getAgendaConfig(professionalId),
        pool.query(
          `SELECT periodos FROM public.dias_bloqueados
           WHERE profissional_id = $1 AND data = $2
           LIMIT 1`,
          [professionalId, date],
        ),
        // A juncao era `ON a.profissional = p.nome` — por NOME. Funcionava com uma
        // barbearia e passa a errar com duas: dois barbeiros homonimos em lojas
        // diferentes casariam um com o outro, e o horario ocupado numa apareceria
        // ocupado na outra. Sem erro; so vaga somindo da agenda de quem esta livre.
        // `profissional_id` existe desde 04/09 e resolve isso sendo id de verdade.
        pool.query(
          `SELECT a.hora_marcada::text
           FROM public.agendamentos a
           WHERE a.profissional_id = $1
             AND a.dia_marcado = $2
             AND a.status = ANY($3)`,
          [professionalId, date, BOOKED_STATUSES],
        ),
      ]);

      if (!isWithinBookingWindow(date, config.janela_agendamento_dias)) {
        return {
          professionalId: Number(professionalId),
          date,
          availableSlots: [],
        };
      }

      if (!isWorkingDate(date, config)) {
        return {
          professionalId: Number(professionalId),
          date,
          availableSlots: [],
        };
      }

      const blockedPeriods = blockedResult.rows[0]?.periodos ?? undefined;
      if (blockedResult.rows.length && blockedPeriods === null) {
        return {
          professionalId: Number(professionalId),
          date,
          availableSlots: [],
        };
      }

      const allSlots = buildSlots(
        config.hora_inicio,
        config.hora_fim,
        config.duracao_min,
        config,
      );
      const booked = new Set(
        bookedResult.rows.map((r) => fmtTime(r.hora_marcada)),
      );
      const availableSlots = allSlots.filter(
        (s) =>
          !booked.has(s) &&
          !isSlotBlockedByPeriods(s, blockedPeriods, config) &&
          isAfterMinimumNotice(date, s),
      );

      return { professionalId: Number(professionalId), date, availableSlots };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar horários." });
    }
    }),
  );

  // GET /agendamentos/dias-disponiveis?professionalId=&days=10 — próximos dias com pelo menos um horário livre
  fastify.get(
    "/agendamentos/dias-disponiveis",
    noSite(async (request, reply, barbearia) => {
    const { professionalId, days } = request.query;
    if (!professionalId)
      return reply.status(400).send({ error: "professionalId é obrigatório." });

    const today = new Date();
    const openDays = [];
    const disabledDays = [];

    try {
      if (!(await profissionalDaBarbearia(professionalId, barbearia.id))) {
        return reply
          .status(404)
          .send({ error: "Profissional não encontrado." });
      }

      const config = await getAgendaConfig(professionalId);
      const daysToCheck =
        days === undefined
          ? config.janela_agendamento_dias
          : normalizeBookingWindowDays(days, config.janela_agendamento_dias);
      const startDate = today.toISOString().substring(0, 10);
      const endDay = new Date(today);
      endDay.setDate(today.getDate() + daysToCheck - 1);
      const endDate = endDay.toISOString().substring(0, 10);

      // Três queries em paralelo em vez de 2 queries × N dias em sequência
      const [blockedResult, bookedResult] = await Promise.all([
        pool.query(
          `SELECT data::text, periodos FROM public.dias_bloqueados
           WHERE profissional_id = $1 AND data >= $2 AND data <= $3`,
          [professionalId, startDate, endDate],
        ),
        // Mesma correcao do `horarios-disponiveis`: juncao por id, e nao por nome.
        pool.query(
          `SELECT a.hora_marcada::text, a.dia_marcado::text
           FROM public.agendamentos a
           WHERE a.profissional_id = $1
             AND a.dia_marcado >= $2
             AND a.dia_marcado <= $3
             AND a.status = ANY($4)`,
          [professionalId, startDate, endDate, BOOKED_STATUSES],
        ),
      ]);

      // Índices em memória para lookup O(1) no loop
      const blockedByDate = new Map(
        blockedResult.rows.map((r) => [r.data, r.periodos]),
      );
      const bookedByDate = new Map();
      for (const row of bookedResult.rows) {
        const d = fmtDate(row.dia_marcado);
        if (!bookedByDate.has(d)) bookedByDate.set(d, new Set());
        bookedByDate.get(d).add(fmtTime(row.hora_marcada));
      }

      const allSlots = buildSlots(
        config.hora_inicio,
        config.hora_fim,
        config.duracao_min,
        config,
      );

      for (let i = 0; i < daysToCheck; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const date = d.toISOString().substring(0, 10);

        if (!isWorkingDate(date, config)) {
          disabledDays.push(date);
          continue;
        }

        const isBlocked = blockedByDate.has(date);
        const blockedPeriods = isBlocked ? blockedByDate.get(date) : undefined;
        if (isBlocked && blockedPeriods === null) {
          disabledDays.push(date);
          continue;
        }

        const booked = bookedByDate.get(date) ?? new Set();
        const eligibleSlots = allSlots.filter(
          (s) =>
            !isSlotBlockedByPeriods(s, blockedPeriods, config) &&
            isAfterMinimumNotice(date, s),
        );
        const availableSlots = eligibleSlots.filter((s) => !booked.has(s));
        const totalSlotsCount = eligibleSlots.length;
        const occupancyRatio = totalSlotsCount
          ? Number(
              (
                (totalSlotsCount - availableSlots.length) /
                totalSlotsCount
              ).toFixed(2),
            )
          : 1;

        if (availableSlots.length) {
          openDays.push({
            date,
            availableSlotsCount: availableSlots.length,
            totalSlotsCount,
            occupancyRatio,
            firstSlot: availableSlots[0] ?? null,
          });
        } else {
          disabledDays.push(date);
        }
      }

      return {
        professionalId: Number(professionalId),
        days: daysToCheck,
        openDays,
        disabledDays,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply
        .status(500)
        .send({ error: "Erro ao buscar dias disponíveis." });
    }
    }),
  );

  // GET /agendamentos — aceita ?professionalId= e/ou ?date=
  fastify.get(
    "/agendamentos",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { professionalId, date } = request.query;
      try {
        const conditions = [];
        const params = [];

        let query = `
        SELECT a.*,
               a.dia_marcado::text  AS dia_marcado,
               a.hora_marcada::text AS hora_marcada,
               p.id                 AS professional_id,
               COALESCE(ap.duracao_min, 60) AS duracao_min
        FROM public.agendamentos a
      `;

        if (professionalId) {
          query += ` JOIN public.profissionais p ON a.profissional = p.nome
                   LEFT JOIN public.agenda_profissional ap ON p.id = ap.profissional_id`;
          params.push(professionalId);
          conditions.push(`p.id = $${params.length}`);
        } else {
          query += ` LEFT JOIN public.profissionais p ON a.profissional = p.nome
                   LEFT JOIN public.agenda_profissional ap ON p.id = ap.profissional_id`;
        }

        if (date) {
          params.push(date);
          conditions.push(`a.dia_marcado = $${params.length}`);
        }

        if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
        query += ` ORDER BY a.dia_marcado ASC, a.hora_marcada ASC`;

        const { rows } = await db.query(query, params);
        return rows.map((r) => mapEvent(r, r.duracao_min ?? 60));
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao buscar agendamentos." });
      }
    }),
  );

  // POST /agendamentos — cria agendamento
  fastify.post(
    "/agendamentos",
    noSite(async (request, reply, barbearia) => {
    const {
      telefone = "",
      cliente,
      profissional,
      profissional_id: profissionalIdPedido,
      servico = "",
      dia_marcado,
      hora_marcada,
      status = "confirmado",
      source = "app-etapas",
    } = request.body ?? {};

    if (!cliente || !dia_marcado || !hora_marcada) {
      return reply.status(400).send({
        error: "Campos obrigatórios: cliente, dia_marcado, hora_marcada.",
      });
    }

    if (!profissionalIdPedido && !profissional) {
      return reply
        .status(400)
        .send({ error: "Informe `profissional_id` (preferido) ou `profissional`." });
    }

    try {
      // ACEITA ID OU NOME, e prefere o id.
      //
      // Resolver por NOME era o unico caminho ate 08/09, e era ambiguo por natureza:
      // `WHERE nome = $1 ... LIMIT 1` sobre a tabela inteira. Com duas barbearias, dois
      // barbeiros homonimos fazem o `LIMIT 1` escolher um deles por sorteio — e o
      // cliente marcaria com o barbeiro da outra loja, sem erro nenhum aparecer.
      //
      // O recorte por `barbearia_id` fecha isso. O nome continua aceito porque ele e o
      // contrato que o painel e o site usam hoje; ambiguidade DENTRO da mesma loja vira
      // 409 explicito em vez de sorteio silencioso.
      let alvo = null;

      if (profissionalIdPedido) {
        alvo = await profissionalDaBarbearia(profissionalIdPedido, barbearia.id);
      } else {
        const { rows: porNome } = await pool.query(
          `SELECT id, nome FROM public.profissionais
            WHERE nome = $1 AND barbearia_id = $2 AND ativo = TRUE`,
          [profissional, barbearia.id],
        );

        if (porNome.length > 1) {
          return reply.status(409).send({
            error:
              "Mais de um profissional com esse nome nesta barbearia. Use `profissional_id`.",
            codigo: "nome_ambiguo",
          });
        }
        alvo = porNome[0] ?? null;
      }

      if (!alvo) {
        return reply
          .status(404)
          .send({ error: "Profissional não encontrado." });
      }

      const professionalId = alvo.id;
      const config = await getAgendaConfig(professionalId);
      if (!isWithinBookingWindow(dia_marcado, config.janela_agendamento_dias)) {
        return reply
          .status(409)
          .send({ error: "Data fora da janela de agendamento." });
      }

      if (!isWorkingDate(dia_marcado, config)) {
        return reply
          .status(409)
          .send({ error: "Profissional não atende nesta data." });
      }

      const { rows: blockedRows } = await pool.query(
        `SELECT periodos FROM public.dias_bloqueados
         WHERE profissional_id = $1 AND data = $2
         LIMIT 1`,
        [professionalId, dia_marcado],
      );
      const blockedPeriods = blockedRows[0]?.periodos ?? undefined;
      if (blockedRows.length && blockedPeriods === null) {
        return reply
          .status(409)
          .send({ error: "Data bloqueada para este profissional." });
      }

      const allSlots = buildSlots(
        config.hora_inicio,
        config.hora_fim,
        config.duracao_min,
        config,
      );
      const { rows: bookedRows } = await pool.query(
        `SELECT a.hora_marcada::text
         FROM public.agendamentos a
         WHERE a.profissional_id = $1
           AND a.dia_marcado = $2
           AND a.status = ANY($3)`,
        [professionalId, dia_marcado, BOOKED_STATUSES],
      );
      const booked = new Set(bookedRows.map((r) => fmtTime(r.hora_marcada)));
      const requestedSlot = fmtTime(hora_marcada);
      if (
        !allSlots.includes(requestedSlot) ||
        booked.has(requestedSlot) ||
        isSlotBlockedByPeriods(requestedSlot, blockedPeriods, config) ||
        !isAfterMinimumNotice(dia_marcado, requestedSlot)
      ) {
        return reply.status(409).send({ error: "Horário indisponível." });
      }

      // `barbearia_id` e `profissional_id` vao EXPLICITOS, e nao pelos dispositivos de
      // transicao (o default `barbearia_em_transicao()` e o gatilho
      // `agendamentos_resolver_profissional`). Aqueles existem para o codigo que ainda
      // nao sabe de barbearias; este sabe. Enquanto esta rota depender deles, a rede de
      // seguranca vira muleta — e muleta nao sai mais.
      //
      // O nome (`profissional`) continua sendo gravado enquanto a coluna existir: ela
      // so morre na migracao B, depois que todo leitor passar a usar o id.
      const { rows } = await pool.query(
        `INSERT INTO public.agendamentos
           (telefone, cliente, profissional, profissional_id, servico,
            dia_marcado, hora_marcada, status, source, barbearia_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *,
           dia_marcado::text  AS dia_marcado,
           hora_marcada::text AS hora_marcada`,
        [
          telefone,
          cliente,
          alvo.nome,
          professionalId,
          servico,
          dia_marcado,
          hora_marcada,
          status,
          source,
          barbearia.id,
        ],
      );

      // Nao escrevemos em `dados_cliente` aqui. Aquela tabela e o cadastro de
      // contato do bot de WhatsApp, e ele e o dono unico dela: o telefone canonico
      // do sistema e o `wa_id` em digitos puros (`553384246770`). O codigo antigo
      // gravava o JID da Evolution (`...@s.whatsapp.net`) na coluna `nomewpp`, que
      // nem existe mais — criava linha duplicada do mesmo cliente e derrubava esta
      // rota com 500 DEPOIS de ja ter inserido o agendamento.

      return reply.status(201).send({
        message: "Agendamento criado.",
        event: mapEvent(rows[0], config.duracao_min),
      });
    } catch (err) {
      if (
        err?.code === "23505" &&
        err?.constraint === "agendamentos_slot_ativo_unique"
      ) {
        return reply.status(409).send({ error: "Horário indisponível." });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao criar agendamento." });
    }
    }),
  );

  // PUT /agendamentos/:id — atualiza agendamento completo
  fastify.put(
    "/agendamentos/:id",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const {
        telefone,
        cliente,
        profissional,
        servico,
        dia_marcado,
        hora_marcada,
        status,
      } = request.body ?? {};

      const fields = [];
      const params = [];
      const add = (col, val) => {
        params.push(val);
        fields.push(`${col} = $${params.length}`);
      };

      if (telefone !== undefined) add("telefone", telefone);
      if (cliente !== undefined) add("cliente", cliente);
      if (profissional !== undefined) add("profissional", profissional);
      if (servico !== undefined) add("servico", servico);
      if (dia_marcado !== undefined) add("dia_marcado", dia_marcado);
      if (hora_marcada !== undefined) add("hora_marcada", hora_marcada);
      if (status !== undefined) add("status", status);

      if (!fields.length)
        return reply
          .status(400)
          .send({ error: "Nenhum campo para atualizar." });

      params.push(id);
      try {
        const { rows } = await db.query(
          `UPDATE public.agendamentos
         SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *,
           dia_marcado::text  AS dia_marcado,
           hora_marcada::text AS hora_marcada`,
          params,
        );
        if (!rows.length)
          return reply
            .status(404)
            .send({ error: "Agendamento não encontrado." });
        return { event: mapEvent(rows[0]) };
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao atualizar agendamento." });
      }
    }),
  );

  // PATCH /agendamentos/:id/status — atualiza só o status
  fastify.patch(
    "/agendamentos/:id/status",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const { status } = request.body ?? {};
      const valid = [
        "agendado",
        "confirmado",
        "concluido",
        "cancelado",
        "reagendado",
      ];

      if (!status || !valid.includes(status)) {
        return reply.status(400).send({
          error: `Status inválido. Use: ${valid.join(", ")}`,
        });
      }

      try {
        const { rows } = await db.query(
          `UPDATE public.agendamentos
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status`,
          [status, id],
        );
        if (!rows.length)
          return reply
            .status(404)
            .send({ error: "Agendamento não encontrado." });
        return { id: rows[0].id, status: rows[0].status };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao atualizar status." });
      }
    }),
  );

  // DELETE /agendamentos/:id — remove agendamento
  fastify.delete(
    "/agendamentos/:id",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      try {
        const { rowCount } = await db.query(
          `DELETE FROM public.agendamentos WHERE id = $1`,
          [id],
        );
        if (!rowCount)
          return reply
            .status(404)
            .send({ error: "Agendamento não encontrado." });
        return { message: "Agendamento removido.", id: Number(id) };
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao remover agendamento." });
      }
    }),
  );

  // ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────

  // WHATSAPP CRM

  // A janela de atendimento da Meta dura 24h e **só reinicia com mensagem do
  // cliente** — resposta da empresa nao estende nada. Quem guarda esse prazo e
  // `whatsapp_contacts.service_window_until`, gravado so em `inbound` logo abaixo.
  //
  // Ate 2026-07-31 os dois filtros olhavam `conversations.last_message_at`, que
  // avanca com QUALQUER mensagem. O dono responder as 20:00 uma conversa cujo
  // cliente falou as 08:00 reiniciava o relogio: a conversa seguia aberta no painel
  // ate as 18:00 do dia seguinte, dez horas depois de a janela real ter fechado.
  //
  // A margem existe so pro painel: a conversa sai da lista com 2h de janela ainda
  // de pe, porque o dono le, pensa e digita — nao responde no instante em que abre.
  // O agrupamento de mensagens NAO usa margem; ele pergunta se a janela fechou de
  // verdade, senao uma resposta do bot chegando na hora limite partiria a conversa
  // viva em duas.
  const MARGEM_PAINEL_HORAS = 2;

  /**
   * Grava uma mensagem no CRM: upsert do contato, agrupamento na conversa certa e
   * insert da mensagem, tudo numa transacao.
   *
   * USA O POOL DE SERVICO, ou seja, IGNORA RLS — e isso e deliberado, com uma
   * invariante a proteger:
   *
   *   quem chama daqui do painel (`/conversations/:id/send`) JA carregou a conversa
   *   por `db.query`, sob RLS, e devolveu 404 quando ela nao era da barbearia dele.
   *   A posse esta provada antes desta funcao rodar.
   *
   * O outro chamador e o webhook do bot, que e servico e nao tem usuario.
   *
   * SE ALGUEM CHAMAR ISTO DE UM CAMINHO NOVO, tem que repetir essa checagem antes —
   * senao o painel de uma barbearia escreve no CRM de outra, sem erro.
   *
   * Extraida da rota em 2026-07-31 porque o `/send` do painel precisa exatamente
   * disto ao registrar a fala do dono. Uma segunda copia deste upsert seria a
   * chance perfeita de as duas divergirem — e a que ficasse errada seria a que o
   * dono le.
   */
  async function registrarMensagem(event) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const serviceWindowUntil =
          event.direction === "inbound"
            ? new Date(event.occurred_at.getTime() + 24 * 60 * 60 * 1000)
            : null;

        const { rows: contactRows } = await client.query(
          `INSERT INTO public.whatsapp_contacts
           (phone, wa_id, name, last_message_at, service_window_until, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (phone) DO UPDATE
           SET wa_id = COALESCE(EXCLUDED.wa_id, public.whatsapp_contacts.wa_id),
               name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), public.whatsapp_contacts.name),
               last_message_at = GREATEST(
                 COALESCE(public.whatsapp_contacts.last_message_at, EXCLUDED.last_message_at),
                 EXCLUDED.last_message_at
               ),
               service_window_until = CASE
                 WHEN EXCLUDED.service_window_until IS NULL THEN public.whatsapp_contacts.service_window_until
                 ELSE GREATEST(
                   COALESCE(public.whatsapp_contacts.service_window_until, EXCLUDED.service_window_until),
                   EXCLUDED.service_window_until
                 )
               END,
               updated_at = NOW()
         RETURNING id, phone, wa_id, name, service_window_until`,
          [
            event.phone,
            event.wa_id,
            event.name,
            event.occurred_at,
            serviceWindowUntil,
          ],
        );

        const contact = contactRows[0];

        let conversation;
        // A mensagem entra na conversa que ja esta aberta enquanto a janela do
        // contato nao fechou. O `IS NULL` cobre um caso real: se o espelho da
        // entrada falhar e o da saida passar, o contato nasce de um `outbound` e
        // fica sem janela — sem esta linha ele nunca mais agruparia nada.
        const { rows: conversationRows } = await client.query(
          `SELECT id, status
          FROM public.whatsapp_conversations
          WHERE contact_id = $1
            AND status <> 'closed'
            AND (
              $2::timestamptz > NOW()
              OR ($2::timestamptz IS NULL AND last_message_at > NOW() - INTERVAL '22 hours')
            )
          ORDER BY created_at DESC
          LIMIT 1`,
          [contact.id, contact.service_window_until],
        );

        if (conversationRows.length) {
          conversation = conversationRows[0];
          await client.query(
            `UPDATE public.whatsapp_conversations
           SET last_message_at = GREATEST(COALESCE(last_message_at, $2), $2),
               updated_at = NOW()
           WHERE id = $1`,
            [conversation.id, event.occurred_at],
          );
        } else {
          // Fecha conversas antigas open do mesmo contato (lazy expiration: a antiga
          // expirou pela janela de 22h, mas a constraint UNIQUE impede 2 open simultâneas)
          await client.query(
            `UPDATE public.whatsapp_conversations
              SET status = 'closed', updated_at = NOW()
            WHERE contact_id = $1 AND status <> 'closed'`,
            [contact.id],
          );

          const { rows } = await client.query(
            `INSERT INTO public.whatsapp_conversations
              (contact_id, status, last_message_at)
            VALUES ($1, 'open', $2)
            RETURNING id, status`,
            [contact.id, event.occurred_at],
          );
          conversation = rows[0];
        }

        const { rows: messageRows } = await client.query(
          `INSERT INTO public.whatsapp_messages
           (conversation_id, contact_id, direction, sender_type, whatsapp_message_id,
            message_type, body, raw_payload, created_at, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW())
         ON CONFLICT (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL DO UPDATE
           SET raw_payload = EXCLUDED.raw_payload
         RETURNING id, conversation_id, contact_id, direction, sender_type,
                   whatsapp_message_id, message_type, body, media_id, status,
                   created_at, received_at`,
          [
            conversation.id,
            contact.id,
            event.direction,
            event.sender_type,
            event.whatsapp_message_id,
            event.message_type,
            event.body,
            JSON.stringify(event.raw_payload ?? {}),
            event.occurred_at,
          ],
        );

        await client.query("COMMIT");
        return {
          contact,
          conversation: { id: conversation.id, status: conversation.status },
          message: mapWhatsAppMessage(messageRows[0]),
        };
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
  }

  // POST /whatsapp/events - porta de entrada de mensagem no CRM do calendario.
  // Quem alimentava isso era o n8n; hoje e o bot de botoes que escreve aqui, os dois
  // lados da conversa. Protegida por WHATSAPP_WEBHOOK_TOKEN.
  fastify.post(
    "/whatsapp/events",
    { preHandler: requireWebhookToken },
    async (request, reply) => {
      const event = extractInboundEvent(request.body);

      if (!["inbound", "outbound"].includes(event.direction)) {
        return reply
          .status(400)
          .send({ error: "direction deve ser inbound ou outbound." });
      }

      if (!event.phone) {
        return reply
          .status(400)
          .send({ error: "phone/Telefone/wa_id e obrigatorio." });
      }

      try {
        return reply.status(201).send(await registrarMensagem(event));
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao registrar evento do WhatsApp." });
      }
    },
  );

  // GET /whatsapp/conversations - lista conversas recentes
  fastify.get(
    "/whatsapp/conversations",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const limit = Math.min(Number(request.query.limit ?? 50) || 50, 100);
      try {
        const { rows } = await db.query(
          `SELECT c.id, c.status, c.assigned_to, c.last_message_at,
          ct.id AS contact_id, ct.phone, ct.wa_id, ct.name, ct.service_window_until,
          lm.direction AS last_direction,
          lm.sender_type AS last_sender_type,
          lm.message_type AS last_message_type,
          lm.body AS last_body,
          lm.created_at AS last_message_created_at,
          COALESCE(uc.unread_count, 0) AS unread_count
          FROM public.whatsapp_conversations c
          JOIN public.whatsapp_contacts ct ON ct.id = c.contact_id
          
          LEFT JOIN LATERAL (
            SELECT direction, sender_type, message_type, body, created_at
            FROM public.whatsapp_messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) lm ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS unread_count
            FROM public.whatsapp_messages m
            WHERE m.conversation_id = c.id
              AND m.direction = 'inbound'
              AND m.read_at IS NULL
          ) uc ON TRUE
          WHERE (
            ct.service_window_until > NOW() + make_interval(hours => $2)
            OR (
              ct.service_window_until IS NULL
              AND c.last_message_at > NOW() - INTERVAL '22 hours'
            )
          )
          ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
          LIMIT $1`,
          [limit, MARGEM_PAINEL_HORAS],
        );
        return rows.map(mapWhatsAppConversation);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar conversas." });
      }
    }),
  );

  // GET /whatsapp/conversations/:id/messages - mensagens de uma conversa
  fastify.get(
    "/whatsapp/conversations/:id/messages",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      try {
        const { rows } = await db.query(
          `SELECT id, conversation_id, contact_id, direction, sender_type,
                whatsapp_message_id, message_type, body, media_id, status,
                created_at, received_at
         FROM public.whatsapp_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC, id ASC`,
          [id],
        );
        return rows.map(mapWhatsAppMessage);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar mensagens." });
      }
    }),
  );

  // POST /whatsapp/conversations/:id/read - marca todas mensagens inbound como lidas
  fastify.post(
    "/whatsapp/conversations/:id/read",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      try {
        const { rows } = await db.query(
          `UPDATE public.whatsapp_messages
          SET read_at = NOW()
        WHERE conversation_id = $1
          AND direction = 'inbound'
          AND read_at IS NULL
        RETURNING id`,
          [id],
        );
        return { conversation_id: Number(id), marked_read: rows.length };
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao marcar conversa como lida." });
      }
    }),
  );

  /**
   * POST /whatsapp/conversations/:id/send — o dono responde pelo painel.
   *
   * O transporte e o bot: ele tem o token da Meta, e so ele monta payload da Cloud
   * API. Esta API pede que ele fale. O transporte anterior era o n8n, aposentado.
   *
   * A ordem dos passos e a regra mais importante daqui: **grava depois de enviar.**
   * Ao contrario, uma falha da Meta deixaria no painel uma mensagem que nunca
   * chegou no celular do cliente — e o dono ficaria esperando resposta de algo que
   * ninguem leu.
   */
  fastify.post(
    "/whatsapp/conversations/:id/send",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const { id } = request.params;
      const text = String(request.body?.body ?? "").trim();

      if (!text) return reply.status(400).send({ error: "Mensagem vazia." });

      if (!BOT_URL || !BOT_PAINEL_TOKEN) {
        return reply.status(503).send({
          error:
            "Envio pelo WhatsApp nao esta configurado. Preencha BOT_URL e BOT_PAINEL_TOKEN no .env desta API.",
        });
      }

      try {
        const { rows } = await db.query(
          `SELECT ct.wa_id, ct.phone, ct.service_window_until,
                  (ct.service_window_until > NOW()) AS janela_aberta
             FROM public.whatsapp_conversations c
             JOIN public.whatsapp_contacts ct ON ct.id = c.contact_id
            WHERE c.id = $1`,
          [id],
        );

        const destino = rows[0];
        if (!destino) {
          return reply.status(404).send({ error: "Conversa nao encontrada." });
        }

        // A trava usa a janela CRUA, sem a margem de 2h do painel. A margem existe
        // pra conversa sumir da lista antes do fim; recusar aqui as 22h seria negar
        // mensagem que a Meta ainda aceita.
        if (!destino.janela_aberta) {
          return reply.status(403).send({
            error:
              "A janela de 24h desta conversa fechou. So da pra escrever depois que o cliente mandar uma nova mensagem.",
            codigo: "janela_fechada",
            service_window_until: destino.service_window_until,
          });
        }

        const envio = await fetch(`${BOT_URL}/mensagens`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-painel-token": BOT_PAINEL_TOKEN,
          },
          body: JSON.stringify({ para: destino.wa_id || destino.phone, texto: text }),
        });

        if (!envio.ok) {
          const detalhe = await envio.text().catch(() => "");
          fastify.log.error(
            `Bot recusou o envio (${envio.status}): ${detalhe}`,
          );
          return reply.status(502).send({
            error: "Nao foi possivel enviar pelo WhatsApp agora.",
            codigo: "envio_falhou",
          });
        }

        const { wamid } = await envio.json().catch(() => ({}));

        // Saiu. Agora sim entra no painel — como `human`, que e o que separa a fala
        // do dono da fala do bot na mesma conversa.
        const registro = await registrarMensagem({
          direction: "outbound",
          sender_type: "human",
          phone: normalizeWhatsAppPhone(destino.phone),
          wa_id: destino.wa_id || destino.phone,
          name: null,
          message_type: "text",
          body: text,
          whatsapp_message_id: wamid ?? null,
          raw_payload: { origem: "painel" },
          occurred_at: new Date(),
        });

        return reply.status(201).send(registro.message);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao enviar mensagem pelo WhatsApp." });
      }
    }),
  );

  // GET /dashboard/resumo — tudo que a tela do Dashboard desenha, numa chamada.
  //
  // Uma chamada e nao seis, por duas razoes. A primeira e o teto: leitura admin
  // tem 30/min por IP e o painel ja gasta parte disso no polling da agenda. A
  // segunda pesa mais: a conta de "quantos horarios livres" precisa sair de UM
  // lugar. Enquanto o prototipo tinha tres fontes para esse numero, a tela dava
  // tres respostas diferentes ao mesmo tempo — 14, 9 e 6.
  //
  // A grade de horarios aqui e a mesma `buildSlots` da rota de disponibilidade.
  // Refazer essa conta no navegador seria a TERCEIRA copia da regra; o bot fala
  // HTTP com esta API exatamente para nao existir a segunda.
  fastify.get(
    "/dashboard/resumo",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      // Quem manda a data e o cliente, porque o fuso que importa e o do barbeiro
      // olhando a tela, nao o do processo. Sem parametro, vale o do servidor.
      const pedida = request.query?.date;
      const hoje =
        typeof pedida === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pedida)
          ? pedida
          : dataLocalISO();

      const PERIODOS = { hoje: 1, "7d": 7, "15d": 15, "30d": 30 };
      const MAIOR_PERIODO = 30;

      try {
        // `bigint` chega como string do Postgres. Convertido aqui, na entrada,
        // porque id numero e id texto se misturam calados: `[1].includes("1")`
        // e falso e nao levanta erro nenhum.
        const { rows: profRowsRaw } = await db.query(
          `SELECT id, nome, cor FROM public.profissionais
           WHERE ativo = TRUE ORDER BY id`,
        );
        const profRows = profRowsRaw.map((p) => ({ ...p, id: Number(p.id) }));

        if (!profRows.length) {
          return {
            gerado_em: new Date().toISOString(),
            hoje,
            profissionais: [],
            agenda: [],
            disponibilidade: { dias: [], vagas: {} },
            periodos: {},
          };
        }

        const configs = new Map(
          await Promise.all(
            profRows.map(async (p) => [p.id, await getAgendaConfig(p.id)]),
          ),
        );

        const janelaMax = Math.max(
          ...profRows.map((p) => configs.get(p.id).janela_agendamento_dias),
        );
        const inicioRetro = somarDias(hoje, -(MAIOR_PERIODO - 1));
        const fimFrente = somarDias(hoje, Math.max(janelaMax, MAIOR_PERIODO) - 1);

        const [agRes, blockRes, criadosRes] = await Promise.all([
          db.query(
            `SELECT a.id, a.cliente, a.telefone, a.status, a.source,
                    a.dia_marcado::text  AS dia_marcado,
                    a.hora_marcada::text AS hora_marcada,
                    p.id AS professional_id
             FROM public.agendamentos a
             LEFT JOIN public.profissionais p ON a.profissional = p.nome
             WHERE a.dia_marcado >= $1 AND a.dia_marcado <= $2`,
            [inicioRetro, fimFrente],
          ),
          db.query(
            `SELECT profissional_id, data::text AS data, periodos
             FROM public.dias_bloqueados
             WHERE data >= $1 AND data <= $2`,
            [inicioRetro, fimFrente],
          ),
          // `created_at` e outro eixo: conta quando alguem MARCOU, nao quando o
          // atendimento acontece. E o unico numero da tela que cai na hora se o
          // bot parar de pe. Agrupado em JS para o balde do dia respeitar o mesmo
          // fuso do resto — `date_trunc` no banco usaria o fuso do Postgres.
          db.query(
            `SELECT a.created_at, p.id AS professional_id
             FROM public.agendamentos a
             LEFT JOIN public.profissionais p ON a.profissional = p.nome
             WHERE a.created_at >= $1::date`,
            [inicioRetro],
          ),
        ]);

        // ── Indices em memoria ──────────────────────────────────────────────
        // `periodos` do bloqueio: `null` = dia inteiro, array = so aqueles turnos.
        // A chave carrega o profissional porque o bloqueio e de um so.
        const bloqueios = new Map();
        for (const b of blockRes.rows) {
          bloqueios.set(`${Number(b.profissional_id)}|${b.data}`, b.periodos);
        }
        const bloqueioDe = (profId, data) => {
          const chave = `${profId}|${data}`;
          return bloqueios.has(chave) ? bloqueios.get(chave) : undefined;
        };

        // Um horario esta ocupado quando existe linha VIVA nele. Cancelado
        // devolve o horario para a rua — e assim que um buraco aparece no meio
        // da tarde. `concluido` continua ocupando: aquele corte aconteceu.
        // `status` e nulo-permitido, e nulo aqui conta como marcado.
        for (const a of agRes.rows) {
          a.professional_id =
            a.professional_id == null ? null : Number(a.professional_id);
        }

        const ocupados = new Map();
        for (const a of agRes.rows) {
          if (a.status === "cancelado" || !a.professional_id) continue;
          const chave = `${a.professional_id}|${fmtDate(a.dia_marcado)}`;
          if (!ocupados.has(chave)) ocupados.set(chave, new Set());
          ocupados.get(chave).add(fmtTime(a.hora_marcada));
        }
        const ocupadosDe = (profId, data) =>
          ocupados.get(`${profId}|${data}`) ?? new Set();

        const criadosPorDia = new Map();
        for (const row of criadosRes.rows) {
          const dia = dataLocalISO(new Date(row.created_at));
          const chave = `${Number(row.professional_id) || 0}|${dia}`;
          criadosPorDia.set(chave, (criadosPorDia.get(chave) ?? 0) + 1);
        }

        // ── Grade de cada profissional em cada dia ──────────────────────────
        // Calculada UMA vez e reusada por todo mundo: disponibilidade, KPIs de
        // periodo, relogio. Duas leituras da mesma grade nao podem discordar
        // porque so existe uma.
        const grades = new Map(); // "profId|data" -> string[] | null
        const gradeDe = (profId, data) => {
          const chave = `${profId}|${data}`;
          if (!grades.has(chave)) {
            grades.set(
              chave,
              gradeDoDia(data, configs.get(profId), bloqueioDe(profId, data)),
            );
          }
          return grades.get(chave);
        };
        const livresDe = (profId, data) => {
          const grade = gradeDe(profId, data);
          if (!grade) return [];
          const tomados = ocupadosDe(profId, data);
          return grade.filter((s) => !tomados.has(s));
        };

        // ── Agenda de hoje ──────────────────────────────────────────────────
        const agenda = agRes.rows
          .filter(
            (a) => fmtDate(a.dia_marcado) === hoje && a.professional_id != null,
          )
          .map((a) => ({
            id: Number(a.id),
            professional_id: a.professional_id,
            hora: fmtTime(a.hora_marcada),
            duracao_min: configs.get(a.professional_id)?.duracao_min ?? 60,
            cliente: a.cliente,
            telefone: a.telefone,
            status: a.status,
            source: a.source,
          }))
          .sort((x, y) => x.hora.localeCompare(y.hora));

        // ── Disponibilidade: a janela de cada um, dia a dia ──────────────────
        // Cinco estados, e cada um com nome proprio. Colapsar "folga" com
        // "bloqueio" e com "acabou a janela" foi o defeito do grid antigo:
        // ausencia carregando tres significados diferentes.
        const dias = [];
        for (let i = 0; i < janelaMax; i++) {
          const data = somarDias(hoje, i);
          dias.push({ data, wd: dayOfWeekFromISO(data), hoje: i === 0 });
        }

        const vagas = {};
        for (const p of profRows) {
          const janelaDele = configs.get(p.id).janela_agendamento_dias;
          vagas[p.id] = dias.map((dia, i) => {
            if (i >= janelaDele) return { tipo: "fora" };
            const bloqueio = bloqueioDe(p.id, dia.data);
            if (!isWorkingDate(dia.data, configs.get(p.id))) {
              return { tipo: "fechado" };
            }
            if (bloqueio === null) return { tipo: "bloqueio" };
            const livres = livresDe(p.id, dia.data).length;
            return livres === 0
              ? { tipo: "lotado", vagas: 0 }
              : { tipo: "vagas", vagas: livres };
          });
        }

        // ── KPIs por periodo × profissional ─────────────────────────────────
        // `agendamentos`, `ocupacao` e `marcacoes` olham para TRAS (o periodo
        // que passou). `livres` olha para FRENTE, porque horario livre que ja
        // passou nao existe — e a unica direcao em que esse numero significa
        // alguma coisa. O rotulo na tela diz qual e qual.
        const agregado = (profIds, nDias) => {
          const retro = [];
          for (let i = 0; i < nDias; i++) retro.push(somarDias(hoje, -i));
          const frente = [];
          for (let i = 0; i < nDias; i++) frente.push(somarDias(hoje, i));

          const noPeriodo = agRes.rows.filter(
            (a) =>
              a.professional_id != null &&
              profIds.includes(a.professional_id) &&
              retro.includes(fmtDate(a.dia_marcado)),
          );
          const concluidos = noPeriodo.filter(
            (a) => a.status === "concluido",
          ).length;
          const cancelados = noPeriodo.filter(
            (a) => a.status === "cancelado",
          ).length;

          let capacidade = 0;
          let vagosRetro = 0;
          for (const profId of profIds) {
            for (const data of retro) {
              const grade = gradeDe(profId, data);
              if (!grade) continue;
              capacidade += grade.length;
              vagosRetro += livresDe(profId, data).length;
            }
          }

          let livresFrente = 0;
          let capacidadeFrente = 0;
          for (const profId of profIds) {
            for (const data of frente) {
              const grade = gradeDe(profId, data);
              if (!grade) continue;
              capacidadeFrente += grade.length;
              livresFrente += livresDe(profId, data).length;
            }
          }

          let marcacoes = 0;
          for (const profId of profIds) {
            for (const data of retro) {
              marcacoes += criadosPorDia.get(`${profId}|${data}`) ?? 0;
            }
          }

          return {
            agendamentos: {
              total: noPeriodo.length,
              concluidos,
              cancelados,
              ativos: noPeriodo.length - concluidos - cancelados,
            },
            ocupacao: {
              pct: capacidade
                ? Math.round(((capacidade - vagosRetro) / capacidade) * 100)
                : 0,
              capacidade,
              ocupados: capacidade - vagosRetro,
              profissionais: profIds.length,
            },
            livres: { total: livresFrente, capacidade: capacidadeFrente },
            marcacoes: { total: marcacoes },
          };
        };

        const todosIds = profRows.map((p) => p.id);
        const periodos = {};
        for (const [chave, nDias] of Object.entries(PERIODOS)) {
          periodos[chave] = { all: agregado(todosIds, nDias) };
          for (const id of todosIds) {
            periodos[chave][id] = agregado([id], nDias);
          }
        }

        return {
          gerado_em: new Date().toISOString(),
          hoje,
          profissionais: profRows.map((p) => ({
            id: p.id,
            nome: p.nome,
            cor: p.cor,
            expediente: {
              inicio: configs.get(p.id).hora_inicio,
              fim: configs.get(p.id).hora_fim,
              duracao_min: configs.get(p.id).duracao_min,
              intervalo_inicio: configs.get(p.id).intervalo_inicio,
              intervalo_duracao_min: configs.get(p.id).intervalo_duracao_min,
            },
            janela_dias: configs.get(p.id).janela_agendamento_dias,
            // A grade inteira do dia vai junto porque o relogio desenha TODOS os
            // horarios, nao so os vagos. Sem ela o navegador teria que refazer
            // `buildSlots` para saber o que existe — a terceira copia da regra
            // que este endpoint existe para nao ter. Com as duas listas na mao,
            // ocupado e subtracao de conjunto, nao conta de horario.
            grade_hoje: gradeDe(p.id, hoje) ?? [],
            capacidade_hoje: gradeDe(p.id, hoje)?.length ?? 0,
            livres_hoje: livresDe(p.id, hoje),
          })),
          agenda,
          disponibilidade: { dias, vagas },
          periodos,
        };
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao montar o resumo do dashboard." });
      }
    }),
  );

  // GET /servicos - catalogo de servicos, so leitura.
  //
  // ─── CONFIGURACOES DO SITE (29/09/2026) ────────────────────────────────────
  //
  // Leitura: `noSite` — o site publico le pelo slug, o painel pela sessao.
  // Escrita: `noPainel` — so o dono, e so a propria loja; a RLS garante.
  //
  // Historia: rotas com estes nomes ja existiram e sairam junto com o `AdminDrawer`
  // do site antigo, com a nota "ate existir tela nossa, o catalogo se edita pelo
  // Supabase". A tela agora existe: o modal de Configuracoes, feito pelo Victor. O
  // contrato e o dela — `docs/superpowers/specs/2026-09-27-configuracoes-site-agendamento.md`.

  /** Os padroes de uma loja que ainda nao salvou nada. O nome e o dela. */
  const homePadrao = (barbearia) => ({
    heroLine1: "Bem-vindo à",
    heroName: barbearia.nome,
    ctaLabel: "Agendar",
  });

  // GET /configuracao/home — os textos da pagina inicial.
  //
  // Objeto DIRETO, no formato do painel (decisao de 29/09/2026). O site publico, que
  // mora fora do repositorio, espera `{valor: ...}` e sera adaptado quando entrar —
  // ele ja precisa de adaptacao por causa do slug obrigatorio.
  fastify.get(
    "/configuracao/home",
    noSite(async (_request, reply, barbearia) => {
      try {
        const { rows } = await pool.query(
          `SELECT titulo_linha1, nome_destaque, texto_botao
             FROM public.configuracoes_site WHERE barbearia_id = $1`,
          [barbearia.id],
        );
        if (!rows.length) return homePadrao(barbearia);
        return {
          heroLine1: rows[0].titulo_linha1,
          heroName: rows[0].nome_destaque,
          ctaLabel: rows[0].texto_botao,
        };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar a configuração do site." });
      }
    }),
  );

  fastify.put(
    "/configuracao/home",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const texto = (v) => String(v ?? "").trim();
      const heroLine1 = texto(request.body?.heroLine1);
      const heroName = texto(request.body?.heroName);
      const ctaLabel = texto(request.body?.ctaLabel);

      // A tela ja recusa isto; o servidor recusa de novo, porque a tela nao e o
      // unico cliente possivel e uma home sem nome nem botao quebra o site inteiro.
      if (!heroName || !ctaLabel) {
        return reply
          .status(400)
          .send({ error: "O nome da barbearia e o texto do botão são obrigatórios." });
      }

      try {
        // `barbearia_atual()` e nao um id vindo do corpo: o dono so escreve na propria
        // loja, e quem diz qual e a loja dele e a sessao.
        await db.query(
          `INSERT INTO public.configuracoes_site
             (barbearia_id, titulo_linha1, nome_destaque, texto_botao)
           VALUES (public.barbearia_atual(), $1, $2, $3)
           ON CONFLICT (barbearia_id) DO UPDATE
             SET titulo_linha1 = EXCLUDED.titulo_linha1,
                 nome_destaque = EXCLUDED.nome_destaque,
                 texto_botao   = EXCLUDED.texto_botao,
                 atualizado_em = now()`,
          [heroLine1, heroName, ctaLabel],
        );
        return { heroLine1, heroName, ctaLabel };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao salvar a configuração do site." });
      }
    }),
  );

  // GET /categorias-servicos — as categorias da vitrine e o filtro.
  //
  // `id` no contrato e o SLUG, nao o numero da tabela. A tela gera o slug a partir do
  // rotulo e o usa como referencia em `servicos[].category`.
  fastify.get(
    "/categorias-servicos",
    noSite(async (_request, reply, barbearia) => {
      try {
        const [{ rows: itens }, { rows: conf }] = await Promise.all([
          pool.query(
            `SELECT slug, rotulo, ativa FROM public.categorias_servicos
              WHERE barbearia_id = $1 ORDER BY ordem, id`,
            [barbearia.id],
          ),
          pool.query(
            `SELECT filtro_categorias FROM public.configuracoes_site WHERE barbearia_id = $1`,
            [barbearia.id],
          ),
        ]);
        return {
          filtersEnabled: conf[0]?.filtro_categorias ?? true,
          items: itens.map((c) => ({ id: c.slug, label: c.rotulo, active: c.ativa })),
        };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar categorias." });
      }
    }),
  );

  fastify.put(
    "/categorias-servicos",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const itens = Array.isArray(request.body?.items) ? request.body.items : null;
      if (!itens) return reply.status(400).send({ error: "`items` deve ser uma lista." });

      const limpos = itens.map((c, ordem) => ({
        slug: String(c?.id ?? "").trim(),
        rotulo: String(c?.label ?? "").trim(),
        ativa: c?.active !== false,
        ordem,
      }));
      if (limpos.some((c) => !c.slug || !c.rotulo)) {
        return reply.status(400).send({ error: "Toda categoria precisa de id e nome." });
      }
      if (new Set(limpos.map((c) => c.slug)).size !== limpos.length) {
        return reply.status(400).send({ error: "Há categorias repetidas." });
      }

      try {
        // A tela nao deixa remover categoria com servico vinculado. O servidor confere
        // de novo: removida com servico ATIVO dentro, a vitrine mostraria o servico sem
        // categoria — ou pior, sumiria com ele do filtro sem ninguem ter pedido.
        const slugs = limpos.map((c) => c.slug);
        const { rows: presas } = await db.query(
          `SELECT c.slug, count(*)::int AS servicos
             FROM public.categorias_servicos c
             JOIN public.servicos s ON s.categoria_id = c.id AND s.ativo
            WHERE NOT (c.slug = ANY($1))
            GROUP BY c.slug`,
          [slugs],
        );
        if (presas.length) {
          return reply.status(409).send({
            error: `A categoria "${presas[0].slug}" ainda tem serviços ativos.`,
            codigo: "categoria_em_uso",
          });
        }

        await db.query(
          `DELETE FROM public.categorias_servicos WHERE NOT (slug = ANY($1))`,
          [slugs],
        );
        for (const c of limpos) {
          await db.query(
            `INSERT INTO public.categorias_servicos (barbearia_id, slug, rotulo, ativa, ordem)
             VALUES (public.barbearia_atual(), $1, $2, $3, $4)
             ON CONFLICT (barbearia_id, slug) DO UPDATE
               SET rotulo = EXCLUDED.rotulo, ativa = EXCLUDED.ativa, ordem = EXCLUDED.ordem`,
            [c.slug, c.rotulo, c.ativa, c.ordem],
          );
        }

        // O filtro mora na linha de configuracao. Se ela ainda nao existe, nasce com
        // os padroes da pagina inicial — o nome da propria loja.
        const filtersEnabled = request.body?.filtersEnabled !== false;
        await db.query(
          `INSERT INTO public.configuracoes_site (barbearia_id, nome_destaque, filtro_categorias)
           SELECT id, nome, $1 FROM public.barbearias WHERE id = public.barbearia_atual()
           ON CONFLICT (barbearia_id) DO UPDATE
             SET filtro_categorias = EXCLUDED.filtro_categorias, atualizado_em = now()`,
          [filtersEnabled],
        );

        return {
          filtersEnabled,
          items: limpos.map((c) => ({ id: c.slug, label: c.rotulo, active: c.ativa })),
        };
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao salvar categorias." });
      }
    }),
  );

  // PUT /servicos — a lista INTEIRA do catalogo da loja.
  //
  // Tres casos por item:
  //  - `id` positivo: servico existente. Tem que ser DESTA loja — a RLS esconde os de
  //    outra, entao o update afetaria zero linhas, e isso vira 400 em vez de sucesso
  //    silencioso.
  //  - `id` ausente ou <= 0: servico novo. A tela marca os novos com id negativo
  //    temporario (-1, -2...).
  //  - servico ativo da loja que NAO veio na lista: DESATIVADO, nao apagado (decisao de
  //    29/09/2026). Some do site; o historico de agendamentos continua fazendo sentido.
  //
  // DEVOLVE A LISTA COMO FICOU, com os ids reais. A tela precisa trocar o rascunho por
  // ela: se guardasse o proprio rascunho, o servico novo continuaria com id -1 e seria
  // criado DE NOVO no proximo salvamento.
  fastify.put(
    "/servicos",
    { preHandler: requireAdmin },
    noPainel(async (request, reply, db) => {
      const itens = Array.isArray(request.body) ? request.body : null;
      if (!itens) return reply.status(400).send({ error: "O corpo deve ser a lista de serviços." });

      const PRECO = /^\d+(?:[.,]\d{1,2})?$/;
      const limpos = itens.map((sv, ordem) => ({
        id: Number(sv?.id) > 0 ? Number(sv.id) : null,
        nome: String(sv?.name ?? "").trim(),
        descricao: String(sv?.desc ?? "").trim(),
        categoria: String(sv?.category ?? "").trim(),
        preco: String(sv?.price ?? "").trim().replace(",", "."),
        slug:
          String(sv?.slug ?? "").trim() ||
          String(sv?.name ?? "").toLowerCase().normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        ordem,
      }));

      const invalido = limpos.find((sv) => !sv.nome || !PRECO.test(sv.preco));
      if (invalido) {
        return reply
          .status(400)
          .send({ error: `Serviço inválido: "${invalido.nome || "sem nome"}". Confira nome e preço.` });
      }

      try {
        const { rows: cats } = await db.query(`SELECT id, slug FROM public.categorias_servicos`);
        const idDaCategoria = new Map(cats.map((c) => [c.slug, c.id]));
        const semCategoria = limpos.find((sv) => sv.categoria && !idDaCategoria.has(sv.categoria));
        if (semCategoria) {
          return reply.status(400).send({
            error: `A categoria "${semCategoria.categoria}" não existe. Salve as categorias antes dos serviços.`,
          });
        }

        const mantidos = [];
        for (const sv of limpos) {
          const valores = [
            sv.nome, sv.descricao || null, sv.preco,
            idDaCategoria.get(sv.categoria) ?? null, sv.slug, sv.ordem,
          ];
          if (sv.id) {
            const { rowCount } = await db.query(
              `UPDATE public.servicos
                  SET nome = $1, descricao = $2, preco = $3, categoria_id = $4,
                      slug = $5, ordem = $6, ativo = TRUE
                WHERE id = $7`,
              [...valores, sv.id],
            );
            // Zero linhas = o id nao e desta loja (a RLS escondeu) ou nao existe. Nos
            // dois casos a resposta certa e recusar, nao fingir que salvou.
            if (!rowCount) {
              throw Object.assign(new Error("Um dos serviços não pertence a esta barbearia."), {
                statusCode: 400,
              });
            }
            mantidos.push(sv.id);
          } else {
            const { rows } = await db.query(
              `INSERT INTO public.servicos
                 (nome, descricao, preco, categoria_id, slug, ordem, ativo, barbearia_id)
               VALUES ($1, $2, $3, $4, $5, $6, TRUE, public.barbearia_atual())
               RETURNING id`,
              valores,
            );
            mantidos.push(Number(rows[0].id));
          }
        }

        await db.query(
          `UPDATE public.servicos SET ativo = FALSE WHERE ativo AND NOT (id = ANY($1))`,
          [mantidos],
        );

        const { rows } = await db.query(
          `SELECT s.id, s.slug, s.nome, s.descricao, s.preco, c.slug AS categoria_slug
             FROM public.servicos s
             LEFT JOIN public.categorias_servicos c ON c.id = s.categoria_id
            WHERE s.ativo
            ORDER BY s.ordem ASC NULLS LAST, s.id ASC`,
        );
        return rows.map(mapServiceRow);
      } catch (err) {
        // RELANCADO, e nao respondido aqui. Responder daqui faria o handler terminar
        // normalmente — e o `noPainel` COMMITARIA os servicos gravados antes do item
        // invalido. Subindo, o `comUsuario` desfaz a transacao inteira, e o Fastify
        // responde com o `statusCode` que o erro carrega. A primeira versao desta rota
        // tinha o comentario certo e o codigo errado (29/09/2026).
        if (err.statusCode === 400) throw err;
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao salvar serviços." });
      }
    }),
  );

  // O EventModal usa isto pro dropdown de servico, e o site publico pra vitrine.
  fastify.get(
    "/servicos",
    noSite(async (_request, reply, barbearia) => {
    try {
      return await getServicesFromTables(barbearia.id);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar servicos." });
    }
    }),
  );

  return fastify;
}

export { buildServer };

function start() {
  const fastify = buildServer();
  fastify
    .listen({ port: PORT, host: "0.0.0.0" })
    .then(async () => {
      fastify.log.info(`Servidor rodando na porta ${PORT}`);
      // Depois do listen, nao antes: a porta ja atende enquanto o pool esquenta.
      fastify.log.info(`Pool aquecido: ${await aquecerPool()} conexoes`);
    })
    .catch((err) => {
      fastify.log.error(err);
      process.exit(1);
    });
}

// Em serverless nao ha porta pra escutar: quem chama e o handler de
// `api/[...caminho].mjs`, que importa `buildServer`. Escutar aqui faria a funcao
// subir um servidor que ninguem alcanca e travar a resposta.
if (!EM_SERVERLESS) {
  start();
}
