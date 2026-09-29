import type { Professional, Event, CreateEventRequest } from "../types";
import type { AjusteDeValor, ClientePresencial, ServicoDoAtendimento } from "../lib/fechamento";

// Sem `VITE_CALENDAR_API_URL` (o caso do deploy), a API e a funcao servida pelo
// mesmo dominio, em `/api` — mesma origem, sem CORS no meio. No local a variavel
// esta no `.env` apontando pro IP da maquina, e continua mandando.
const API_BASE = (import.meta.env.VITE_CALENDAR_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
import { credencial } from "../lib/sessao";

// ponytail: painel populado com mundo de teste (`VITE_MOCK=1`), para validar
// layout sem banco de pé.
// Teto: cobre só as rotas escritas em `mock/rotas.ts`. Rota fora dessa lista cai
// para a rede normalmente — mock que responde qualquer coisa esconderia
// endpoint novo em vez de mostrar que ele não foi coberto.
// Gatilho de remoção: quando o banco voltar e o painel tiver dado real de
// vitrine próprio. Manter os dois é manter duas fontes de verdade, que é o
// defeito que o `DashboardScreen` foi escrito para evitar.
const MOCK = (import.meta.env.VITE_MOCK ?? "").trim() === "1";

// `import()` e não import estático de propósito: `VITE_MOCK` vira literal no
// build, então com a flag desligada o bundler descarta este ramo inteiro e o
// mundo de teste não viaja no bundle de produção.
let mockCarregado: {
  responder: (caminho: string, init: RequestInit) => unknown;
  SEM_MOCK: symbol;
} | null = null;

async function carregarMock() {
  if (!mockCarregado) {
    const m = await import("./mock/rotas");
    mockCarregado = { responder: m.responderMock, SEM_MOCK: m.SEM_MOCK };
  }
  return mockCarregado;
}

// ─── Tipos novos ──────────────────────────────────────────────────────────────

export interface AgendaConfig {
  profissional_id: number;
  dias_semana: number[]; // 0=Dom … 6=Sáb
  hora_inicio: string; // "HH:MM"
  hora_fim: string; // "HH:MM"
  duracao_min: number;
  intervalo_inicio: string | null;
  intervalo_duracao_min: number | null;
  janela_agendamento_dias: number;
  atualizado_em: string | null;
}

export interface DiaBloqueado {
  id: number;
  data: string; // "YYYY-MM-DD"
  motivo: string | null;
  periodos: BlockPeriod[] | null;
  created_at: string;
}

export type BlockPeriod = "morning" | "afternoon" | "night";

export interface UpdateEventPayload {
  telefone?: string;
  cliente?: string;
  profissional?: string;
  servico?: string;
  dia_marcado?: string;
  hora_marcada?: string;
  status?: string;
}

export interface WhatsAppContact {
  id: number;
  phone: string;
  wa_id: string | null;
  name: string | null;
  service_window_until: string | null;
}

export interface WhatsAppConversation {
  id: number;
  status: "open" | "bot" | "human" | "closed";
  assigned_to: string | null;
  last_message_at: string | null;
  unread_count: number;
  contact: WhatsAppContact;
  last_message: {
    direction: "inbound" | "outbound";
    sender_type: "customer" | "bot" | "human" | "system";
    message_type: string;
    body: string | null;
    created_at: string;
  } | null;
}

export interface WhatsAppMessage {
  id: number;
  conversation_id: number;
  contact_id: number;
  direction: "inbound" | "outbound";
  sender_type: "customer" | "bot" | "human" | "system";
  whatsapp_message_id: string | null;
  message_type: string;
  body: string | null;
  media_id: string | null;
  status: string | null;
  created_at: string;
  received_at: string;
}

export interface ConfiguredService {
  id?: number;
  slug?: string;
  category?: string;
  name: string;
  desc?: string;
  price?: string;
}

export interface SiteCategory {
  id: string;
  label: string;
  active: boolean;
}

export interface BookingSiteSettings {
  home: { heroLine1: string; heroName: string; ctaLabel: string };
  categories: { filtersEnabled: boolean; items: SiteCategory[] };
  services: ConfiguredService[];
}

/** Contrato do site público. O backend do dev ainda precisa expor as escritas. */
export async function getBookingSiteSettings(): Promise<BookingSiteSettings> {
  const [home, categories, services] = await Promise.all([
    api<BookingSiteSettings["home"]>("configuracao/home"),
    api<BookingSiteSettings["categories"]>("categorias-servicos"),
    getConfiguredServices(),
  ]);
  return { home, categories, services };
}

export async function saveBookingSiteSettings(
  settings: BookingSiteSettings,
): Promise<BookingSiteSettings> {
  // Cada recurso tem endpoint próprio. Salvar em sequência permite apontar
  // exatamente qual etapa falhou. A ORDEM importa: categorias antes de serviços,
  // porque um serviço novo pode apontar para uma categoria criada no mesmo salvamento.
  //
  // DEVOLVE O QUE O SERVIDOR GRAVOU, e a tela troca o rascunho por isso (29/09/2026).
  // Serviço novo entra com id negativo temporário e sai com o id real; se a tela
  // guardasse o próprio rascunho, o próximo "Salvar" criaria o serviço de novo. No mock
  // não aparecia, porque ele grava o id negativo do jeito que chega.
  const home = await api<BookingSiteSettings["home"]>("configuracao/home", {
    method: "PUT",
    body: JSON.stringify(settings.home),
  });
  const categories = await api<BookingSiteSettings["categories"]>("categorias-servicos", {
    method: "PUT",
    body: JSON.stringify(settings.categories),
  });
  const services = await api<ConfiguredService[]>("servicos", {
    method: "PUT",
    body: JSON.stringify(settings.services),
  });
  return { home, categories, services };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  retryAfterMs: number;
  constructor(status: number, message: string, retryAfterMs = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A costura do mundo de teste. Fica aqui, no transporte, para que TODA função
  // acima continue rodando inteira — `toEvent`, `toProf`, filtros e `catch` —
  // sobre um corpo com o mesmo formato do Fastify. Nenhuma tela ganha um
  // `if (mock)`, e por isso o que aparece torto no teste apareceria torto com a
  // API de pé.
  if (MOCK) {
    const { responder, SEM_MOCK } = await carregarMock();
    const resposta = responder(path, init);
    if (resposta !== SEM_MOCK) return resposta as T;
  }

  const hasBody = init.body !== undefined && init.body !== null;
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      // A credencial vai em TODA chamada, e não mais numa lista de caminhos que
      // precisavam dela (`shouldAttachAdminToken`). Aquela lista era uma segunda cópia
      // do que o servidor já decide no `preHandler`, e duas listas do mesmo assunto
      // divergem: a rota nova que esquecesse de entrar ali tomaria 401 sem motivo
      // aparente. Nas rotas públicas o cabeçalho é simplesmente ignorado.
      ...(await credencial()),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retryAfterRaw = Number(res.headers.get("Retry-After") ?? 0);
    const retryAfterMs =
      Number.isFinite(retryAfterRaw) && retryAfterRaw > 0
        ? retryAfterRaw * 1000
        : 0;
    throw new ApiError(
      res.status,
      (body as any)?.error ?? `HTTP ${res.status}`,
      retryAfterMs,
    );
  }
  return body as T;
}

// ─── Transformações de formato ────────────────────────────────────────────────

function toProf(raw: any): Professional {
  return {
    id: Number(raw.id),
    name: raw.nome ?? raw.name ?? "",
    color: raw.cor ?? raw.color ?? "#888888",
    nome: raw.nome,
    cor: raw.cor,
    ativo: raw.ativo,
    created_at: raw.created_at,
  };
}

function toEvent(raw: any): Event {
  return {
    id: Number(raw.id),
    title: raw.cliente ?? raw.title ?? "",
    date: raw.dia_marcado ?? raw.date ?? "",
    startTime: raw.startTime ?? raw.hora_marcada ?? "",
    endTime: raw.endTime ?? "",
    // O EventModal lê serviço e telefone daqui. Sem serviço gravado, antes o
    // texto inteiro sumia -- e o telefone junto, no "Editar Evento".
    description:
      raw.servico || raw.telefone
        ? [
            raw.servico ? `Servico: ${raw.servico}` : "",
            raw.telefone ? `Telefone: ${raw.telefone}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : undefined,
    professionalId: Number(raw.professional_id ?? raw.professionalId ?? 0),
    // campos do banco preservados
    telefone: raw.telefone,
    cliente: raw.cliente,
    profissional: raw.profissional,
    servico: raw.servico,
    dia_marcado: raw.dia_marcado,
    hora_marcada: raw.hora_marcada,
    status: raw.status,
    source: raw.source,
    fechamento: raw.fechamento ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

// ─── PROFISSIONAIS ────────────────────────────────────────────────────────────

export async function getProfessionals(): Promise<Professional[]> {
  const data = await api<any[]>("profissionais");
  return (Array.isArray(data) ? data : []).map(toProf);
}

export async function createProfessional(
  name: string,
  color: string,
): Promise<Professional> {
  const data = await api<any>(
    "profissionais",
    {
      method: "POST",
      body: JSON.stringify({ nome: name, cor: color }),
    },
  );
  return toProf(data);
}

export async function updateProfessional(
  id: number,
  payload: { name?: string; color?: string },
): Promise<Professional> {
  const body: any = {};
  if (payload.name !== undefined) body.nome = payload.name;
  if (payload.color !== undefined) body.cor = payload.color;
  const data = await api<any>(
    `profissionais/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  return toProf(data);
}

export async function deleteProfessional(id: number): Promise<void> {
  await api(`profissionais/${id}`, { method: "DELETE" });
}

// ─── AGENDA CONFIG POR PROFISSIONAL ──────────────────────────────────────────

export async function getAgendaConfig(
  professionalId: number,
): Promise<AgendaConfig> {
  return api<AgendaConfig>(`profissionais/${professionalId}/agenda-config`);
}

export async function updateAgendaConfig(
  professionalId: number,
  config: Omit<AgendaConfig, "profissional_id" | "atualizado_em">,
): Promise<AgendaConfig> {
  return api<AgendaConfig>(
    `profissionais/${professionalId}/agenda-config`,
    {
      method: "PUT",
      body: JSON.stringify(config),
    },
  );
}

// ─── DIAS BLOQUEADOS ──────────────────────────────────────────────────────────

export async function getBlockedDays(
  professionalId: number,
  date?: string,
): Promise<DiaBloqueado[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return api<DiaBloqueado[]>(
    `profissionais/${professionalId}/dias-bloqueados${qs}`,
  );
}

export async function addBlockedDay(
  professionalId: number,
  data: string,
  motivo?: string,
  periodos?: BlockPeriod[],
): Promise<DiaBloqueado> {
  return api<DiaBloqueado>(
    `profissionais/${professionalId}/dias-bloqueados`,
    {
      method: "POST",
      body: JSON.stringify({ data, motivo, periodos }),
    },
  );
}

export async function saveBlockedPeriods(
  professionalId: number,
  data: string,
  periodos: BlockPeriod[],
): Promise<DiaBloqueado | { message: string; data: string; periodos: [] }> {
  return api<DiaBloqueado | { message: string; data: string; periodos: [] }>(
    `profissionais/${professionalId}/dias-bloqueados`,
    {
      method: "POST",
      body: JSON.stringify({ data, periodos, motivo: "Bloqueio por período" }),
    },
  );
}

export async function removeBlockedDay(
  professionalId: number,
  data: string,
): Promise<void> {
  await api(`profissionais/${professionalId}/dias-bloqueados/${data}`, {
    method: "DELETE",
  });
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

/**
 * O nome de quem já é cliente, a partir do telefone (DDD + número ou já com
 * DDI -- o servidor normaliza). `null` quando o número é novo.
 */
export async function buscarClientePorTelefone(telefone: string): Promise<string | null> {
  const data = await api<{ encontrado: boolean; nome?: string }>(
    `clientes/buscar?telefone=${encodeURIComponent(telefone)}`,
  );
  return data?.encontrado && data.nome ? data.nome : null;
}

// ─── EVENTOS (AGENDAMENTOS) ───────────────────────────────────────────────────

export async function getConfiguredServices(): Promise<ConfiguredService[]> {
  const data = await api<unknown>("servicos");
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any) => ({
      id: item?.id,
      slug: item?.slug,
      category: item?.category,
      name: String(item?.name ?? "").trim(),
      desc: item?.desc,
      price: item?.price,
    }))
    .filter((item) => item.name);
}

export async function getEvents(from?: string, to?: string): Promise<Event[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString() ? `?${params}` : "";
  const data = await api<any[]>(`agendamentos${qs}`);
  return (Array.isArray(data) ? data : []).map(toEvent);
}

export async function createEvent(payload: CreateEventRequest): Promise<Event> {
  const data = await api<{ event: any }>("agendamentos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toEvent(data.event);
}

export async function updateEvent(
  id: number,
  payload: UpdateEventPayload,
): Promise<Event> {
  const data = await api<{ event: any }>(`agendamentos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return toEvent(data.event);
}

export async function updateEventStatus(
  id: number,
  status: string,
): Promise<void> {
  await api(`agendamentos/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export interface ConcluirAtendimentoPayload {
  servicos: ServicoDoAtendimento[];
  ajuste: AjusteDeValor | null;
  /** Só no presencial. Sem nome, o atendimento fica como "Cliente presencial". */
  cliente?: ClientePresencial | null;
}

/**
 * Conclui gravando o fechamento (spec 2026-09-27-fechar-atendimento-design).
 * Substitui `updateEventStatus(id, "concluido")` no "Marcar como feito". O
 * servidor recalcula o total a partir dos itens e rejeita desconto maior que o
 * subtotal.
 */
export async function concluirAtendimento(
  id: number,
  payload: ConcluirAtendimentoPayload,
): Promise<Event> {
  const data = await api<{ event: any }>(`agendamentos/${id}/concluir`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toEvent(data.event);
}

export async function deleteEvent(id: number): Promise<void> {
  await api(`agendamentos/${id}`, { method: "DELETE" });
}

// ─── SLOTS DISPONÍVEIS ────────────────────────────────────────────────────────

export async function getAvailableSlots(
  professionalId: number,
  date: string,
): Promise<string[]> {
  const res = await api<{ availableSlots: string[] }>(
    `agendamentos/horarios-disponiveis?professionalId=${professionalId}&date=${date}`,
  );
  return res.availableSlots ?? [];
}

/**
 * O primeiro dia, a partir de hoje, em que o profissional tem ao menos um
 * horário livre -- ou `null` se não houver nos próximos `dias`.
 */
export async function getPrimeiroDiaLivre(
  professionalId: number,
  dias = 14,
): Promise<string | null> {
  const res = await api<{ openDays?: { date: string }[] }>(
    `agendamentos/dias-disponiveis?professionalId=${professionalId}&days=${dias}`,
  );
  return res.openDays?.[0]?.date ?? null;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export type EstadoDoDia =
  | { tipo: "fora" }
  | { tipo: "fechado" }
  | { tipo: "bloqueio" }
  | { tipo: "lotado"; vagas: 0 }
  | { tipo: "vagas"; vagas: number };

export type PeriodoDashboard = "hoje" | "7d" | "15d" | "30d";

export interface AgregadoDashboard {
  agendamentos: {
    total: number;
    concluidos: number;
    cancelados: number;
    ativos: number;
  };
  ocupacao: {
    pct: number;
    capacidade: number;
    ocupados: number;
    profissionais: number;
  };
  /** Olha para FRENTE: horário livre que já passou não existe. */
  livres: { total: number; capacidade: number };
  marcacoes: { total: number };
}

export interface ProfissionalDashboard {
  id: number;
  nome: string;
  cor: string;
  expediente: {
    inicio: string;
    fim: string;
    duracao_min: number;
    intervalo_inicio: string | null;
    intervalo_duracao_min: number | null;
  };
  janela_dias: number;
  /** Todos os horários que existem hoje. `livres_hoje` é subconjunto dele. */
  grade_hoje: string[];
  capacidade_hoje: number;
  livres_hoje: string[];
}

export interface LinhaAgendaDashboard {
  id: number;
  professional_id: number;
  hora: string;
  duracao_min: number;
  cliente: string | null;
  telefone: string | null;
  status: string | null;
  source: string | null;
}

export interface DashboardResumo {
  gerado_em: string;
  hoje: string;
  profissionais: ProfissionalDashboard[];
  agenda: LinhaAgendaDashboard[];
  disponibilidade: {
    dias: { data: string; wd: number; hoje: boolean }[];
    vagas: Record<string, EstadoDoDia[]>;
  };
  periodos: Record<
    PeriodoDashboard,
    Record<string, AgregadoDashboard> & { all: AgregadoDashboard }
  >;
}

/**
 * Uma chamada só, de propósito. Todo número da tela sai daqui — inclusive os que
 * dariam para derivar de `getEvents()`, que já está em memória.
 *
 * Misturar as duas fontes é o que produziu, no protótipo, três respostas
 * diferentes para "quantos horários livres hoje" na mesma tela.
 *
 * A data vai no parâmetro porque o fuso que importa é o de quem olha a tela, não
 * o do processo que responde.
 */
export async function getDashboardResumo(
  date = new Date().toLocaleDateString("en-CA"),
): Promise<DashboardResumo> {
  return api<DashboardResumo>(
    `dashboard/resumo?date=${encodeURIComponent(date)}`,
  );
}

// ─── WHATSAPP CRM ─────────────────────────────────────────────────────────────

export async function getWhatsAppConversations(
  limit = 50,
): Promise<WhatsAppConversation[]> {
  return api<WhatsAppConversation[]>(`whatsapp/conversations?limit=${limit}`);
}

export async function getWhatsAppMessages(
  conversationId: number,
): Promise<WhatsAppMessage[]> {
  return api<WhatsAppMessage[]>(
    `whatsapp/conversations/${conversationId}/messages`,
  );
}

export async function sendWhatsAppMessage(
  conversationId: number,
  body: string,
): Promise<WhatsAppMessage> {
  return api<WhatsAppMessage>(`whatsapp/conversations/${conversationId}/send`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function markWhatsAppConversationAsRead(
  conversationId: number,
): Promise<{ conversation_id: number; marked_read: number }> {
  return api(`whatsapp/conversations/${conversationId}/read`, {
    method: "POST",
  });
}
