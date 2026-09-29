import { normalizeDateToISO } from "./regraDatas";

// normaliza dias bloqueados
export function normalizeDisableDays(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];

  for (const item of arr) {
    if (typeof item !== "string") continue;
    const iso = normalizeDateToISO(item);
    if (!iso) continue;
    out.push(iso);
  }

  return Array.from(new Set(out));
}

// extrai horarios disponíveis do retorno do n8n
export function extractAvailableSlots(resp: any): string[] {
  if (!resp) return [];

  // N8N frequentemente retorna array no nível raiz — desembrulha
  const obj = Array.isArray(resp) ? resp[0] : resp;
  if (!obj) return [];

  const direct =
    obj.horarios_disponiveis ??
    obj.horariosDisponiveis ??
    obj.availableSlots ??
    obj.slots ??
    obj.horarios ??
    obj.data?.horarios_disponiveis;

  if (!Array.isArray(direct)) return [];

  return direct
    .filter((x: any) => typeof x === "string")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((s: string) => (s.length >= 5 ? s.slice(0, 5) : s));
}
