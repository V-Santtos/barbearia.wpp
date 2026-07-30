// components/DayEventsPopover.tsx
import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Event, Professional } from "../types";

export type Anchor = { x: number; y: number };

interface DayEventsPopoverProps {
  dateISO: string;                    // YYYY-MM-DD
  events: Event[];                    // todos os eventos do dia
  professionals: Professional[];
  anchor: Anchor;                     // ponto para lateralizar
  onPick: (ev: Event) => void;        // abrir popover do evento
  onClose: () => void;
}

const CARD_W = 340;
const GAP = 12;
const PAD = 16;
const ESTIMATED_CARD_H = 420;

const DayEventsPopover: React.FC<DayEventsPopoverProps> = ({
  dateISO,
  events,
  professionals,
  anchor,
  onPick,
  onClose,
}) => {
  // map id->color
  const colorOf = (profId: number) =>
    professionals.find(p => p.id === profId)?.color ?? "#6B3EFF";

  // ordenar por horário (09:00, 10:30, …)
  const items = useMemo(() => {
    const toKey = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    return [...events].sort((a, b) => toKey(a.startTime) - toKey(b.startTime));
  }, [events]);

  const { style, slideFrom } = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const openToRight = anchor.x < vw / 2;
    let left = openToRight ? anchor.x + GAP : anchor.x - GAP - CARD_W;

    if (left < PAD) left = PAD;
    if (left + CARD_W + PAD > vw) left = vw - PAD - CARD_W;

    let top = anchor.y - ESTIMATED_CARD_H / 2;
    if (top < PAD) top = PAD;
    const actualCardHeight = Math.min(ESTIMATED_CARD_H, vh - PAD * 2);
    const maxTop = vh - PAD - actualCardHeight;
    if (top > maxTop) top = maxTop;

    return {
      style: {
        position: "fixed" as const,
        left,
        top,
        width: CARD_W,
        zIndex: 60,
        maxHeight: actualCardHeight,
      },
      slideFrom: openToRight ? 16 : -16,
    };
  }, [anchor.x, anchor.y]);

  const niceDate = useMemo(() => {
    const d = new Date(dateISO + "T00:00:00");
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "long",
    }).format(d);
  }, [dateISO]);

  return (
    <AnimatePresence>
      <motion.div
        key="day-backdrop"
        className="fixed inset-0 z-50 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeInOut" }}
        onClick={onClose}
      />

      <motion.div
        key="day-card"
        className="z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1c] text-white shadow-2xl"
        style={style}
        initial={{ opacity: 0, x: slideFrom, y: 4 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: slideFrom, y: 4 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <div className="flex max-h-[inherit] flex-col px-3 py-3">
          <div className="mb-2 flex flex-shrink-0 items-baseline justify-between gap-3">
            <div className="text-[13px] font-semibold text-white/80 capitalize">
              {niceDate}
            </div>
            <div className="text-[11px] font-medium text-white/45">
              {items.length} agendamento{items.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto divide-y divide-white/10 rounded-xl border border-white/10 custom-scrollbar">
            {items.map(ev => (
              <button
                key={ev.id}
                onClick={() => onPick(ev)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/10"
                title={`${ev.title} – ${ev.startTime}`}
                style={{ boxShadow: `inset 3px 0 0 ${colorOf(ev.professionalId)}` }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(ev.professionalId) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {ev.title}
                  </div>
                  <div className="text-xs text-white/70">
                    {ev.startTime} – {ev.endTime}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DayEventsPopover;
