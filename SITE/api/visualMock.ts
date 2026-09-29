import services from "../services-data.json";
import siteConfig from "../site-config.json";

export const VISUAL_MOCK_ENABLED = import.meta.env.VITE_VISUAL_MOCK === "1";

const professionals = [
  { id: 1, nome: "Lucas Costa", cor: "#9b5cff", ativo: true },
  { id: 2, nome: "Rafael Santos", cor: "#38bdf8", ativo: true },
  { id: 3, nome: "Eloi Alves", cor: "#34d399", ativo: true },
];

const slots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "17:00", "18:00"];

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function availableDays(days: number) {
  const result = [];
  for (let offset = 0; result.length < Math.min(days, 10); offset += 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    if (date.getDay() === 0) continue;

    const index = result.length;
    const availableSlotsCount = Math.max(3, 8 - (index % 5));
    result.push({
      date: localIso(date),
      availableSlotsCount,
      totalSlotsCount: 10,
      occupancyRatio: (10 - availableSlotsCount) / 10,
      firstSlot: slots[index % slots.length],
    });
  }
  return result;
}

function parseBody(options: RequestInit) {
  if (typeof options.body !== "string") return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

/** Respostas locais para inspeção visual. Esta função nunca usa fetch. */
export async function callVisualMock(path: string, options: RequestInit = {}): Promise<unknown> {
  const normalizedPath = path.replace(/^\/+/, "");
  const method = String(options.method ?? "GET").toUpperCase();

  if (normalizedPath.startsWith("agendamentos/verificar-telefone")) {
    return { exists: false };
  }

  if (normalizedPath === "profissionais") {
    return { professionals };
  }

  if (/^profissionais\/[^/]+\/agenda$/.test(normalizedPath)) {
    return { DisableDays: [] };
  }

  if (/^profissionais\/[^/]+\/agenda-config$/.test(normalizedPath)) {
    const professionalId = Number(normalizedPath.split("/")[1]);
    return {
      profissional_id: professionalId,
      dias_semana: [1, 2, 3, 4, 5, 6],
      hora_inicio: "09:00",
      hora_fim: "19:00",
      duracao_min: 60,
      intervalo_inicio: "12:00",
      intervalo_duracao_min: 60,
      janela_agendamento_dias: 10,
      atualizado_em: new Date().toISOString(),
      ...(method === "PUT" ? parseBody(options) : {}),
    };
  }

  if (/^profissionais\/[^/]+\/dias-bloqueados(?:\/.*)?$/.test(normalizedPath)) {
    if (method === "POST") {
      const body = parseBody(options) as { data?: string; motivo?: string };
      return { id: 1, data: body.data, motivo: body.motivo ?? null, periodos: null, created_at: new Date().toISOString() };
    }
    if (method === "DELETE") {
      return { message: "Dia liberado no modo visual.", data: decodeURIComponent(normalizedPath.split("/").at(-1) ?? "") };
    }
    return [];
  }

  if (normalizedPath.startsWith("agendamentos/horarios-disponiveis")) {
    return { availableSlots: slots };
  }

  if (normalizedPath.startsWith("agendamentos/dias-disponiveis")) {
    const params = new URLSearchParams(normalizedPath.split("?")[1] ?? "");
    const professionalId = Number(params.get("professionalId") ?? 1);
    const days = Number(params.get("days") ?? 10);
    return { professionalId, days, openDays: availableDays(days), disabledDays: [] };
  }

  if (normalizedPath.startsWith("agendamentos?")) {
    return { events: [] };
  }

  if (normalizedPath === "agendamentos" && method === "POST") {
    const payload = parseBody(options) as Record<string, unknown>;
    return {
      status: "success",
      message: "Agendamento visual concluído. Nenhum dado foi enviado.",
      event: { id: 1, ...payload },
    };
  }

  if (normalizedPath === "configuracao/home") {
    return {
      valor: {
        heroLine1: siteConfig.heroLine1,
        heroName: siteConfig.heroName,
        ctaLabel: siteConfig.ctaLabel,
      },
    };
  }

  if (normalizedPath === "categorias-servicos") {
    if (method === "PUT") return undefined;
    return { filtersEnabled: siteConfig.filtersEnabled, items: siteConfig.categories };
  }

  if (normalizedPath === "servicos") {
    if (method === "PUT") return parseBody(options);
    return services;
  }

  if (normalizedPath.startsWith("configuracao/") && method === "PUT") {
    return undefined;
  }

  throw new Error(`Rota não simulada no modo visual: ${method} ${normalizedPath}`);
}
