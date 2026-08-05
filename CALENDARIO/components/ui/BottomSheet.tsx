import { useEffect } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
   rolagem só no miolo. Vidro pesado pra ficar acima do backdrop do modal
   (z-[110]) sem precisar de portal: renderizada como filha normal da árvore,
   `position: fixed` já a tira do fluxo do card. */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-[2px]"
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
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[130] flex max-h-[75vh] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#1c1c1c] text-white"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/20" />
            </div>
            <h3 className="flex-shrink-0 px-5 pb-3 pt-1 text-[15px] font-semibold text-white">
              {title}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
