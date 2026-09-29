import { useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";

function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

interface StepSuccessProps {
  name: string;
  onBack: () => void;
}

export default function StepSuccess({ name, onBack }: StepSuccessProps) {
  const iconRef  = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLParagraphElement>(null);
  const line2Ref = useRef<HTMLParagraphElement>(null);
  const btnRef   = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const targets = [iconRef.current, line1Ref.current, line2Ref.current, btnRef.current];
    gsap.set(targets, { opacity: 0 });

    const tl = gsap.timeline();

    tl.fromTo(
      iconRef.current,
      { scale: 0.4, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" },
    )
    .fromTo(
      line1Ref.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: "power2.out" },
      "-=0.18",
    )
    .fromTo(
      line2Ref.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: "power2.out" },
      "-=0.22",
    )
    .fromTo(
      btnRef.current,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
      "+=0.28",
    );

    return () => { tl.kill(); };
  }, []);

  return (
    <div style={{
      padding: "16px 0 8px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "20px",
      textAlign: "center",
    }}>

      {/* Ícone centralizado */}
      <div
        ref={iconRef}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "2px solid rgba(86, 80, 249, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 18px rgba(86, 80, 249, 0.35)",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5650F9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Texto */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p
          ref={line1Ref}
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.25,
          }}
        >
          Tudo certo, {formatDisplayName(name)}!
        </p>
        <p
          ref={line2Ref}
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.60)",
            lineHeight: 1.4,
          }}
        >
          Para reagendar, entre em contato pelo WhatsApp.
        </p>
      </div>

      {/* Botão */}
      <div ref={btnRef}>
        <button className="liquid-btn enabled" onClick={onBack}>
          Voltar ao início
        </button>
      </div>

    </div>
  );
}
