import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { useFillAdvance } from "../hooks/useFillAdvance";

interface StepReviewProps {
  name: string;
  phone: string;
  professional: string;
  service: string;
  date: string; // "AAAA-MM-DD"
  time: string; // "HH:MM"
  back: () => void;
  onConfirm: () => void;
  bookingStatus: string | null;
  bookingInProgress: boolean;
  bookingDone: boolean;
}

// formata "2025-12-18" -> "18 de dezembro"
function formatDatePtBr(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return dateStr;
  }

  const d = new Date(year, month, day);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

type Phase = "idle" | "fadingOutIdle" | "submitting" | "success";

export default function StepReview({
  name,
  phone,
  professional,
  service,
  date,
  time,
  back,
  onConfirm,
  bookingStatus,
  bookingInProgress,
  bookingDone,
}: StepReviewProps) {
  // ====== TEMPOS (alinhados ao seu CSS) ======
  const FADE_OUT_MS = 250;       // .fade-transition / .fade-only-out (0.25s)
  const MIN_LOADING_MS = 2000;   // mínimo mostrando "Agendando..."
  const SLOW_HINT_MS = 9000;     // aviso de "demorando mais que o normal" (UI)
  // (Obs: não “mata” request aqui; só avisa.)

  const formattedDateTime = useMemo(() => {
    if (!date || !time) return "";
    const niceDate = formatDatePtBr(date);
    return `${niceDate} às ${time}`;
  }, [date, time]);

  const baseHint = (
    <>
      Clique em{" "}
      <span style={{ color: "#a855ff", fontWeight: 600 }}>AGENDAR</span>{" "}
       e garanta sua vaga.
    </>
  );

  // Fase visual interna
  const [phase, setPhase] = useState<Phase>(() => {
    if (bookingDone) return "success";
    if (bookingInProgress) return "submitting";
    return "idle";
  });

  // Marca quando o botão "Agendando..." realmente entrou na tela
  const loadingStartedAtRef = useRef<number | null>(null);

  // trava pra não disparar sucesso mais de uma vez
  const successLockedRef = useRef(false);

  const sectionRef = useRef<HTMLElement>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const items  = gsap.utils.toArray<HTMLElement>(".timeline-item");
      const master = gsap.timeline();

      const ENTRY_DUR  = 0.75;
      const COLOR_DUR  = 0.50;
      const STAGGER    = 0.18;
      const COLOR_GAP  = -0.10; // cor começa 100ms antes da entrada terminar

      // Estado inicial: todos em cinza + invisíveis antes do primeiro frame
      gsap.set(items, { filter: "grayscale(1) brightness(0.48)", opacity: 0, y: 18 });
      if (bottomRef.current) {
        gsap.set(bottomRef.current, { opacity: 0, y: 8 });
      }

      items.forEach((item, i) => {
        const icon    = item.querySelector<HTMLElement>(".timeline-icon");
        const entryAt = i * STAGGER;
        const colorAt = entryAt + ENTRY_DUR + COLOR_GAP; // só começa após entrada 100%

        // Onda 1: entrada em cinza (filter intocado)
        master.fromTo(
          item,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: ENTRY_DUR, ease: "power2.out" },
          entryAt,
        );

        // Onda 2: ativação de cor (separada da entrada)
        master.fromTo(
          item,
          { filter: "grayscale(1) brightness(0.48)" },
          {
            filter: "grayscale(0) brightness(1)",
            duration: COLOR_DUR,
            ease: "power2.out",
            // Filtro residual deixa ícone/texto levemente borrados no celular
            clearProps: "filter",
          },
          colorAt,
        );

        // Pulse suave no círculo após cor totalmente revelada
        if (icon) {
          master.to(
            icon,
            {
              // Pulso discreto: em 1.10 o ícone de 15px re-rasterizava e o círculo
              // parecia sair do eixo da linha
              scale: 1.04,
              duration: 0.22,
              ease: "sine.inOut",
              yoyo: true,
              repeat: 1,
              transformOrigin: "50% 50%",
              force3D: true,
              clearProps: "transform",
            },
            colorAt + COLOR_DUR + 0.04,
          );
        }
      });

      // Botões/hint surgem após o último item estar 100% colorido
      const lastColorEnd = (items.length - 1) * STAGGER + ENTRY_DUR + COLOR_GAP + COLOR_DUR;
      if (bottomRef.current) {
        master.to(
          bottomRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.50,
            ease: "power2.out",
            clearProps: "opacity,transform",
          },
          lastColorEnd + 0.12,
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // aviso de lentidão (UI), sem “matar” o request
  const [slowHint, setSlowHint] = useState(false);

  // Clique em "Agendar": preenche o botão, depois inicia fade-out do estado 1 e dispara a API
  const fill = useFillAdvance();

  const handleConfirmClick = () => {
    if (phase !== "idle") return;

    fill.run(() => {
      // reset de tentativas
      successLockedRef.current = false;
      loadingStartedAtRef.current = null;
      setSlowHint(false);

      setPhase("fadingOutIdle");
      onConfirm();
    });
  };

  // 1) Depois do fade-out real (250ms), entra em "submitting"
  useEffect(() => {
    if (phase !== "fadingOutIdle") return;

    const t = window.setTimeout(() => {
      // entra no loading (mesmo que a resposta já tenha vindo)
      loadingStartedAtRef.current = performance.now();
      setPhase("submitting");
    }, FADE_OUT_MS);

    return () => window.clearTimeout(t);
  }, [phase]);

  // 2) Se a request terminar e NÃO foi sucesso, volta pro idle (pra permitir tentar de novo)
  useEffect(() => {
    if (phase !== "submitting") return;

    // se ainda está carregando, não mexe
    if (bookingInProgress) return;

    // se foi sucesso, a regra do sucesso cuida
    if (bookingDone) return;

    // terminou e não foi sucesso -> volta pro idle (mensagem vem de bookingStatus)
    setPhase("idle");
    setSlowHint(false);
  }, [phase, bookingInProgress, bookingDone]);

  // 3) Sucesso: garante no mínimo MIN_LOADING_MS a partir do momento que "Agendando..." apareceu
  useEffect(() => {
    if (!bookingDone) return;
    if (successLockedRef.current) return;

    // Se já estava em success, não faz nada
    if (phase === "success") {
      successLockedRef.current = true;
      return;
    }

    // Se ainda não entrou em submitting (pode acontecer por corrida), espera entrar.
    if (phase !== "submitting") return;

    const startedAt = loadingStartedAtRef.current ?? performance.now();
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

    const t = window.setTimeout(() => {
      setPhase("success");
      successLockedRef.current = true;
      setSlowHint(false);
    }, remaining);

    return () => window.clearTimeout(t);
  }, [bookingDone, phase]);

  // 4) Aviso de lentidão (UI) se ficar muito tempo em submitting
  useEffect(() => {
    if (phase !== "submitting") return;

    const t = window.setTimeout(() => {
      // Só mostra aviso se ainda não concluiu
      if (!bookingDone) setSlowHint(true);
    }, SLOW_HINT_MS);

    return () => window.clearTimeout(t);
  }, [phase, bookingDone]);

  const isLoading = phase === "submitting" || phase === "success";
  const isSuccess = false;

  // Texto do estado inicial (idle)
  const idleHintContent =
    phase === "idle" ? bookingStatus || baseHint : baseHint;

  const hintIdleClassName =
    "review-hint fade-only-in fade-only-out" +
    (phase === "fadingOutIdle" ? " fade-only-out--hidden" : "");

  return (
    <section id="step-review" className="step" ref={sectionRef}>
      {/* TÍTULO DO STEP */}
      <h2 className="popup-title animate-fade-in-down">Resumo do agendamento</h2>

      {/* TIMELINE */}
      <div style={{ marginTop: "16px" }}>
        <div className="timeline">

          {/* Ordem segue o caminho real: serviço (home) → nome → telefone → profissional → data */}
          {/* Serviço */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 3 14.2 9.8 21 12 14.2 14.2 12 21 9.8 14.2 3 12 9.8 9.8 12 3"/>
                <line x1="5" x2="5" y1="3" y2="7"/>
                <line x1="3" x2="7" y1="5" y2="5"/>
                <line x1="19" x2="19" y1="17" y2="21"/>
                <line x1="17" x2="21" y1="19" y2="19"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Serviço</h2>
              <p className="timeline-message">{service || "—"}</p>
            </div>
          </div>

          {/* Nome */}
          <div className="timeline-item">
            <div className="timeline-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Seu nome</h2>
              <p className="timeline-message">{name || "—"}</p>
            </div>
          </div>

          {/* Telefone */}
          <div className="timeline-item">
            <div className="timeline-icon">
              {/* Phone by Radhika Studio, Noun Project (CC BY 3.0) */}
              <svg viewBox="0 0 100 100" fill="currentColor" stroke="none">
                <path fillRule="evenodd" d="m32.676 60.156c-6.3633-11.02-10.832-23.059-12.438-34.578-0.72266-6.543-0.28125-13.258 6.6875-15.824l4.7148-1.7109 6.9961 21.629-1.0742 0.46484c-2.168 0.93359-3.3789 3.1602-2.9844 5.4883 0.98438 5.8164 2.5938 11.648 7.0469 19.367 4.457 7.7188 8.7031 12.027 13.246 15.789 1.8203 1.5039 4.3516 1.5703 6.2461 0.16016l0.9375-0.69922 15.234 16.871-3.8359 3.2266c-5.707 4.75-11.742 1.7773-17.047-2.1211-9.1719-7.1484-17.363-17.039-23.727-28.062zm30.812 9.0156 15.16 16.793c0.82422-0.72266 1.2773-1.6484 1.3555-2.7539 0.078125-1.1367-0.26953-2.1445-1.0352-2.9883l-9.4766-10.496c-1.543-1.7109-4.1133-1.9648-5.9609-0.58594zm-30.18-61.734 6.9648 21.527 0.050781-0.023438c2.1172-0.91406 3.1797-3.2656 2.4727-5.457l-4.3516-13.453c-0.35156-1.0859-1.0469-1.8906-2.0703-2.3906-0.99219-0.48438-2.0234-0.55469-3.0625-0.20312z"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Telefone</h2>
              <p className="timeline-message">{phone || "—"}</p>
            </div>
          </div>

          {/* Profissional */}
          <div className="timeline-item">
            <div className="timeline-icon">
              {/* Scissors by Mia Elysia, Noun Project (CC BY 3.0).
                  viewBox recortado: traço fino e diagonal parece menor que os vizinhos */}
              <svg viewBox="6 6 88 88" fill="currentColor" stroke="none">
                <path fillRule="evenodd" d="m81.094 38.035-26.566 15.266c0.35547-1.2266 0.74219-2.4492 1.1562-3.668 0.94531-2.7656 2.0391-5.4688 3.2266-8.1328 7.8672-3.4688 16.805-8.3906 31.055-15.914 0.41016 3.3203-2.9141 9.0273-8.8711 12.449zm-39.164 14.414c-0.36719-0.63672-0.77734-1.2539-1.1953-1.8477-0.42969-0.60937-0.87891-1.1289-0.42578-1.9141l0.76562-1.3359c-1.2148 0.26953-2.4688 0.52344-3.7773 0.77344l1.4609 5.4492c0.97656-0.58203 2.0234-0.98047 3.1719-1.125zm6.5156 19.621c3.332 3.2578 4.1758 8.4766 1.7383 12.699-2.8867 5-9.2812 6.7148-14.281 3.8242-5-2.8867-6.7148-9.2812-3.8242-14.281 2.668-4.6211 7.8242-7.5547 10.969-11.102l6.5078 1.7422c-0.38281 2.1992-0.75 4.5547-1.1094 7.1133zm-4.5078 2.6094c-2.6875-1.5508-6.1211-0.63281-7.6719 2.0547s-0.63281 6.1211 2.0547 7.6719 6.1211 0.63281 7.6719-2.0547c1.5508-2.6875 0.62891-6.1211-2.0547-7.6719zm-1.3359-25.395 17.453-30.379c3.4258-5.9609 9.1328-9.2812 12.449-8.8711-14.266 27.02-19.191 34.941-22.543 52.668l-5.4492-1.4609c1.7812-2.9961 1.8555-6.6133-1.9141-11.957zm4.6914 1.1445c0.84766 0.48828 1.9297 0.19922 2.418-0.64844 0.48828-0.84766 0.19922-1.9297-0.64844-2.418s-1.9297-0.19922-2.418 0.64844c-0.48828 0.84766-0.19922 1.9297 0.64844 2.418zm-21.609 15.582c-5 2.8867-11.395 1.1758-14.281-3.8242-2.8867-5-1.1758-11.395 3.8242-14.281 4.2227-2.4375 9.4414-1.5938 12.699 1.7383 2.5586-0.35938 4.9102-0.72656 7.1133-1.1094l1.7422 6.5078c-3.5469 3.1484-6.4805 8.3008-11.102 10.969zm-0.36328-11.859c-1.5508-2.6875-4.9844-3.6055-7.6719-2.0547-2.6875 1.5508-3.6055 4.9844-2.0547 7.6719s4.9844 3.6055 7.6719 2.0547 3.6055-4.9844 2.0547-7.6719z"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Profissional</h2>
              <p className="timeline-message">{professional || "—"}</p>
            </div>
          </div>

          {/* Data e horário */}
          <div className="timeline-item">
            <div className="timeline-icon timeline-icon--confirmed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
                <path d="m9 16 2 2 4-4"/>
              </svg>
            </div>
            <div className="timeline-content">
              <h2 className="timeline-label">Data e horário</h2>
              <p className="timeline-message">{formattedDateTime || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========= TEXTOS DE STATUS + BOTÕES (aparecem por último via GSAP) ========= */}
      <div ref={bottomRef}>

        {/* Sem frase de instrução: o botão Agendar já diz. Só aparece para status/erro. */}
        {(phase === "idle" || phase === "fadingOutIdle") && bookingStatus && (
          <p
            className={hintIdleClassName}
            style={{ marginTop: "14px", fontSize: "14px", fontWeight: 600 }}
          >
            {idleHintContent}
          </p>
        )}

        {isLoading && (
          <p
            className="review-hint fade-only-in"
            style={{ marginTop: "14px", fontSize: "14px", fontWeight: 600 }}
          >
            {slowHint
              ? "Ainda estamos finalizando… só mais um instante."
              : "Estamos criando o seu agendamento..."}
          </p>
        )}

        {(phase === "idle" || phase === "fadingOutIdle") && (
          <div
            className={
              "field fade-transition" +
              (phase === "fadingOutIdle" ? " fade-transition--hidden" : "")
            }
            style={{
              gridAutoFlow: "column",
              justifyContent: "center",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <button className="liquid-btn back" onClick={back}>
              Voltar
            </button>

            <button
              className={`liquid-btn fill-btn review-confirm ${fill.filling ? "is-filling" : ""}`}
              onClick={handleConfirmClick}
            >
              Agendar
            </button>
          </div>
        )}

        {isLoading && (
          <div
            className="field animate-fade-in-up"
            style={{ justifyContent: "center", marginTop: "10px" }}
          >
            <button className="liquid-btn review-confirm review-confirm--loading" type="button" disabled>
              <span>Agendando</span>
              <span className="dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            </button>
          </div>
        )}


      </div>
    </section>
  );
}
