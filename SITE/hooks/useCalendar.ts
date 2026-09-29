import { useState, useEffect } from "react";
import {
  getAvailableSlots,
  getAvailableDays,
  getAgendaConfig,
  getBlockedDays,
  CalendarEvent,
  AgendaConfig,
  AvailableDay,
} from "../api";
import { toLocalISO } from "../Regras/regraDatas";
import {
  isDayFullyBooked,
  getAvailableSlotsForDate,
} from "../Regras/regraHorarios";
import { extractAvailableSlots } from "../Regras/regraDisponibilidade";

const DEFAULT_BOOKING_WINDOW_DAYS = 10;
const MIN_BOOKING_WINDOW_DAYS = 7;
const MAX_BOOKING_WINDOW_DAYS = 15;

function normalizeBookingWindowDays(value: number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BOOKING_WINDOW_DAYS;
  return Math.min(
    Math.max(Math.round(parsed), MIN_BOOKING_WINDOW_DAYS),
    MAX_BOOKING_WINDOW_DAYS,
  );
}

interface UseCalendarOptions {
  professionalId: string | null;
  setStep: (n: number) => void;
}

export function useCalendar({ professionalId, setStep }: UseCalendarOptions) {
  const [proEvents, setProEvents] = useState<CalendarEvent[]>([]);
  const [agendaConfig, setAgendaConfig] = useState<AgendaConfig | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedTimeSelectedAt, setSelectedTimeSelectedAt] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [availableDaysLoading, setAvailableDaysLoading] = useState(false);
  const [availableDaysMessage, setAvailableDaysMessage] = useState<string | null>(null);
  const [availableDaysError, setAvailableDaysError] = useState(false);
  const [disableDays, setDisableDays] = useState<string[]>([]);
  const [bookingWindowDays, setBookingWindowDays] = useState(DEFAULT_BOOKING_WINDOW_DAYS);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const todayIso = toLocalISO(new Date());
  const minMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 2,
    1,
  );

  const monthTitle = new Date(viewYear, viewMonth).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    if (!professionalId) {
      setProEvents([]);
      setAgendaConfig(null);
      setSelectedDate("");
      setSelectedTime("");
      setSelectedTimeSelectedAt(null);
      setAvailableSlots([]);
      setAvailabilityMessage(null);
      setAvailableDays([]);
      setAvailableDaysLoading(false);
      setAvailableDaysMessage(null);
      setAvailableDaysError(false);
      setDisableDays([]);
      setBookingWindowDays(DEFAULT_BOOKING_WINDOW_DAYS);
      return;
    }

    (async () => {
      setAvailableDaysLoading(true);
      setAvailableDaysMessage(null);
      setAvailableDaysError(false);
      setProEvents([]);

      const [configResult, blockedResult] =
        await Promise.allSettled([
          getAgendaConfig(professionalId),
          getBlockedDays(professionalId),
        ]);

      const loadedConfig = configResult.status === "fulfilled" ? configResult.value : null;
      const loadedBookingWindowDays = normalizeBookingWindowDays(
        loadedConfig?.janela_agendamento_dias,
      );

      setAgendaConfig(loadedConfig);
      setBookingWindowDays(loadedBookingWindowDays);
      setDisableDays(
        blockedResult.status === "fulfilled"
          ? blockedResult.value.filter((b) => b.periodos === null).map((b) => b.data)
          : [],
      );

      const availabilityResult = await Promise.allSettled([
        getAvailableDays(professionalId, loadedBookingWindowDays),
      ]).then(([result]) => result);

      if (availabilityResult.status === "fulfilled") {
        setAvailableDays(availabilityResult.value.openDays);
        setAvailableDaysError(false);
        if (!availabilityResult.value.openDays.length) {
          setAvailableDaysMessage("Nenhuma data disponível nos próximos dias.");
        }
      } else {
        setAvailableDays([]);
        setAvailableDaysMessage("Não foi possível carregar as próximas datas.");
        setAvailableDaysError(true);
      }

      setAvailableDaysLoading(false);
    })();
  }, [professionalId]);

  // Atualiza dias disponíveis em background a cada 3 minutos (step 4)
  useEffect(() => {
    if (!professionalId) return;

    const interval = setInterval(async () => {
      try {
        const config = await getAgendaConfig(professionalId).catch(() => null);
        const refreshedBookingWindowDays = normalizeBookingWindowDays(
          config?.janela_agendamento_dias,
        );
        setBookingWindowDays(refreshedBookingWindowDays);
        if (config) setAgendaConfig(config);
        const availability = await getAvailableDays(professionalId, refreshedBookingWindowDays);
        setAvailableDays(availability.openDays);
        if (!availability.openDays.length) {
          setAvailableDaysMessage("Nenhuma data disponível nos próximos dias.");
        } else {
          setAvailableDaysMessage(null);
        }
      } catch {
        // falha silenciosa — dados existentes permanecem exibidos
      }
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [professionalId]);

  // Atualiza slots disponíveis em background a cada 3 minutos enquanto o usuário tem uma data selecionada
  useEffect(() => {
    if (!selectedDate || !professionalId) return;

    const interval = setInterval(async () => {
      try {
        const resp = await getAvailableSlots(professionalId, selectedDate);
        setAvailableSlots(extractAvailableSlots(resp));
      } catch {
        // falha silenciosa — slots existentes permanecem exibidos
      }
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedDate, professionalId]);

  function getDays() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + bookingWindowDays - 1);
    const maxDateIso = toLocalISO(maxDate);

    const arr: { date: string; isCurrentMonth: boolean; disabled: boolean }[] =
      [];

    for (let i = 0; i < startWeekday; i++) {
      arr.push({ date: "", isCurrentMonth: false, disabled: true });
    }

    const workDays = agendaConfig?.dias_semana ?? [1, 2, 3, 4, 5, 6];

    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(viewYear, viewMonth, d);
      const iso = toLocalISO(current);

      let disabled = false;
      if (!workDays.includes(current.getDay())) disabled = true;
      if (iso < todayIso) disabled = true;
      if (iso > maxDateIso) disabled = true;
      if (disableDays.includes(iso)) disabled = true;

      if (professionalId && !disabled) {
        if (isDayFullyBooked(iso, proEvents, agendaConfig)) disabled = true;
      }

      arr.push({ date: iso, isCurrentMonth: true, disabled });
    }

    return arr;
  }

  const days = getDays();

  function onPrevMonth() {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    if (prev >= minMonth) {
      setViewYear(prev.getFullYear());
      setViewMonth(prev.getMonth());
    }
  }

  function onNextMonth() {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  async function loadSlotsForDate(date: string) {
    const MIN_LOADING_MS = 2300;
    const startedAt = Date.now();

    const waitRemaining = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      return remaining > 0
        ? new Promise<void>((r) => setTimeout(r, remaining))
        : Promise.resolve();
    };

    if (!professionalId) {
      await waitRemaining();
      setSlotsLoading(false);
      return;
    }

    try {
      const resp = await getAvailableSlots(professionalId, date);
      setAvailableSlots(extractAvailableSlots(resp));
    } catch {
      setAvailableSlots(getAvailableSlotsForDate(date, proEvents, agendaConfig));
    } finally {
      await waitRemaining();
      setSlotsLoading(false);
    }
  }

  async function onSelectDay(date: string) {
    if (!date) return;

    setSelectedDate(date);
    setSelectedTime("");
    setSelectedTimeSelectedAt(null);
    setAvailableSlots([]);
    setAvailabilityMessage(null);
    setSlotsLoading(true);
    setStep(5);
    await loadSlotsForDate(date);
  }

  function onSelectTime(t: string) {
    setSelectedTime(t);
    setSelectedTimeSelectedAt(Date.now());
    setAvailabilityMessage(null);
    setStep(6);
  }

  function clearSelectedTime(message?: string) {
    setSelectedTime("");
    setSelectedTimeSelectedAt(null);
    if (message) setAvailabilityMessage(message);
  }

  async function refreshSelectedDateSlots(message?: string) {
    if (!selectedDate) return;
    clearSelectedTime(message);
    setAvailableSlots([]);
    setSlotsLoading(true);
    await loadSlotsForDate(selectedDate);
  }


  return {
    selectedDate,
    selectedTime,
    selectedTimeSelectedAt,
    disableDays,
    setDisableDays,
    availableSlots,
    availabilityMessage,
    slotsLoading,
    availableDays,
    availableDaysLoading,
    availableDaysMessage,
    availableDaysError,
    monthTitle,
    weekdays,
    days,
    onPrevMonth,
    onNextMonth,
    onSelectDay,
    onSelectTime,
    clearSelectedTime,
    refreshSelectedDateSlots,
  };
}
