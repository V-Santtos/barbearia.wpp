import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { SUPERFICIE_MENU } from "./menuFlutuante";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /* O campo que abriu a seleção. No desktop, com ele, a folha vira menu
     colado ao campo (ver abaixo); sem ele, continua folha em qualquer tela. */
  anchor?: HTMLElement | null;
}

/* Altura máxima do menu no desktop, e o vão entre ele e o campo. */
const ALTURA_MAX_MENU = 288;

/* Barra fina, neutra e sem trilho, a mesma do modal de agendamento. Sem
   `scrollbar-width`/`scrollbar-color` de propósito: no Chrome, declarar
   qualquer um dos dois desliga os `::-webkit-scrollbar` e volta a barra do
   sistema, com setinhas e trilho branco. */
const BARRA_DE_ROLAGEM =
  "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15";
const VAO_DO_CAMPO = 6;

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
export default function BottomSheet({ open, onClose, title, children, anchor }: BottomSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  /* Folha que sobe do rodapé é gesto de celular (2026-09-26, apontado pelo
     dono): no desktop ela atravessava a janela inteira para escolher entre
     três barbeiros. Lá a seleção vira menu colado ao campo, com a pele dos
     outros menus do app; abre para baixo e, sem espaço, para cima.
     `position: fixed` continua dispensando o card de deixar o conteúdo vazar. */
  const eDesktop = useMediaQuery("(min-width: 768px)");
  const comoMenu = eDesktop && !!anchor;
  const [posicao, setPosicao] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !comoMenu || !anchor) return;
    const medir = () => {
      const r = anchor.getBoundingClientRect();
      const cabeEmbaixo = window.innerHeight - r.bottom - VAO_DO_CAMPO >= 200;
      setPosicao(
        cabeEmbaixo
          ? { left: r.left, width: r.width, top: r.bottom + VAO_DO_CAMPO }
          : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + VAO_DO_CAMPO }
      );
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [open, comoMenu, anchor]);

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

  if (comoMenu) {
    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Camada invisível: fecha ao clicar fora, sem escurecer a tela --
                é um menu, não um novo diálogo. */}
            <div
              key="menu-backdrop"
              className="fixed inset-0 z-[130]"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />
            <motion.div
              key="menu"
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className={`fixed z-[130] flex flex-col overflow-hidden p-1.5 text-white focus:outline-none ${SUPERFICIE_MENU}`}
              style={{ ...posicao, maxHeight: ALTURA_MAX_MENU }}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.14 }}
              onAnimationComplete={() => {
                if (open) sheetRef.current?.focus({ preventScroll: true });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id={titleId} className="sr-only">
                {title}
              </h3>
              <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${BARRA_DE_ROLAGEM}`}>{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

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
            <div className={`min-h-0 flex-1 overflow-y-auto px-2 pb-4 ${BARRA_DE_ROLAGEM}`}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
