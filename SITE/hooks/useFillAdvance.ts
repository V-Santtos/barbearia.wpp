import { useEffect, useRef, useState } from "react";

// Mesmo tempo do preenchimento em .fill-btn::before (styles.css)
export const FILL_MS = 450;

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Botão principal contornado: no clique o roxo preenche o botão e só então
// a ação roda. O avanço vem de um timer, não do fim da animação — se a
// animação travar, a etapa avança do mesmo jeito.
// O botão fica cheio depois disso: a etapa sai de cena já preenchida.
export function useFillAdvance() {
  const [filling, setFilling] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function run(action: () => void) {
    if (filling) return;
    if (REDUCED_MOTION) {
      action();
      return;
    }
    setFilling(true);
    timerRef.current = window.setTimeout(action, FILL_MS);
  }

  return { filling, run };
}
