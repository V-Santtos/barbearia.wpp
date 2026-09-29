import { normalizeDateToISO, toLocalISO } from "./regraDatas";
import type { CalendarEvent, AgendaConfig } from "../api";

// Fallback de slots quando agenda_profissional não está disponível
export const WORK_SLOTS = [
    "08:00",
    "09:00",
    "10:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
];

function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
    const total = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60).toString().padStart(2, "0");
    const m = (total % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

function generateSlots(config: AgendaConfig): string[] {
    const {
        hora_inicio,
        hora_fim,
        duracao_min,
        intervalo_inicio,
        intervalo_duracao_min,
    } = config;
    const [startH, startM] = hora_inicio.split(":").map(Number);
    const [endH, endM] = hora_fim.split(":").map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const breakStart = intervalo_inicio ? timeToMinutes(intervalo_inicio) : null;
    const breakEnd =
        breakStart !== null && intervalo_duracao_min
            ? breakStart + intervalo_duracao_min
            : null;
    const slots: string[] = [];
    let current = startTotal;
    while (current + duracao_min <= endTotal) {
        const overlapsBreak =
            breakStart !== null &&
            breakEnd !== null &&
            current < breakEnd &&
            current + duracao_min > breakStart;

        if (!overlapsBreak) slots.push(minutesToTime(current));
        current += duracao_min;
    }
    return slots;
}

export const VALID_STATUSES = new Set(["agendado", "reagendado", "confirmado"]);
const MIN_BOOKING_NOTICE_MIN = 15;

function isAfterMinimumNotice(isoDate: string, slot: string): boolean {
    const [year, month, day] = isoDate.split("-").map(Number);
    const [hour, minute] = slot.split(":").map(Number);
    const slotDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    const minAllowed = new Date(Date.now() + MIN_BOOKING_NOTICE_MIN * 60 * 1000);
    return slotDate >= minAllowed;
}

// Verifica se um dia está totalmente lotado
export function isDayFullyBooked(
    isoDate: string,
    events: CalendarEvent[],
    agendaConfig?: AgendaConfig | null
): boolean {
if (!isoDate) return false;

const busyForDay = new Set<string>();

for (const e of events) {
    const normalized = normalizeDateToISO(e.dia_marcado);
    if (!normalized || normalized !== isoDate) continue;

    if (!e.hora_marcada) continue;

    const status = (e.status || "").toLowerCase();
    if (!VALID_STATUSES.has(status)) continue;

    const hhmm = e.hora_marcada.slice(0, 5);
    busyForDay.add(hhmm);
}

const baseSlots = agendaConfig
    ? generateSlots(agendaConfig)
    : WORK_SLOTS;

const todayIso = toLocalISO(new Date());
const relevantSlots = isoDate === todayIso
    ? baseSlots.filter((slot) => isAfterMinimumNotice(isoDate, slot))
    : baseSlots;

if (relevantSlots.length === 0) return true;

let bookedCount = 0;
for (const slot of relevantSlots) {
    if (busyForDay.has(slot)) bookedCount++;
}

return bookedCount >= relevantSlots.length;
}

// Fallback local (usado quando a chamada à API falha)
export function getAvailableSlotsForDate(
isoDate: string,
events: CalendarEvent[],
agendaConfig?: AgendaConfig | null
): string[] {
const baseSlots = agendaConfig
    ? generateSlots(agendaConfig)
    : WORK_SLOTS;

if (!isoDate) return baseSlots;

const busy = new Set<string>();

for (const e of events) {
    const normalized = normalizeDateToISO(e.dia_marcado);
    if (!normalized || normalized !== isoDate) continue;

    if (!e.hora_marcada) continue;

    const status = (e.status || "").toLowerCase();
    if (!VALID_STATUSES.has(status)) continue;

    const hhmm = e.hora_marcada.slice(0, 5);
    busy.add(hhmm);
}

let freeSlots = baseSlots.filter((slot) => !busy.has(slot));

const todayIso = toLocalISO(new Date());
if (isoDate === todayIso) {
    freeSlots = freeSlots.filter((slot) => isAfterMinimumNotice(isoDate, slot));
}

return freeSlots;
}
