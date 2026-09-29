import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

// =====================================================
// STORE GLOBAL (sem React) - n8n.ts chama Loading.show/hide
// =====================================================
type Listener = (isVisible: boolean) => void;

let pending = 0;
let visible = false;
const listeners = new Set<Listener>();

function emit(next: boolean) {
  visible = next;
  for (const listener of listeners) listener(visible);
}

export const Loading = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(visible);
    return () => { listeners.delete(listener); };
  },

  show() {
    pending += 1;
    if (!visible) emit(true);
  },

  hide() {
    pending = Math.max(0, pending - 1);
    if (pending === 0 && visible) emit(false);
  },

  reset() {
    pending = 0;
    emit(false);
  },
};

export function ProgressiveBarLoader({
  label = "Carregando calendário",
}: {
  label?: string;
}) {
  return (
    <div
      className="progressive-loader"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="progressive-loader-text">
        {label}
        <span className="progressive-loader-dot">.</span>
        <span className="progressive-loader-dot">.</span>
        <span className="progressive-loader-dot">.</span>
      </p>

      <div className="progressive-loader-track" aria-hidden="true">
        <div className="progressive-loader-bar">
          <div className="progressive-loader-stripes">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GlobalLoading({ label }: { label?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return Loading.subscribe(setIsVisible);
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    gsap.to(el, {
      autoAlpha: isVisible ? 1 : 0,
      duration: 0.25,
      ease: isVisible ? "power2.out" : "power2.in",
      overwrite: true,
    });
  }, [isVisible]);

  return (
    <div
      ref={overlayRef}
      style={{
        visibility: "hidden",
        opacity: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ProgressiveBarLoader label={label} />
    </div>
  );
}
