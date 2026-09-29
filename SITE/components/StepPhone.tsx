import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { checkPhone, VISUAL_MOCK_ENABLED } from "../api";
import { callWithRetry } from "../retry";
import { useFillAdvance } from "../hooks/useFillAdvance";

interface StepPhoneProps {
  phone: string;
  setPhone: (v: string) => void;
  next: () => void;
}

type ExistingEvent = {
  servico?: string | null;
  profissional?: string;
  dia_marcado?: string;
  hora_marcada?: string;
  source?: string | null;
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatDateTime(dia?: string, hora?: string) {
  if (!dia) return "—";

  const time = hora ? String(hora).slice(0, 5) : "";

  const iso = dia.includes("T") ? dia.slice(0, 10) : dia;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);

    const dateObj = new Date(y, mo, d, 12, 0, 0);

    let weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
      dateObj,
    );
    weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    weekday = weekday.replace("-", " - ");

    const day2 = String(dateObj.getDate()).padStart(2, "0");
    const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
      dateObj,
    );

    return time
      ? `${weekday}, ${day2} de ${month} às ${time}`
      : `${weekday}, ${day2} de ${month}`;
  }

  let cleaned = dia.trim();
  cleaned = cleaned.replace(/\s+às\s+\d{1,2}:\d{2}.*$/i, "");
  cleaned = cleaned.replace(/\s+de\s+\d{4}\b/i, "");
  cleaned = cleaned.replace(
    /^([A-Za-zÀ-ÿ]+)\s*-\s*([A-Za-zÀ-ÿ]+)/,
    (_: string, a: string, b: string) =>
      `${a.charAt(0).toUpperCase() + a.slice(1).toLowerCase()} - ${b.toLowerCase()}`,
  );
  cleaned = cleaned.replace(
    /^([A-Za-zÀ-ÿ]+)-([A-Za-zÀ-ÿ]+)/,
    (_: string, a: string, b: string) =>
      `${a.charAt(0).toUpperCase() + a.slice(1).toLowerCase()} - ${b.toLowerCase()}`,
  );

  return time ? `${cleaned} às ${time}` : cleaned;
}

export default function StepPhone({
  phone,
  setPhone,
  next,
}: StepPhoneProps) {
  const digitsPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const isComplete = VISUAL_MOCK_ENABLED
    ? digitsPhone.length > 0
    : digitsPhone.length === 11;

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingEvent, setExistingEvent] = useState<ExistingEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const nextLockRef = useRef(false);
  const debounceIdRef = useRef<number | null>(null);
  const reqSeqRef = useRef(0);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  // Popup animation refs
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const canProceed =
    isComplete &&
    verifiedPhone === digitsPhone &&
    !checking &&
    !existingEvent &&
    !error;

  // Animate popup in/out with GSAP
  useEffect(() => {
    const overlay = overlayRef.current;
    const card = cardRef.current;
    if (!overlay || !card) return;

    if (showPopup && existingEvent) {
      gsap.to(overlay, {
        autoAlpha: 1,
        duration: 0.2,
        ease: "power2.out",
        overwrite: true,
      });
      gsap.fromTo(
        card,
        { opacity: 0, scale: 0.9, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: "power2.out", overwrite: true },
      );
    } else {
      gsap.to(overlay, {
        autoAlpha: 0,
        duration: 0.18,
        ease: "power2.in",
        overwrite: true,
      });
    }
  }, [showPopup, existingEvent]);

  useEffect(() => {
    if (debounceIdRef.current) {
      window.clearTimeout(debounceIdRef.current);
      debounceIdRef.current = null;
    }

    if (!isComplete) {
      setChecking(false);
      setError(null);
      setExistingEvent(null);
      setShowPopup(false);
      setVerifiedPhone(null);
      return;
    }

    if (verifiedPhone === digitsPhone) return;

    let cancelled = false;
    const mySeq = ++reqSeqRef.current;

    debounceIdRef.current = window.setTimeout(() => {
      debounceIdRef.current = null;

      async function verifyPhone() {
        setChecking(true);
        setError(null);

        try {
          const resp = await callWithRetry(
            (signal) => checkPhone(digitsPhone, { signal }),
            { attempts: 2, timeoutMs: 4500, delayMs: 800, label: "phone" },
          );

          if (cancelled || mySeq !== reqSeqRef.current) return;

          setVerifiedPhone(digitsPhone);

          const exists = !!resp.exists;

          if (exists) {
            setExistingEvent({
              servico: resp.servico,
              profissional: resp.barbeiro,
              dia_marcado: resp.data,
              hora_marcada: resp.horario,
              source: resp.source,
            });
            setShowPopup(true);
          } else {
            setExistingEvent(null);
            setShowPopup(false);
          }
        } catch (e) {
          if (cancelled || mySeq !== reqSeqRef.current) return;

          setVerifiedPhone(null);
          if (e instanceof Error && e.message === "phone-verify-timeout") {
            setError(
              "A verificação demorou demais. Confira sua conexão e tente novamente.",
            );
          } else {
            setError(
              "Não foi possível verificar seu telefone agora. Tente novamente.",
            );
          }
        } finally {
          if (!cancelled && mySeq === reqSeqRef.current) setChecking(false);
        }
      }

      verifyPhone();
    }, 350);

    return () => {
      cancelled = true;
    };
  }, [digitsPhone, isComplete, verifiedPhone]);

  const fill = useFillAdvance();

  function handleNext() {
    if (!canProceed) return;
    if (nextLockRef.current) return;
    nextLockRef.current = true;

    try {
      fill.run(next);
    } finally {
      window.setTimeout(() => {
        nextLockRef.current = false;
      }, 250);
    }
  }

  const overlayJSX = (
    <div
      ref={overlayRef}
      style={{ visibility: "hidden", opacity: 0, position: "fixed", inset: 0, zIndex: 9999 }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }} />

      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div ref={cardRef} style={{ width: "min(76vw, 350px)", display: "flex", flexDirection: "column", gap: "20px" }}>
          {existingEvent && (
            <>
              <h2 className="popup-title">Você já possui um agendamento</h2>

              <div className="timeline" style={{ gap: 0 }}>

                <div className="timeline-item" style={{ opacity: 1, transform: "none", paddingBottom: "28px", display: existingEvent.source === "whatsapp" || !existingEvent.servico ? "none" : undefined }}>
                  <div className="timeline-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 3 14.2 9.8 21 12 14.2 14.2 12 21 9.8 14.2 3 12 9.8 9.8 12 3"/>
                    </svg>
                  </div>
                  <div className="timeline-content">
                    <h2 className="timeline-label">Serviço</h2>
                    <p className="timeline-message">{existingEvent.servico ?? "—"}</p>
                  </div>
                </div>

                <div className="timeline-item" style={{ opacity: 1, transform: "none", paddingBottom: "28px" }}>
                  <div className="timeline-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div className="timeline-content">
                    <h2 className="timeline-label">Profissional</h2>
                    <p className="timeline-message">{existingEvent.profissional ?? "—"}</p>
                  </div>
                </div>

                <div className="timeline-item" style={{ opacity: 1, transform: "none" }}>
                  <div className="timeline-icon timeline-icon--confirmed">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                      <line x1="16" x2="16" y1="2" y2="6"/>
                      <line x1="8" x2="8" y1="2" y2="6"/>
                      <line x1="3" x2="21" y1="10" y2="10"/>
                      <path d="m9 16 2 2 4-4"/>
                    </svg>
                  </div>
                  <div className="timeline-content" style={{ minWidth: 0 }}>
                    <h2 className="timeline-label">Data e horário</h2>
                    <p className="timeline-message" style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>{formatDateTime(existingEvent.dia_marcado, existingEvent.hora_marcada).replace(", ", ",\n")}</p>
                  </div>
                </div>

              </div>

              <div className="field" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className="liquid-btn enabled"
                  onClick={() => setShowPopup(false)}
                >
                  Entendi
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <section id="step-phone" className="step">
        <div className="step-name-home-wrap w-full grid place-items-center animate-fade-in-up">
          <div className="step-name-home-shell rounded-full flex items-center justify-center">
            <a
              href="https://autohost.shop/"
              rel="noopener noreferrer"
              className="step-name-home-link rounded-full grid place-items-center text-white relative overflow-hidden transition-all duration-200 ease-out"
              aria-label="Voltar para a página inicial"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="step-name-home-icon stroke-white fill-none"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5v-9z" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </a>
          </div>
        </div>

        <label htmlFor="phone" className="label step-phone-title">
          Digite seu telefone
        </label>

        <div className="field step-phone-field" style={{ position: "relative" }}>
          {/* honeypot anti-autofill */}
          <input
            type="text"
            autoComplete="off"
            tabIndex={-1}
            style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
          />

          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            name="user-phone"
            placeholder="(00) 00000-0000"
            className="step-phone-input"
            value={phone}
            onChange={(e) => {
              setVerifiedPhone(null);
              setPhone(formatPhone(e.target.value));
            }}
          />

          {error && (
            <p className="step-phone-error text-xs text-center max-w-xs">{error}</p>
          )}

          <div className="step-phone-actions">
            <button
              className={`liquid-btn step-phone-next ${canProceed ? "enabled fill-btn" : ""} ${checking ? "checking" : ""} ${fill.filling ? "is-filling" : ""}`}
              disabled={!canProceed}
              onClick={handleNext}
            >
              {checking ? "Verificando..." : "Prosseguir"}
            </button>
          </div>
        </div>
      </section>

      {createPortal(overlayJSX, document.body)}
    </>
  );
}
