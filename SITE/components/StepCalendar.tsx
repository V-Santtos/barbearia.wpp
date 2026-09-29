import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ProgressiveBarLoader } from "./GlobalLoading";
import type { AvailableDay } from "../api";
import { useFillAdvance } from "../hooks/useFillAdvance";

interface StepCalendarProps {
  monthTitle: string;
  week: string[];
  days: { date: string; isCurrentMonth: boolean; disabled?: boolean }[];
  back: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (date: string) => void;
  availableDays?: AvailableDay[];
  availableDaysLoading?: boolean;
  availableDaysMessage?: string | null;
  availableDaysError?: boolean;
  disabledDates?: string[];
  workSlots?: string[];
}

function toLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateToISO(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  const trimmed = String(dateValue).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toLocalISO(parsed);
}

function dateFromISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getDayNumber(dateStr: string): number {
  return Number(dateStr.split("-")[2] ?? "1");
}

function getWeekday(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatFeaturedDate(dateStr: string) {
  const date = dateFromISO(dateStr);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(".", "");

  return {
    day: String(date.getDate()).padStart(2, "0"),
    weekday,
  };
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function StepCalendar({
  monthTitle,
  week,
  days,
  back,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  availableDays = [],
  availableDaysLoading = false,
  availableDaysMessage = null,
  availableDaysError = false,
  disabledDates = [],
  workSlots = [],
}: StepCalendarProps) {
  const todayIso = toLocalISO(new Date());
  const currentMonthDate = days.find((day) => day.isCurrentMonth && day.date)?.date;
  const currentMonthKey = currentMonthDate?.slice(0, 7) ?? "";
  const todayMonthKey = todayIso.slice(0, 7);
  const monthInPast = !!currentMonthKey && currentMonthKey < todayMonthKey;
  const showAvailability = availableDays.length > 0;

  // Com disponibilidade carregada, a grade mostra só a janela aberta pelo barbeiro:
  // semanas inteiras, do domingo antes do primeiro dia livre ao sábado depois do último.
  // Atravessa a virada de mês numa grade só; sem disponibilidade, cai na grade mensal.
  const windowDays = useMemo(() => {
    if (availableDays.length === 0) return null;
    const sorted = availableDays.map((day) => day.date).sort();
    const cursor = dateFromISO(sorted[0]);
    cursor.setDate(cursor.getDate() - cursor.getDay());
    const end = dateFromISO(sorted[sorted.length - 1]);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const cells: StepCalendarProps["days"] = [];
    while (cursor <= end) {
      cells.push({ date: toLocalISO(cursor), isCurrentMonth: true });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [availableDays]);
  const gridDays = windowDays ?? days;
  const gridStart = gridDays.find((day) => day.date)?.date;
  const gridStartMonth = gridStart?.slice(0, 7);

  const disabledSet = useMemo(
    () =>
      new Set(
        disabledDates
          .map((date) => normalizeDateToISO(date))
          .filter(Boolean) as string[],
      ),
    [disabledDates],
  );

  const availabilityByDate = useMemo(
    () => new Map(availableDays.map((day) => [day.date, day])),
    [availableDays],
  );

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayHasFutureSlots =
    workSlots.length === 0 || workSlots.some((slot) => slot > currentHHMM);

  function isDayDisabled(day: StepCalendarProps["days"][number]): boolean {
    if (!day.date || !day.isCurrentMonth) return true;
    if (showAvailability) return !availabilityByDate.has(day.date);

    const isToday = day.date === todayIso;
    return (
      !!day.disabled ||
      disabledSet.has(day.date) ||
      (isToday && !todayHasFutureSlots)
    );
  }

  const selectableDates = gridDays
    .filter((day) => !isDayDisabled(day))
    .map((day) => day.date);
  const selectableDatesKey = selectableDates.join("|");
  const [focusedDate, setFocusedDate] = useState("");

  useEffect(() => {
    setFocusedDate((current) =>
      selectableDates.includes(current) ? current : (selectableDates[0] ?? ""),
    );
  }, [selectableDatesKey]);

  const featuredDate = focusedDate ? formatFeaturedDate(focusedDate) : null;
  const featuredAvailability = focusedDate
    ? availabilityByDate.get(focusedDate)
    : undefined;

  // O mês do destaque acompanha o dia selecionado (tocar em 02/10 mostra OUTUBRO)
  const monthSource = focusedDate || currentMonthDate;
  const monthDate = monthSource ? dateFromISO(monthSource) : new Date();
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" })
    .format(monthDate)
    .toLocaleUpperCase("pt-BR");
  const monthYear = String(monthDate.getFullYear());

  const availableMonthKeys = Array.from(
    new Set(availableDays.map((day) => day.date.slice(0, 7))),
  ).sort();
  const firstAvailableMonth = availableMonthKeys[0];
  const lastAvailableMonth = availableMonthKeys.at(-1);
  const prevDisabled = showAvailability
    ? !currentMonthKey || currentMonthKey <= firstAvailableMonth
    : monthInPast;
  const nextDisabled = showAvailability
    ? !currentMonthKey || currentMonthKey >= lastAvailableMonth
    : false;

  // Troca do número grande ao tocar num dia: o novo entra de baixo.
  // A seleção vale na hora; a animação é só enfeite e nunca segura o toque.
  const heroDayRef = useRef<HTMLElement | null>(null);
  const heroSwapRef = useRef(false);

  function selectDay(date: string) {
    if (date === focusedDate) return;
    heroSwapRef.current = !REDUCED_MOTION;
    setFocusedDate(date);
  }

  useLayoutEffect(() => {
    if (!heroSwapRef.current || !heroDayRef.current) return;
    heroSwapRef.current = false;
    gsap.fromTo(
      heroDayRef.current,
      { yPercent: 30, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.32, ease: "power3.out", overwrite: true },
    );
  }, [focusedDate]);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (availableDaysLoading || REDUCED_MOTION) return;
    if (titleRef.current) gsap.set(titleRef.current, { opacity: 0, y: -14 });
    if (calendarRef.current) gsap.set(calendarRef.current, { opacity: 0, y: 12 });
    if (actionsRef.current) gsap.set(actionsRef.current, { opacity: 0, y: 8 });
  }, [availableDaysLoading]);

  useEffect(() => {
    if (availableDaysLoading || REDUCED_MOTION) return;

    const timeline = gsap.timeline();
    if (titleRef.current) {
      timeline.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
      });
    }
    if (calendarRef.current) {
      timeline.to(
        calendarRef.current,
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.28",
      );
    }
    if (actionsRef.current) {
      timeline.to(
        actionsRef.current,
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
        "-=0.2",
      );
    }

    return () => {
      timeline.kill();
    };
  }, [availableDaysLoading]);

  function changeMonth(direction: "prev" | "next") {
    setFocusedDate("");
    if (direction === "prev") onPrevMonth();
    else onNextMonth();
  }

  const fill = useFillAdvance();

  function confirmDate() {
    if (!focusedDate) return;
    const date = focusedDate;
    fill.run(() => onSelectDay(date));
  }

  const showEmptyState =
    !showAvailability && !!availableDaysMessage && !availableDaysError;

  return (
    <section id="step-schedule" className="step">
      {availableDaysLoading ? (
        <div className="calendar-loading animate-fade-in-up">
          <ProgressiveBarLoader label="Carregando calendário" />
        </div>
      ) : (
        <>
          <h2 ref={titleRef} className="label calendar-title">
            Escolha o melhor dia
          </h2>

          {showEmptyState ? (
            <div className="availability-empty animate-fade-in-up">
              <p>{availableDaysMessage}</p>
            </div>
          ) : (
            <div ref={calendarRef} className="editorial-calendar">
              {availableDaysMessage && availableDaysError && (
                <div className="availability-warning">
                  <p>{availableDaysMessage}</p>
                </div>
              )}

              <div className="editorial-calendar__utility">
                <span className="editorial-calendar__availability">
                  {showAvailability
                    ? `${availableDays.length} dias disponíveis`
                    : "Selecione uma data"}
                </span>

                {!windowDays && (
                  <div className="editorial-calendar__month-nav" aria-label="Navegar entre meses">
                    <button
                      type="button"
                      className="editorial-calendar__nav-button"
                      onClick={() => changeMonth("prev")}
                      disabled={prevDisabled}
                      aria-label="Mês anterior"
                    >
                      <ChevronIcon direction="left" />
                    </button>
                    <button
                      type="button"
                      className="editorial-calendar__nav-button"
                      onClick={() => changeMonth("next")}
                      disabled={nextDisabled}
                      aria-label="Próximo mês"
                    >
                      <ChevronIcon direction="right" />
                    </button>
                  </div>
                )}
              </div>

              <div className="editorial-calendar__hero" aria-live="polite">
                <strong ref={heroDayRef} className="editorial-calendar__featured-day">
                  {featuredDate?.day ?? "—"}
                </strong>

                <div className="editorial-calendar__date-meta">
                  <div className="editorial-calendar__month-block">
                    <span className="editorial-calendar__month">{monthName}</span>
                    <span className="editorial-calendar__year">{monthYear}</span>
                  </div>
                  <span className="editorial-calendar__weekday">
                    {featuredDate?.weekday ?? ""}
                  </span>
                </div>
              </div>

              <div className="editorial-calendar__summary">
                {featuredAvailability ? (
                  <>
                    <strong>{featuredAvailability.availableSlotsCount} horários disponíveis</strong>
                    <span>
                      {featuredAvailability.firstSlot
                        ? `Próximo livre às ${featuredAvailability.firstSlot}`
                        : "Consulte os horários deste dia"}
                    </span>
                  </>
                ) : (
                  <span>Escolha um dos dias disponíveis abaixo</span>
                )}
              </div>

              <div className="editorial-calendar__week" role="row">
                {week.map((weekday) => (
                  <span key={weekday} role="columnheader">
                    {weekday.slice(0, 1)}
                  </span>
                ))}
              </div>

              <div className="editorial-calendar__days" role="grid" aria-label={monthTitle}>
                {gridDays.map((day, index) => {
                  if (!day.date) {
                    return <span key={`empty-${index}`} className="calendar-dot calendar-dot--empty" aria-hidden="true" />;
                  }

                  const disabled = isDayDisabled(day);
                  const selected = day.date === focusedDate;
                  const today = day.date === todayIso;
                  const isSunday = getWeekday(day.date) === 0;
                  const dayNumber = getDayNumber(day.date);
                  const isPast = day.date < todayIso;
                  const monthMark =
                    windowDays && gridStartMonth && day.date.slice(0, 7) !== gridStartMonth
                      ? new Intl.DateTimeFormat("pt-BR", { month: "short" })
                          .format(dateFromISO(day.date))
                          .replace(".", "")
                          .toLocaleUpperCase("pt-BR")
                      : null;
                  const ariaLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
                    dateFromISO(day.date),
                  );

                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="gridcell"
                      className={[
                        "calendar-dot",
                        disabled ? "calendar-dot--disabled" : "calendar-dot--available",
                        selected ? "calendar-dot--selected" : "",
                        monthMark ? "calendar-dot--with-month" : "",
                        today ? "calendar-dot--today" : "",
                        isSunday ? "calendar-dot--sunday" : "",
                        !day.isCurrentMonth ? "calendar-dot--outside" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={disabled}
                      onClick={() => selectDay(day.date)}
                      aria-label={`${ariaLabel}${disabled ? ", indisponível" : ", disponível"}`}
                      aria-selected={selected}
                    >
                      {monthMark && (
                        <span className="calendar-dot__month" aria-hidden="true">{monthMark}</span>
                      )}
                      {isPast && monthInPast && !windowDays ? "×" : dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div ref={actionsRef} className="editorial-calendar__actions">
            <button id="back-to-pro" type="button" className="liquid-btn back cal-back-btn" onClick={back}>
              Voltar
            </button>
            {!showEmptyState && (
              <button
                type="button"
                className={`liquid-btn fill-btn editorial-calendar__confirm ${fill.filling ? "is-filling" : ""}`}
                onClick={confirmDate}
                disabled={!focusedDate}
              >
                Ver horários
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
