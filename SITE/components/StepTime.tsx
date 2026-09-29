import React, { useEffect, useRef, useMemo } from "react";
import { ProgressiveBarLoader } from "./GlobalLoading";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface StepTimeProps {
  slots: string[];
  loading?: boolean;
  message?: string | null;
  back: () => void;
  onSelectTime: (t: string) => void;
}

export default function StepTime({ slots, loading = false, message, back, onSelectTime }: StepTimeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Remove duplicados e ordena (garantia final)
  const sortedSlots = useMemo(() => {
    return [...new Set(slots)].sort((a, b) => a.localeCompare(b));
  }, [slots]);

  // Modo carrossel quando houver 5+ horários
  const isCarousel = sortedSlots.length >= 5;

  // Efeito de borda ligado à rolagem: o horário encostado na borda (quando há mais
  // horários além dela) fica menor, transparente e desfocado; conforme a rolagem
  // o afasta da borda, volta ao normal. Estilo direto no elemento, sem estado,
  // para não re-renderizar a cada frame.
  const EDGE_ZONE = 60; // altura de um horário + espaçamento

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !isCarousel) return;

    const box = el.getBoundingClientRect();
    const hasAbove = el.scrollTop > 1;
    const hasBelow = el.scrollHeight - el.clientHeight - el.scrollTop > 1;

    el.querySelectorAll<HTMLButtonElement>(".time-btn").forEach((btn) => {
      const r = btn.getBoundingClientRect();
      const fromBottom = hasBelow ? (box.bottom - r.bottom) / EDGE_ZONE : 1;
      const fromTop = hasAbove ? (r.top - box.top) / EDGE_ZONE : 1;
      const p = Math.max(0, Math.min(1, fromBottom, fromTop));

      if (p >= 1 || REDUCED_MOTION) {
        // Totalmente visível: limpa o inline para o hover voltar a funcionar
        btn.style.transform = "";
        btn.style.opacity = "";
        btn.style.filter = "";
        return;
      }
      btn.style.transform = `scale(${0.9 + 0.1 * p})`;
      btn.style.opacity = String(0.5 + 0.5 * p);
      btn.style.filter = `blur(${((1 - p) * 1.5).toFixed(2)}px)`;
    });
  }

  // Aplica o efeito de borda assim que a lista aparece (fim do carregamento),
  // sem esperar a primeira rolagem
  useEffect(() => {
    if (loading || !isCarousel) return;
    const frame = requestAnimationFrame(handleScroll);
    return () => cancelAnimationFrame(frame);
  }, [loading, sortedSlots, isCarousel]);

  // Inicialização do carrossel
  useEffect(() => {
    if (!scrollRef.current) return;

    if (!isCarousel) return;

    const el = scrollRef.current;
    const itemHeight = 56;

    const middleIndex = Math.max(0, Math.floor(sortedSlots.length / 2) - 1);
    const target = middleIndex * itemHeight;

    el.scrollTo({ top: target, behavior: "auto" });

    // Aplica o efeito de borda já na posição inicial
    requestAnimationFrame(() => {
      handleScroll();
    });
  }, [sortedSlots, isCarousel]);

  return (
    <section id="step-time" className="step">
      {loading ? (
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
          }}
        >
          <ProgressiveBarLoader label="Carregando horários" />
        </div>
      ) : (
        <>
          <label className="label animate-fade-in-down">Escolha um horário</label>

          {message && (
            <p className="text-gray-300 text-center text-sm mt-2 max-w-xs mx-auto">
              {message}
            </p>
          )}

          <div
            className="time-wrap animate-fade-in-up"
            style={{ position: "relative" }}
          >
            <div
              className="time-scroll"
              ref={scrollRef}
              onScroll={isCarousel ? handleScroll : undefined}
              style={{
                maxHeight: isCarousel ? "240px" : "auto",
                overflowY: isCarousel ? "auto" : "visible",
              }}
            >
              <div className="time-list">
                {sortedSlots.length === 0 && (
                  <p className="text-gray-300 text-center text-sm mt-2">
                    Nenhum horário disponível neste dia.
                  </p>
                )}

                {sortedSlots.map((slot) => (
                  <button
                    key={slot}
                    className="time-btn"
                    onClick={() => onSelectTime(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              marginTop: "16px",
            }}
          >
            <button className="liquid-btn back" onClick={back}>
              Voltar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
