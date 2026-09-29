import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { getProfessionals, getProfessionalSchedule, Professional } from "../api";
import GlobalLoading, { Loading } from "./GlobalLoading";
import { callWithRetry } from "../retry";
import { GlowingButton } from "./glowing-button";

function extractDisableDays(resp: any): string[] {
  if (!resp || typeof resp !== "object") return [];
  const candidates = [
    resp.DisableDays,
    resp.disableDays,
    resp.disabledDays,
    resp.daysDisabled,
    resp.disable_days,
    resp.disableDaysList,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter((x: any) => typeof x === "string");
  }
  return [];
}

interface StepProProps {
  selectedPro: string | null;
  setSelectedPro: (p: string | null) => void;
  back: () => void;
  next: () => void;
}

export default function StepPro({
  selectedPro: _selectedPro,
  setSelectedPro,
  back,
  next,
}: StepProProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  // showLoading stays true for 260ms after fetch ends so GlobalLoading can fade out fully
  const [showLoading, setShowLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const showLoadingTimerRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const proListRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Hide title and actions before first paint
  useLayoutEffect(() => {
    if (titleRef.current)   gsap.set(titleRef.current,   { opacity: 0, y: -20 });
    if (actionsRef.current) gsap.set(actionsRef.current, { opacity: 0, y: 8 });
  }, []);

  // Staged animation fires only after GlobalLoading finishes fading out
  useEffect(() => {
    if (showLoading) {
      if (titleRef.current)   gsap.set(titleRef.current,   { opacity: 0, y: -20 });
      if (actionsRef.current) gsap.set(actionsRef.current, { opacity: 0, y: 8 });
      return;
    }

    const tl = gsap.timeline();

    if (!error && professionals.length > 0 && proListRef.current) {
      const buttons = proListRef.current.querySelectorAll("button");

      // 1) Título desce primeiro (igual ao animate-fade-in-down do StepReview)
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" },
      );

      // 2) Cards sobem em stagger (igual aos itens da timeline do StepReview)
      tl.fromTo(
        buttons,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.38, ease: "power2.out", stagger: 0.18 },
        "-=0.38",
      );

      // 3) Voltar sobe por último
      tl.fromTo(
        actionsRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
      );
    } else {
      // Erro ou lista vazia: título desce, Voltar sobe
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
      );
      tl.fromTo(
        actionsRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
        "+=0.1",
      );
    }

    return () => { tl.kill(); };
  }, [showLoading, error, professionals.length]);

  useEffect(() => {
    let active = true;
    setShowLoading(true);
    setError(null);
    Loading.show();

    if (showLoadingTimerRef.current) {
      window.clearTimeout(showLoadingTimerRef.current);
      showLoadingTimerRef.current = null;
    }

    function scheduleHideLoading() {
      // Match GlobalLoading's internal fade-out duration (250ms) + small buffer
      showLoadingTimerRef.current = window.setTimeout(() => {
        if (active) setShowLoading(false);
      }, 260);
    }

    getProfessionals()
      .then((list) => {
        if (!active) return;
        setProfessionals(list);
        Loading.hide();
        scheduleHideLoading();
      })
      .catch(() => {
        if (!active) return;
        setError("Nao foi possivel carregar os profissionais. Tente novamente.");
        Loading.hide();
        scheduleHideLoading();
      });

    return () => {
      active = false;
      if (showLoadingTimerRef.current) {
        window.clearTimeout(showLoadingTimerRef.current);
        showLoadingTimerRef.current = null;
      }
    };
  }, [attempt]);

  async function handleSelect(pro: Professional) {
    if (selecting) return;
    setSelecting(String(pro.id));
    setError(null);

    try {
      const resp = await callWithRetry(
        () => getProfessionalSchedule(pro.id),
        { attempts: 3, timeoutMs: 5000, delayMs: 2000 },
      );

      setSelectedPro(
        JSON.stringify({
          id: String(pro.id),
          name: pro.nome,
          DisableDays: extractDisableDays(resp),
        }),
      );

      next();
    } catch {
      setError("Erro ao verificar disponibilidade. Tente novamente.");
    } finally {
      setSelecting(null);
    }
  }

  return (
    <section id="step-pro" className="step">
      <h2 ref={titleRef} className="step-title">Escolha o profissional</h2>

      {showLoading && (
        <GlobalLoading label="Carregando profissionais" />
      )}

      {!showLoading && !error && professionals.length === 0 && (
        <p className="step-empty-msg">
          Nenhum profissional disponivel no momento.
        </p>
      )}

      {!showLoading && professionals.length > 0 && (
        <div ref={proListRef} className="pro-list">
          {professionals.map((pro) => {
            const isSelecting = selecting === String(pro.id);
            return (
              <GlowingButton
                key={pro.id}
                glowColor={pro.cor ?? "#5650F9"}
                className={isSelecting ? "opacity-65 cursor-wait" : ""}
                onClick={() => handleSelect(pro)}
                disabled={!!selecting}
              >
                {isSelecting ? "Verificando..." : pro.nome}
              </GlowingButton>
            );
          })}
        </div>
      )}

      {!showLoading && error && (
        <p className="step-error-msg">{error}</p>
      )}

      <div ref={actionsRef} className="step-actions">
        <button
          className="liquid-btn back-btn"
          onClick={back}
          disabled={!!selecting}
        >
          Voltar
        </button>

        {error && (
          <button
            className="liquid-btn enabled"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  );
}
