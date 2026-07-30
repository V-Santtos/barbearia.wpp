import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "warning" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

/* ---------------------------------------------------------------------------
   Store (pub/sub singleton) — permite chamar toast.warning('...') de qualquer
   lugar do app sem prop-drilling. Renderize <Toaster /> UMA vez no App.tsx.
--------------------------------------------------------------------------- */
let toasts: ToastItem[] = [];
let listeners: Array<(t: ToastItem[]) => void> = [];
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(toasts));
}

function push(message: string, variant: ToastVariant, duration = 5000) {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant, duration }];
  emit();
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  warning: (msg: string, duration?: number) => push(msg, "warning", duration),
  error: (msg: string, duration?: number) => push(msg, "error", duration),
  info: (msg: string, duration?: number) => push(msg, "info", duration),
  dismiss,
};

/* ---------------------------------------------------------------------------
   Aparência por variante — container sempre no visual do app (painel escuro
   + borda/glow roxos); só o ícone e o acento mudam por severidade.
--------------------------------------------------------------------------- */
const VARIANTS: Record<
  ToastVariant,
  { Icon: typeof Clock; accent: string; glow: string }
> = {
  warning: { Icon: Clock, accent: "#fbbf24", glow: "rgba(106, 61, 255, 0.30)" },
  error: {
    Icon: AlertTriangle,
    accent: "#f87171",
    glow: "rgba(239, 68, 68, 0.28)",
  },
  info: { Icon: Info, accent: "#a78bfa", glow: "rgba(106, 61, 255, 0.30)" },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const { Icon, accent, glow } = VARIANTS[item.variant];

  useEffect(() => {
    if (!item.duration) return;
    const t = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onDismiss]);

  return (
    <motion.div
      layout
      role="status"
      aria-live="polite"
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 16, scale: 0.96 }
      }
      animate={
        prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
      }
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 12, scale: 0.96 }
      }
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md"
      style={{
        background: "rgba(20, 19, 20, 0.92)",
        borderColor: "rgba(168, 85, 247, 0.25)",
        boxShadow: `0 10px 34px rgba(0,0,0,0.55), 0 0 24px ${glow}`,
      }}
    >
      <span className="mt-0.5 flex-shrink-0" style={{ color: accent }}>
        <Icon size={18} />
      </span>
      <p className="flex-1 text-sm leading-snug text-white/90">
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Fechar aviso"
        className="-mr-1 -mt-0.5 flex-shrink-0 rounded-md p-0.5 text-white/40 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   Viewport — renderize uma vez no App.tsx. Fica no rodapé centralizado,
   acima do bottom-nav no mobile, sem brigar com o FAB (canto direito).
--------------------------------------------------------------------------- */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener = (t: ToastItem[]) => setItems(t);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed z-[60] flex flex-col items-end gap-2
                    bottom-[104px] right-[84px] left-4 max-w-[calc(100vw-100px)]
                    md:bottom-[130px] md:right-[185px] md:left-auto md:max-w-xs"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
