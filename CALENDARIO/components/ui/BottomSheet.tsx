import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/* Folha que sobe do rodapé da TELA, não do card que a abriu -- é o que
   resolve escolher entre muitos itens (profissional, data, horário) sem
   precisar que o dropdown escape dos limites do card que o contém.
   Usada pelo EventModal (ANEXO-PLANO-LAPIDACAO 4.5): antes desses três
   dropdowns virarem folha, eles eram `absolute` e "escapavam" do card de
   propósito -- o card tinha que ficar `overflow-visible` pra não clipá-los, o
   que por sua vez impedia o rodapé (Cancelar/Salvar) de ficar fixo com
   rolagem só no miolo. A camada escurece sem `backdrop-filter`: no iPhone,
   recompor a textura do modal por baixo do blur fazia o fundo parecer mover.
   O foco só entra na folha depois da animação e sempre com `preventScroll`:
   focar um item ainda transladado para fora da tela fazia o Safari tentar
   trazê-lo para o viewport, deslocando também o formulário ao fundo.
   Fica acima do backdrop do modal (z-[110]) sem precisar de portal:
   renderizada como filha normal da árvore,
   `position: fixed` já a tira do fluxo do card. */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) {
        e.preventDefault();
        sheetRef.current?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-[130] bg-black/65"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[130] flex max-h-[75vh] flex-col overflow-hidden overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[#1c1c1c] text-white focus:outline-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            onAnimationComplete={() => {
              if (open) sheetRef.current?.focus({ preventScroll: true });
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/20" />
            </div>
            <h3 id={titleId} className="flex-shrink-0 px-5 pb-3 pt-1 text-[15px] font-semibold text-white">
              {title}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
