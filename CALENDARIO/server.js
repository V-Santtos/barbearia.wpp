import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { timingSafeEqual } from "crypto";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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

const PORT = process.env.PORT || 3333;
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
];
const ALLOWED_CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(process.env.CORS_ORIGINS ? [] : DEFAULT_CORS_ORIGINS),
);
const whatsappMemory = {
  contacts: new Map(),
  conversations: new Map(),
  messages: new Map(),
  nextConversationId: 1,
  nextMessageId: 1,
};
const rateLimitBuckets = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (method === "POST" && path === "/whatsapp/events")
    return { max: 30, label: "whatsapp-webhook" };
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

function normalizeBookingWindowDays(
  value,
  fallback = DEFAULT_AGENDA.janela_agendamento_dias,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 7), 15);
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

function normalizeWhatsAppJid(value) {
  const phone = normalizeWhatsAppPhone(value);
  return phone ? `${phone}@s.whatsapp.net` : "";
}

function firstNameFromFullName(value) {
  return (
    String(value ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] ?? ""
  );
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

function upsertWhatsAppMemoryEvent(event) {
  const now = new Date();
  const serviceWindowUntil =
    event.direction === "inbound"
      ? new Date(
          event.occurred_at.getTime() + 24 * 60 * 60 * 1000,
        ).toISOString()
      : undefined;

  const contact = {
    ...(whatsappMemory.contacts.get(event.phone) ?? {}),
    id:
      whatsappMemory.contacts.get(event.phone)?.id ??
      whatsappMemory.contacts.size + 1,
    phone: event.phone,
    wa_id: event.wa_id ?? event.phone,
    name:
      event.name ??
      whatsappMemory.contacts.get(event.phone)?.name ??
      event.phone,
    last_message_at: event.occurred_at.toISOString(),
    service_window_until:
      serviceWindowUntil ??
      whatsappMemory.contacts.get(event.phone)?.service_window_until ??
      null,
    updated_at: now.toISOString(),
  };
  whatsappMemory.contacts.set(event.phone, contact);

  let conversation = [...whatsappMemory.conversations.values()].find(
    (item) => item.contact.phone === event.phone && item.status !== "closed",
  );

  if (!conversation) {
    conversation = {
      id: whatsappMemory.nextConversationId++,
      status: "open",
      assigned_to: null,
      last_message_at: event.occurred_at.toISOString(),
      contact,
      last_message: null,
    };
    whatsappMemory.conversations.set(conversation.id, conversation);
    whatsappMemory.messages.set(conversation.id, []);
  }

  const message = {
    id: whatsappMemory.nextMessageId++,
    conversation_id: conversation.id,
    contact_id: contact.id,
    direction: event.direction,
    sender_type: event.sender_type,
    whatsapp_message_id: event.whatsapp_message_id,
    message_type: event.message_type,
    body: event.body,
    media_id: null,
    status: null,
    created_at: event.occurred_at.toISOString(),
    received_at: now.toISOString(),
  };

  const messages = whatsappMemory.messages.get(conversation.id) ?? [];
  const alreadyExists =
    event.whatsapp_message_id &&
    messages.some(
      (item) => item.whatsapp_message_id === event.whatsapp_message_id,
    );

  if (!alreadyExists) {
    messages.push(message);
    whatsappMemory.messages.set(conversation.id, messages);
  }

  conversation.contact = contact;
  conversation.last_message_at = event.occurred_at.toISOString();
  conversation.last_message = {
    direction: event.direction,
    sender_type: event.sender_type,
    message_type: event.message_type,
    body: event.body,
    created_at: event.occurred_at.toISOString(),
  };
  whatsappMemory.conversations.set(conversation.id, conversation);

  return { contact, conversation, message };
}

function listWhatsAppMemoryConversations(limit = 50) {
  return [...whatsappMemory.conversations.values()]
    .sort((a, b) =>
      String(b.last_message_at).localeCompare(String(a.last_message_at)),
    )
    .slice(0, limit);
}

function listWhatsAppMemoryMessages(conversationId) {
  return whatsappMemory.messages.get(Number(conversationId)) ?? [];
}

function isMissingTableError(err) {
  return err?.code === "42P01";
}

async function getConfigValue(chave) {
  const { rows } = await pool.query(
    "SELECT valor FROM public.configuracao WHERE chave = $1",
    [chave],
  );
  return rows[0]?.valor ?? null;
}

function normalizeCategoryConfig(value) {
  if (Array.isArray(value)) return { filtersEnabled: false, items: value };
  return {
    filtersEnabled: Boolean(value?.filtersEnabled),
    items: Array.isArray(value?.items) ? value.items : [],
  };
}

function normalizeServiceCatalog(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: Number(item.id ?? 0),
      slug: String(item.slug ?? "").trim(),
      name: String(item.name ?? "").trim(),
      desc: String(item.desc ?? "").trim(),
      price: String(item.price ?? "").trim(),
      category: String(item.category ?? "").trim(),
    }))
    .filter((item) => item.slug && item.name);
}

function normalizeServicesForSave(items) {
  if (!Array.isArray(items)) return null;
  return items.map((item) => ({
    id: Number(item?.id ?? 0),
    slug: String(item?.slug ?? "").trim(),
    name: String(item?.name ?? "").trim(),
    desc: String(item?.desc ?? "").trim(),
    price: String(item?.price ?? "").trim(),
    category: String(item?.category ?? "").trim(),
  }));
}

function mapServiceRow(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    category: row.categoria_id ?? "",
    name: row.nome,
    desc: row.descricao ?? "",
    price: row.preco ?? "",
  };
}

async function getServiceCategoriesFromTables() {
  const config = normalizeCategoryConfig(await getConfigValue("categorias"));
  const { rows } = await pool.query(
    `SELECT id, nome, ativo
     FROM public.categorias_servicos
     ORDER BY ordem ASC, nome ASC`,
  );
  return {
    filtersEnabled: config.filtersEnabled,
    items: rows.map((row) => ({
      id: row.id,
      label: row.nome,
      active: row.ativo,
    })),
  };
}

async function getServicesFromTables() {
  const { rows } = await pool.query(
    `SELECT id, slug, nome, descricao, preco, categoria_id
     FROM public.servicos
     WHERE ativo = TRUE
     ORDER BY ordem ASC, id ASC`,
  );
  return rows.map(mapServiceRow);
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

function buildServer() {
  const fastify = Fastify({ logger: true });
  const requireAdmin = buildTokenGuard("ADMIN_API_TOKEN", "ADMIN_API_TOKEN");
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

  // ─── HEALTH CHECK ──────────────────────────────────────────────────────────
  fastify.get("/", async () => ({
    status: "ok",
    message: "API da barbearia funcionando!",
  }));

  // ─── PROFISSIONAIS ─────────────────────────────────────────────────────────

  // GET /profissionais — lista ativos
  fastify.get("/profissionais", async (_req, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, nome, cor, ativo, created_at
         FROM public.profissionais
         WHERE ativo = TRUE
         ORDER BY nome ASC`,
      );
      return rows.map(mapProfessional);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar profissionais." });
    }
  });

  // GET /profissionais/:id/agenda — DisableDays reais (fora de dias_semana + bloqueados manualmente)
  fastify.get("/profissionais/:id/agenda", async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows: proRows } = await pool.query(
        `SELECT 1 FROM public.profissionais WHERE id = $1 AND ativo = TRUE`,
        [id],
      );
      if (!proRows.length)
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
  });

  // GET /profissionais/:id/agenda-config — configuração de dias e horários
  fastify.get("/profissionais/:id/agenda-config", async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows: proRows } = await pool.query(
        `SELECT 1 FROM public.profissionais WHERE id = $1 AND ativo = TRUE`,
        [id],
      );
      if (!proRows.length)
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
  });

  // PUT /profissionais/:id/agenda-config — salva config (upsert)
  fastify.put(
    "/profissionais/:id/agenda-config",
    { preHandler: requireAdmin },
    async (request, reply) => {
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
          error: "janela_agendamento_dias deve ficar entre 7 e 15.",
        });
      }

      try {
        const { rows } = await pool.query(
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
            const { rows } = await pool.query(
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
    },
  );

  // GET /profissionais/:id/dias-bloqueados — lista datas bloqueadas manualmente
  fastify.get("/profissionais/:id/dias-bloqueados", async (request, reply) => {
    const { id } = request.params;
    const { date } = request.query ?? {};
    try {
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
  });

  // POST /profissionais/:id/dias-bloqueados — bloqueia uma data
  fastify.post(
    "/profissionais/:id/dias-bloqueados",
    { preHandler: requireAdmin },
    async (request, reply) => {
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
          const { rowCount } = await pool.query(
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

        const { rows } = await pool.query(
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
    },
  );

  // DELETE /profissionais/:id/dias-bloqueados/:data — desbloqueia uma data
  fastify.delete(
    "/profissionais/:id/dias-bloqueados/:data",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, data } = request.params;
      try {
        const { rowCount } = await pool.query(
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
    },
  );

  // POST /profissionais — cria
  fastify.post(
    "/profissionais",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { nome, cor } = request.body ?? {};
      if (!nome || !cor)
        return reply
          .status(400)
          .send({ error: "nome e cor são obrigatórios." });

      try {
        const { rows } = await pool.query(
          `INSERT INTO public.profissionais (nome, cor, ativo)
         VALUES ($1, $2, TRUE)
         RETURNING id, nome, cor, ativo, created_at`,
          [nome, cor],
        );
        return reply.status(201).send(mapProfessional(rows[0]));
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao criar profissional." });
      }
    },
  );

  // PATCH /profissionais/:id — atualiza campos
  fastify.patch(
    "/profissionais/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
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
        const { rows } = await pool.query(
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
    },
  );

  // DELETE /profissionais/:id — soft delete
  fastify.delete(
    "/profissionais/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const { rows } = await pool.query(
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
    },
  );

  // ─── AGENDAMENTOS ──────────────────────────────────────────────────────────

  // GET /agendamentos/verificar-telefone?phone=
  fastify.get("/agendamentos/verificar-telefone", async (request, reply) => {
    const { phone } = request.query;
    if (!phone)
      return reply.status(400).send({ error: "phone é obrigatório." });

    try {
      const { rows } = await pool.query(
        `SELECT servico, profissional, dia_marcado::text, hora_marcada::text, source
         FROM public.agendamentos
         WHERE telefone = $1
           AND status = ANY($2)
         ORDER BY created_at DESC
         LIMIT 1`,
        [phone, BOOKED_STATUSES],
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
  });

  // GET /agendamentos/horarios-disponiveis?professionalId=&date= — slots dinâmicos por profissional
  fastify.get("/agendamentos/horarios-disponiveis", async (request, reply) => {
    const { professionalId, date } = request.query;
    if (!professionalId || !date)
      return reply
        .status(400)
        .send({ error: "professionalId e date são obrigatórios." });

    try {
      const [config, blockedResult, bookedResult] = await Promise.all([
        getAgendaConfig(professionalId),
        pool.query(
          `SELECT periodos FROM public.dias_bloqueados
           WHERE profissional_id = $1 AND data = $2
           LIMIT 1`,
          [professionalId, date],
        ),
        pool.query(
          `SELECT a.hora_marcada::text
           FROM public.agendamentos a
           JOIN public.profissionais p ON a.profissional = p.nome
           WHERE p.id = $1
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
  });

  // GET /agendamentos/dias-disponiveis?professionalId=&days=10 — próximos dias com pelo menos um horário livre
  fastify.get("/agendamentos/dias-disponiveis", async (request, reply) => {
    const { professionalId, days } = request.query;
    if (!professionalId)
      return reply.status(400).send({ error: "professionalId é obrigatório." });

    const today = new Date();
    const openDays = [];
    const disabledDays = [];

    try {
      const { rows: proRows } = await pool.query(
        `SELECT 1 FROM public.profissionais WHERE id = $1 AND ativo = TRUE`,
        [professionalId],
      );
      if (!proRows.length) {
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
        pool.query(
          `SELECT a.hora_marcada::text, a.dia_marcado::text
           FROM public.agendamentos a
           JOIN public.profissionais p ON a.profissional = p.nome
           WHERE p.id = $1
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
  });

  // GET /agendamentos — aceita ?professionalId= e/ou ?date=
  fastify.get(
    "/agendamentos",
    { preHandler: requireAdmin },
    async (request, reply) => {
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

        const { rows } = await pool.query(query, params);
        return rows.map((r) => mapEvent(r, r.duracao_min ?? 60));
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao buscar agendamentos." });
      }
    },
  );

  // POST /agendamentos — cria agendamento
  fastify.post("/agendamentos", async (request, reply) => {
    const {
      telefone = "",
      cliente,
      profissional,
      servico = "",
      dia_marcado,
      hora_marcada,
      status = "confirmado",
      source = "app-etapas",
    } = request.body ?? {};

    if (!cliente || !profissional || !dia_marcado || !hora_marcada) {
      return reply.status(400).send({
        error:
          "Campos obrigatórios: cliente, profissional, dia_marcado, hora_marcada.",
      });
    }

    try {
      const { rows: proRows } = await pool.query(
        `SELECT id FROM public.profissionais WHERE nome = $1 AND ativo = TRUE LIMIT 1`,
        [profissional],
      );
      if (!proRows.length) {
        return reply
          .status(404)
          .send({ error: "Profissional não encontrado." });
      }

      const professionalId = proRows[0].id;
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
         WHERE a.profissional = $1
           AND a.dia_marcado = $2
           AND a.status = ANY($3)`,
        [profissional, dia_marcado, BOOKED_STATUSES],
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

      const { rows } = await pool.query(
        `INSERT INTO public.agendamentos
           (telefone, cliente, profissional, servico, dia_marcado, hora_marcada, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *,
           dia_marcado::text  AS dia_marcado,
           hora_marcada::text AS hora_marcada`,
        [
          telefone,
          cliente,
          profissional,
          servico,
          dia_marcado,
          hora_marcada,
          status,
          source,
        ],
      );

      const clientePrimeiroNome = firstNameFromFullName(cliente);
      const telefoneWhatsApp = normalizeWhatsAppJid(telefone);
      if (telefoneWhatsApp && clientePrimeiroNome) {
        const { rowCount } = await pool.query(
          `UPDATE public.dados_cliente
           SET nomewpp = COALESCE(NULLIF(nomewpp, ''), $2)
           WHERE telefone = $1`,
          [telefoneWhatsApp, clientePrimeiroNome],
        );
        if (!rowCount) {
          await pool.query(
            `INSERT INTO public.dados_cliente
               (telefone, nomewpp, atendimento_temporario)
             VALUES ($1, $2, FALSE)`,
            [telefoneWhatsApp, clientePrimeiroNome],
          );
        }
      }

      // ─── NOTIFICA O N8N (fire-and-forget) ─────────────────────────────────
      // Se o n8n estiver fora do ar ou demorar, o agendamento continua valendo.
      // Falhas são logadas mas não bloqueiam a resposta pro cliente.
      const webhookUrl = process.env.N8N_AGENDAMENTO_WEBHOOK_URL;
      if (webhookUrl) {
        const agendamentoCriado = rows[0];
        const payload = {
          event: "agendamento.criado",
          timestamp: new Date().toISOString(),
          agendamento: {
            id: agendamentoCriado.id,
            cliente: agendamentoCriado.cliente,
            telefone: agendamentoCriado.telefone,
            telefone_whatsapp: telefoneWhatsApp || null,
            profissional: agendamentoCriado.profissional,
            professional_id: professionalId,
            servico: agendamentoCriado.servico,
            dia_marcado: agendamentoCriado.dia_marcado,
            hora_marcada: agendamentoCriado.hora_marcada,
            status: agendamentoCriado.status,
            source: agendamentoCriado.source,
            created_at: agendamentoCriado.created_at,
          },
        };

        // Timeout de 5s pra não segurar o event loop se o n8n travar
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
          .then((res) => {
            if (!res.ok) {
              fastify.log.warn(
                { status: res.status, webhookUrl },
                "Webhook n8n respondeu com erro (agendamento criado mesmo assim)",
              );
            }
          })
          .catch((err) => {
            fastify.log.warn(
              { err: err.message, webhookUrl },
              "Falha ao notificar webhook n8n (agendamento criado mesmo assim)",
            );
          })
          .finally(() => clearTimeout(timeoutId));
      }
      // ──────────────────────────────────────────────────────────────────────

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
  });

  // PUT /agendamentos/:id — atualiza agendamento completo
  fastify.put(
    "/agendamentos/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
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
        const { rows } = await pool.query(
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
    },
  );

  // PATCH /agendamentos/:id/status — atualiza só o status
  fastify.patch(
    "/agendamentos/:id/status",
    { preHandler: requireAdmin },
    async (request, reply) => {
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
        const { rows } = await pool.query(
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
    },
  );

  // DELETE /agendamentos/:id — remove agendamento
  fastify.delete(
    "/agendamentos/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const { rowCount } = await pool.query(
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
    },
  );

  // ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────

  // WHATSAPP CRM

  // POST /whatsapp/events - espelha mensagens do N8N para o CRM do calendario
  fastify.post(
    "/whatsapp/events",
    { preHandler: requireWebhookToken },
    async (request, reply) => {
      const event = extractInboundEvent(request.body);
      const shouldPersist =
        request.query?.persist !== "false" && request.body?.persist !== false;

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

      if (!shouldPersist) {
        const stored = upsertWhatsAppMemoryEvent(event);
        return reply.status(202).send({
          accepted: true,
          persisted: false,
          memory: true,
          conversation_id: stored.conversation.id,
          event: {
            direction: event.direction,
            sender_type: event.sender_type,
            phone: event.phone,
            wa_id: event.wa_id,
            name: event.name,
            message_type: event.message_type,
            body: event.body,
            whatsapp_message_id: event.whatsapp_message_id,
            occurred_at: event.occurred_at.toISOString(),
          },
        });
      }

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
        const { rows: conversationRows } = await client.query(
          `SELECT id, status
          FROM public.whatsapp_conversations
          WHERE contact_id = $1
            AND status <> 'closed'
            AND last_message_at > NOW() - INTERVAL '22 hours'
          ORDER BY created_at DESC
          LIMIT 1`,
          [contact.id],
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
        return reply.status(201).send({
          contact,
          conversation: { id: conversation.id, status: conversation.status },
          message: mapWhatsAppMessage(messageRows[0]),
        });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao registrar evento do WhatsApp." });
      } finally {
        client.release();
      }
    },
  );

  // GET /whatsapp/conversations - lista conversas recentes
  fastify.get(
    "/whatsapp/conversations",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const limit = Math.min(Number(request.query.limit ?? 50) || 50, 100);
      try {
        const { rows } = await pool.query(
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
          WHERE c.last_message_at > NOW() - INTERVAL '22 hours'
          ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
          LIMIT $1`,
          [limit],
        );
        return rows.map(mapWhatsAppConversation);
      } catch (err) {
        if (err?.code === "42P01")
          return listWhatsAppMemoryConversations(limit);
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar conversas." });
      }
    },
  );

  // GET /whatsapp/conversations/:id/messages - mensagens de uma conversa
  fastify.get(
    "/whatsapp/conversations/:id/messages",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const { rows } = await pool.query(
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
        if (err?.code === "42P01") return listWhatsAppMemoryMessages(id);
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao buscar mensagens." });
      }
    },
  );

  // POST /whatsapp/conversations/:id/read - marca todas mensagens inbound como lidas
  fastify.post(
    "/whatsapp/conversations/:id/read",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const { rows } = await pool.query(
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
        if (err?.code === "42P01") {
          return { conversation_id: Number(id), marked_read: 0, memory: true };
        }
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao marcar conversa como lida." });
      }
    },
  );

  // POST /whatsapp/conversations/:id/send — atendente responde via n8n → Evolution
  fastify.post(
    "/whatsapp/conversations/:id/send",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const text = String(request.body?.body ?? "").trim();

      if (!text) return reply.status(400).send({ error: "Mensagem vazia." });

      const webhookUrl = process.env.N8N_SEND_WEBHOOK_URL;
      if (!webhookUrl) {
        return reply.status(503).send({
          error: "Envio não configurado (N8N_SEND_WEBHOOK_URL ausente).",
        });
      }

      const client = await pool.connect();
      try {
        // Resolve telefone do contato a partir da conversa
        const { rows: convRows } = await client.query(
          `SELECT c.id AS conversation_id, c.contact_id, ct.phone, ct.wa_id
             FROM public.whatsapp_conversations c
             JOIN public.whatsapp_contacts ct ON ct.id = c.contact_id
            WHERE c.id = $1`,
          [id],
        );
        if (!convRows.length)
          return reply.status(404).send({ error: "Conversa não encontrada." });
        const conv = convRows[0];

        // 1) Dispara o envio no n8n. Só grava se o n8n aceitar (2xx).
        const waResp = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.N8N_SEND_TOKEN
              ? { "x-webhook-token": process.env.N8N_SEND_TOKEN }
              : {}),
          },
          body: JSON.stringify({
            conversation_id: conv.conversation_id,
            telefone: conv.phone,
            wa_id: conv.wa_id,
            mensagem: text,
          }),
        });

        if (!waResp.ok) {
          const detail = await waResp.text().catch(() => "");
          fastify.log.error(
            { status: waResp.status, detail },
            "Falha no webhook de envio",
          );
          return reply
            .status(502)
            .send({ error: "Falha ao enviar pelo WhatsApp (n8n/Evolution)." });
        }

        // 2) Grava como outbound (aparece na thread). raw_payload '{}' por segurança de schema.
        const { rows: msgRows } = await client.query(
          `INSERT INTO public.whatsapp_messages
             (conversation_id, contact_id, direction, sender_type, message_type,
              body, raw_payload, created_at, received_at, read_at)
           VALUES ($1, $2, 'outbound', 'human', 'text', $3, '{}'::jsonb, NOW(), NOW(), NOW())
           RETURNING id, conversation_id, contact_id, direction, sender_type,
                     whatsapp_message_id, message_type, body, media_id, status,
                     created_at, received_at`,
          [conv.conversation_id, conv.contact_id, text],
        );

        // 3) Mantém a conversa viva (não expira pela janela de 22h)
        await client.query(
          `UPDATE public.whatsapp_conversations
              SET last_message_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [conv.conversation_id],
        );

        return reply.status(201).send(mapWhatsAppMessage(msgRows[0]));
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao enviar mensagem." });
      } finally {
        client.release();
      }
    },
  );

  // DELETE /whatsapp/memory - limpa somente o buffer temporario de testes
  fastify.delete("/whatsapp/memory", { preHandler: requireAdmin }, async () => {
    whatsappMemory.contacts.clear();
    whatsappMemory.conversations.clear();
    whatsappMemory.messages.clear();
    whatsappMemory.nextConversationId = 1;
    whatsappMemory.nextMessageId = 1;
    return { message: "Buffer temporario do WhatsApp CRM limpo." };
  });

  // GET /categorias-servicos - catalogo estruturado com fallback para configuracao
  fastify.get("/categorias-servicos", async (_request, reply) => {
    try {
      return await getServiceCategoriesFromTables();
    } catch (err) {
      if (isMissingTableError(err)) {
        return normalizeCategoryConfig(await getConfigValue("categorias"));
      }
      fastify.log.error(err);
      return reply
        .status(500)
        .send({ error: "Erro ao buscar categorias de servicos." });
    }
  });

  // PUT /categorias-servicos - substitui catalogo de categorias e espelha filtersEnabled
  fastify.put(
    "/categorias-servicos",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const payload = normalizeCategoryConfig(request.body);
      const items = payload.items
        .map((item, index) => ({
          id: String(item.id ?? "").trim(),
          label: String(item.label ?? "").trim(),
          active: item.active !== false,
          ordem: index + 1,
        }))
        .filter((item) => item.id && item.label);

      const legacyValue = { filtersEnabled: payload.filtersEnabled, items };

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO public.configuracao (chave, valor, atualizado_em)
         VALUES ('categorias', $1::jsonb, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $1::jsonb, atualizado_em = NOW()`,
          [JSON.stringify(legacyValue)],
        );

        await client.query(
          `DELETE FROM public.categorias_servicos
         WHERE NOT (id = ANY($1::text[]))`,
          [items.map((item) => item.id)],
        );

        for (const item of items) {
          await client.query(
            `INSERT INTO public.categorias_servicos (id, nome, ativo, ordem)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             nome = EXCLUDED.nome,
             ativo = EXCLUDED.ativo,
             ordem = EXCLUDED.ordem`,
            [item.id, item.label, item.active, item.ordem],
          );
        }

        await client.query("COMMIT");
        return legacyValue;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        if (isMissingTableError(err)) {
          try {
            await pool.query(
              `INSERT INTO public.configuracao (chave, valor, atualizado_em)
             VALUES ('categorias', $1::jsonb, NOW())
             ON CONFLICT (chave) DO UPDATE SET valor = $1::jsonb, atualizado_em = NOW()`,
              [JSON.stringify(legacyValue)],
            );
            return legacyValue;
          } catch (fallbackErr) {
            fastify.log.error(fallbackErr);
          }
        }
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao salvar categorias de servicos." });
      } finally {
        client.release();
      }
    },
  );

  // GET /servicos - catalogo estruturado com fallback para configuracao
  fastify.get("/servicos", async (_request, reply) => {
    try {
      return await getServicesFromTables();
    } catch (err) {
      if (isMissingTableError(err)) {
        return normalizeServiceCatalog(await getConfigValue("servicos"));
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar servicos." });
    }
  });

  // PUT /servicos - substitui catalogo de servicos
  fastify.put(
    "/servicos",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const normalized = normalizeServicesForSave(request.body);
      if (!normalized) {
        return reply.status(400).send({ error: "Lista de servicos invalida." });
      }

      const invalidService = normalized.find(
        (item) => !item.slug || !item.name || !item.desc || !item.category,
      );
      if (invalidService) {
        return reply.status(400).send({
          error:
            "Todos os servicos precisam de slug, nome, descricao e categoria.",
        });
      }

      const { rows: categoryRows } = await pool.query(
        `SELECT id FROM public.categorias_servicos`,
      );
      const validCategories = new Set(categoryRows.map((row) => row.id));
      const invalidCategory = normalized.find(
        (item) => !validCategories.has(item.category),
      );
      if (invalidCategory) {
        return reply.status(400).send({
          error: `Categoria invalida para o servico "${invalidCategory.name}".`,
        });
      }

      const incoming = normalized.map((item, index) => ({
        ...item,
        ordem: index + 1,
      }));

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const saved = [];

        for (const item of incoming) {
          if (item.id > 0) {
            const { rows } = await client.query(
              `INSERT INTO public.servicos
               (id, slug, nome, descricao, preco, categoria_id, ativo, ordem)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
             ON CONFLICT (id) DO UPDATE SET
               slug = EXCLUDED.slug,
               nome = EXCLUDED.nome,
               descricao = EXCLUDED.descricao,
               preco = EXCLUDED.preco,
               categoria_id = EXCLUDED.categoria_id,
               ativo = TRUE,
               ordem = EXCLUDED.ordem
             RETURNING id, slug, nome, descricao, preco, categoria_id`,
              [
                item.id,
                item.slug,
                item.name,
                item.desc,
                item.price,
                item.category,
                item.ordem,
              ],
            );
            saved.push(mapServiceRow(rows[0]));
          } else {
            const { rows } = await client.query(
              `INSERT INTO public.servicos
               (slug, nome, descricao, preco, categoria_id, ativo, ordem)
             VALUES ($1, $2, $3, $4, $5, TRUE, $6)
             ON CONFLICT (slug) DO UPDATE SET
               nome = EXCLUDED.nome,
               descricao = EXCLUDED.descricao,
               preco = EXCLUDED.preco,
               categoria_id = EXCLUDED.categoria_id,
               ativo = TRUE,
               ordem = EXCLUDED.ordem
             RETURNING id, slug, nome, descricao, preco, categoria_id`,
              [
                item.slug,
                item.name,
                item.desc,
                item.price,
                item.category,
                item.ordem,
              ],
            );
            saved.push(mapServiceRow(rows[0]));
          }
        }

        await client.query(
          `UPDATE public.servicos
         SET ativo = FALSE
         WHERE NOT (id = ANY($1::bigint[]))`,
          [saved.map((item) => item.id)],
        );
        await client.query(
          `SELECT setval(
           pg_get_serial_sequence('public.servicos', 'id'),
           COALESCE((SELECT MAX(id) FROM public.servicos), 1),
           TRUE
         )`,
        );
        await client.query(
          `INSERT INTO public.configuracao (chave, valor, atualizado_em)
         VALUES ('servicos', $1::jsonb, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $1::jsonb, atualizado_em = NOW()`,
          [JSON.stringify(saved)],
        );

        await client.query("COMMIT");
        return saved;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        if (isMissingTableError(err)) {
          try {
            await pool.query(
              `INSERT INTO public.configuracao (chave, valor, atualizado_em)
             VALUES ('servicos', $1::jsonb, NOW())
             ON CONFLICT (chave) DO UPDATE SET valor = $1::jsonb, atualizado_em = NOW()`,
              [JSON.stringify(incoming.map(({ ordem, ...item }) => item))],
            );
            return incoming.map(({ ordem, ...item }) => item);
          } catch (fallbackErr) {
            fastify.log.error(fallbackErr);
          }
        }
        fastify.log.error(err);
        return reply.status(500).send({ error: "Erro ao salvar servicos." });
      } finally {
        client.release();
      }
    },
  );

  const VALID_CHAVES = ["home", "categorias", "servicos"];

  // GET /configuracao/:chave
  fastify.get("/configuracao/:chave", async (request, reply) => {
    const { chave } = request.params;
    if (!VALID_CHAVES.includes(chave))
      return reply.status(400).send({ error: "Chave inválida." });

    try {
      const { rows } = await pool.query(
        "SELECT chave, valor, atualizado_em FROM configuracao WHERE chave = $1",
        [chave],
      );
      if (!rows.length)
        return reply
          .status(404)
          .send({ error: "Configuração não encontrada." });
      return {
        chave: rows[0].chave,
        valor: rows[0].valor,
        atualizado_em: rows[0].atualizado_em,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erro ao buscar configuração." });
    }
  });

  // PUT /configuracao/:chave
  fastify.put(
    "/configuracao/:chave",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { chave } = request.params;
      if (!VALID_CHAVES.includes(chave))
        return reply.status(400).send({ error: "Chave inválida." });

      const valor = request.body;
      try {
        const { rows } = await pool.query(
          `INSERT INTO configuracao (chave, valor, atualizado_em)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $2::jsonb, atualizado_em = NOW()
         RETURNING chave, valor, atualizado_em`,
          [chave, JSON.stringify(valor)],
        );
        return rows[0];
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ error: "Erro ao salvar configuração." });
      }
    },
  );

  return fastify;
}

const fastify = buildServer();

function start() {
  fastify
    .listen({ port: PORT, host: "0.0.0.0" })
    .then(() => fastify.log.info(`Servidor rodando na porta ${PORT}`))
    .catch((err) => {
      fastify.log.error(err);
      process.exit(1);
    });
}

start();
