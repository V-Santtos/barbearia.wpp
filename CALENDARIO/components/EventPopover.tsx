// components/EventPopover.tsx
import React, { useMemo, useRef } from "react";
import { Pencil, Trash2, X, Clock3, Menu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Event, Professional } from "../types";

// Converte URLs em links clicáveis dentro de um texto
const linkifyDescription = (text: string) => {
  if (!text) return null;

  // captura qualquer http(s) até o próximo espaço
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    // índices ímpares (1, 3, 5...) são as URLs capturadas pelo regex
    if (index % 2 === 1) {
      const isWhatsApp =
        part.includes("wa.me") || part.includes("api.whatsapp.com");

      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isWhatsApp
              ? "text-[#25D366] underline break-all"
              : "text-indigo-300 underline break-all"
          }
        >
          {isWhatsApp ? "Abrir WhatsApp" : part}
        </a>
      );
    }

    // trecho normal de texto
    return <span key={index}>{part}</span>;
  });
};

export type Anchor = { x: number; y: number };

interface EventPopoverProps {
  event: Event;
  professional?: Professional;
  anchor: Anchor;                 // onde o popover deve abrir
  onEdit: (event: Event) => void; // lápis
  onDelete: (eventId: number) => void; // lixeira
  onClose: () => void;            // X ou fora
}

const formatLongDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d);
};

const CARD_W = 360;
const ESTIMATED_CARD_H = 260;
const GAP = 12;        // distância do ponto de clique
const PAD = 16;        // margem de segurança nas bordas

const EventPopover: React.FC<EventPopoverProps> = ({
  event,
  professional,
  anchor,
  onEdit,
  onDelete,
  onClose,
}) => {
  const professionalColor =
     professional?.color && professional.color.startsWith('#')
       ? professional.color
       : '#6B3EFF';

  const colorStyle =
     professional?.color && professional.color.startsWith('#')
       ? { backgroundColor: professional.color }
       : undefined;

  // Evita double-click em deletar
  const deletingRef = useRef(false);
  const handleDeleteClick = () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      onDelete(event.id);
    } finally {
      onClose();
      setTimeout(() => (deletingRef.current = false), 200);
    }
  };

  /**
   * Define em qual lado o card deve abrir e calcula a posição:
   * - clique à esquerda => card à direita do ponto
   * - clique à direita => card à esquerda do ponto
   * Faz clamp para não ultrapassar a viewport.
   */
  const { style, slideFrom } = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const openToRight = anchor.x < vw / 2; // true => abre à direita do ponto
    let left = openToRight
      ? anchor.x + GAP
      : anchor.x - GAP - CARD_W;

    // clamp horizontal
    if (left < PAD) left = PAD;
    if (left + CARD_W + PAD > vw) left = vw - PAD - CARD_W;

    // posição vertical preferida: um pouco acima do ponto, com clamp
    const actualCardHeight = Math.min(ESTIMATED_CARD_H, vh - PAD * 2);
    let top = anchor.y - actualCardHeight / 2;
    if (top < PAD) top = PAD;
    const maxTop = vh - PAD - actualCardHeight;
    if (top > maxTop) top = maxTop;

    // anima do lado oposto ao qual “nasce”
    const slide = openToRight ? 16 : -16;

    const css: React.CSSProperties = {
      position: "fixed",
      left,
      top,
      width: CARD_W,
      zIndex: 60,
      maxHeight: actualCardHeight,
    };

    return { style: css, slideFrom: slide };
  }, [anchor.x, anchor.y]);

  return (
    <>
      <AnimatePresence>
        {/* Backdrop com fade */}
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 bg-black/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeInOut" }}
          onClick={onClose}
        />

        {/* Card com slide lateral conforme o lado escolhido */}
        <motion.div
          key="card"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do agendamento"
          className="z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1c] text-white shadow-2xl"
          style={{
            ...style,
            boxShadow: `0 24px 54px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.04), -3px 0 0 ${professionalColor}`,
          }}
          initial={{ opacity: 0, x: slideFrom, y: 4 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: slideFrom, y: 4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-3">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={colorStyle}
              />
              <h3 className="truncate text-[15px] font-semibold leading-tight md:text-base">
                {event.title}
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="rounded-xl p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Editar"
                onClick={() => onEdit(event)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="rounded-xl p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Excluir"
                onClick={handleDeleteClick}
              >
                <Trash2 size={16} />
              </button>
              <button
                className="rounded-xl p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Fechar"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="h-px w-full bg-white/10" />

          {/* Corpo */}
          <div className="max-h-[calc(100%-49px)] overflow-y-auto px-3 pb-3 pt-2 text-sm custom-scrollbar">
            {/* Data */}
            <div className="text-[13px] text-white/80 md:text-sm">
              {formatLongDate(event.date)}
            </div>

            {/* Horário */}
            <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold tracking-wide md:text-base">
              <Clock3 className="h-[18px] w-[18px] shrink-0 opacity-80" />
              <span>
                {event.startTime} – {event.endTime}
              </span>
            </div>

            {/* Descrição (ícone centralizado) */}
            {event.description ? (
              <div className="mt-3 flex items-start gap-2">
                <Menu className="mt-[2px] h-4 w-4 shrink-0 opacity-80" />
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85 md:text-sm">
                  {linkifyDescription(event.description)}
                </div>
              </div>
            ) : null}

            {/* Profissional */}
            <div className="mt-3 text-[13px] text-white/70 md:text-sm">
              Criado para:{" "}
              <span className="font-medium text-white">
                {professional?.name ?? "—"}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default EventPopover;
