import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { Professional } from "../types";
import { getBlockedDays, saveBlockedPeriods, type BlockPeriod } from "../services/calendarApi";
import { ProfileBlockedPeriodsSkeleton } from "./ui/Skeleton";

type Props = {
  open: boolean;
  onClose: () => void;
  professionals: Professional[];
  onSave: (payload: {
    display_name: string;
    avatar_data_url: string | null;
    block_date: string;
    blocked_periods_by_professional: Record<number, BlockPeriod[]>;
  }) => void;
  initial?: { display_name?: string; avatar_url?: string };
};

const PERIODS: { key: BlockPeriod; label: string }[] = [
  { key: "morning", label: "Manha" },
  { key: "afternoon", label: "Tarde" },
  { key: "night", label: "Noite" },
];

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const todayKey = () => new Date().toLocaleDateString("en-CA");

const emptyBlocksFor = (professionals: Professional[]) =>
  professionals.reduce<Record<number, Record<BlockPeriod, boolean>>>((acc, pro) => {
    acc[Number(pro.id)] = { morning: false, afternoon: false, night: false };
    return acc;
  }, {});

export default function ProfileModal({
  open,
  onClose,
  onSave,
  professionals,
  initial,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [displayName, setDisplayName] = useState<string>(initial?.display_name ?? "");
  const [avatar1x, setAvatar1x] = useState<string>("");
  const [avatar2x, setAvatar2x] = useState<string>("");
  const [avatarRaw, setAvatarRaw] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blockDate, setBlockDate] = useState(todayKey);
  const [blocksByProfessional, setBlocksByProfessional] = useState(emptyBlocksFor(professionals));
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = window.setTimeout(() => {
      const firstFocusable = modalContentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SEL);
      firstFocusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setDisplayName(initial?.display_name ?? "");
    setAvatar1x(initial?.avatar_url ?? "");
    setAvatar2x("");
    setAvatarRaw("");
    const date = todayKey();
    setBlockDate(date);
    setBlocksByProfessional(emptyBlocksFor(professionals));
    setFeedback(null);
    setMenuOpen(false);
    return () => { document.body.style.overflow = prev; };
  }, [open, professionals, initial?.display_name, initial?.avatar_url]);

  useEffect(() => {
    if (!open || professionals.length === 0 || !blockDate) return;
    let cancelled = false;

    setLoadingBlocks(true);
    setFeedback(null);
    Promise.all(
      professionals.map(async (pro) => {
        const blocked = await getBlockedDays(Number(pro.id), blockDate);
        return {
          professionalId: Number(pro.id),
          periods: blocked.find((item) => item.data === blockDate)?.periodos,
        };
      }),
    )
      .then((items) => {
        if (cancelled) return;
        const next = emptyBlocksFor(professionals);
        items.forEach(({ professionalId, periods }) => {
          if (!next[professionalId]) return;
          const selected = periods === null ? PERIODS.map((period) => period.key) : periods ?? [];
          selected.forEach((period) => {
            if (period === "morning" || period === "afternoon" || period === "night") {
              next[professionalId][period] = true;
            }
          });
        });
        setBlocksByProfessional(next);
      })
      .catch(() => setFeedback("Erro ao carregar bloqueios."))
      .finally(() => {
        if (!cancelled) setLoadingBlocks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, professionals, blockDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") previewOpen ? setPreviewOpen(false) : onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, previewOpen, onClose]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || pencilRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  if (!open) return null;

  const toggleBlock = (professionalId: number, period: BlockPeriod) => {
    setBlocksByProfessional((state) => ({
      ...state,
      [professionalId]: {
        ...(state[professionalId] ?? { morning: false, afternoon: false, night: false }),
        [period]: !(state[professionalId]?.[period] ?? false),
      },
    }));
  };

  const handleSave = async () => {
    const blocked_periods_by_professional = Object.fromEntries(
      Object.entries(blocksByProfessional).map(([professionalId, periods]) => [
        Number(professionalId),
        (Object.entries(periods) as [BlockPeriod, boolean][])
          .filter(([, selected]) => selected)
          .map(([period]) => period),
      ]),
    ) as Record<number, BlockPeriod[]>;

    setSaving(true);
    setFeedback(null);
    try {
      await Promise.all(
        Object.entries(blocked_periods_by_professional).map(([professionalId, periods]) =>
          saveBlockedPeriods(Number(professionalId), blockDate, periods),
        ),
      );

      onSave({
        display_name: displayName.trim(),
        avatar_data_url: avatar2x || avatar1x || null,
        block_date: blockDate,
        blocked_periods_by_professional,
      });
      onClose();
    } catch {
      setFeedback("Erro ao salvar bloqueios.");
    } finally {
      setSaving(false);
    }
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("Erro ao ler arquivo"));
      fr.onload = () => res(String(fr.result));
      fr.readAsDataURL(file);
    });

  const squareDataUrl = async (dataUrl: string, size: number): Promise<string> => {
    const img = new Image();
    img.decoding = "sync";
    img.loading = "eager";
    img.src = dataUrl;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = Math.floor((img.naturalWidth - side) / 2);
    const sy = Math.floor((img.naturalHeight - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const onFile = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) return alert("Arquivo maior que 10 MB.");
    try {
      const raw = await readFileAsDataURL(f);
      const d1 = await squareDataUrl(raw, 256);
      const d2 = await squareDataUrl(raw, 512);
      setAvatarRaw(raw);
      setAvatar1x(d1);
      setAvatar2x(d2);
      setMenuOpen(false);
    } catch {
      alert("Não foi possível processar a imagem.");
    }
  };

  const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='45' r='22' fill='%23555'/><path d='M20 100a40 26 0 0 1 80 0' fill='%23555'/></svg>`;
  const hasPhoto = Boolean(avatar1x || avatar2x);
  const imgSrc = hasPhoto ? avatar1x : placeholderSvg;
  const imgSrcSet = hasPhoto && avatar2x ? `${avatar1x} 1x, ${avatar2x} 2x` : undefined;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <motion.div
        ref={modalContentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: "easeOut" }}
        className="relative w-[min(420px,92vw)] rounded-2xl border border-white/[0.08]
                   bg-[#1a1a1a] shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key !== 'Tab') return;
          const focusable = Array.from(modalContentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SEL) ?? []);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
          } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}
      >
        <h2 id="profile-modal-title" className="sr-only">Editar Perfil</h2>

        {/* Close */}
        <button
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X size={15} />
        </button>

        <div className="px-6 pt-6 pb-6 flex flex-col gap-5">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              className="h-24 w-24 overflow-hidden rounded-full ring-2 ring-[#6B3EFF]/55 bg-[#111]
                         shadow-[0_0_0_4px_rgba(107,62,255,0.08)] transition hover:ring-[#6B3EFF]/70 hover:shadow-[0_0_20px_rgba(107,62,255,0.18)]"
              onClick={() => { if (hasPhoto) setPreviewOpen(true); }}
            >
              <img
                alt="Foto do perfil"
                className="h-full w-full select-none object-cover"
                src={imgSrc}
                srcSet={imgSrcSet}
                width={96}
                height={96}
              />
            </button>

          </div>

          {/* Bloqueio de períodos */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden">
            <div className="h-px bg-[#6B3EFF]/35" />
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0 text-white/35 fill-current">
                  <path d="M12 1a5 5 0 00-5 5v2H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 7V6a3 3 0 016 0v2H9zm3 5a1.5 1.5 0 11.001 3.001A1.5 1.5 0 0112 13z"/>
                </svg>
                <span className="text-[12px] font-semibold text-white/50 tracking-tight">
                  Bloqueio de agendamentos por período
                </span>
              </div>

              <div className="mb-3 rounded-xl border border-white/[0.08] bg-[#151515] px-3 py-2">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  Hoje
                </span>
                <span className="text-[13px] font-medium text-white/75">
                  {new Date(`${blockDate}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="max-h-[230px] space-y-3 overflow-y-auto pr-1">
                {loadingBlocks ? (
                  <ProfileBlockedPeriodsSkeleton count={professionals.length || 2} />
                ) : professionals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-5 text-center text-[12px] text-white/35">
                    Nenhum profissional carregado.
                  </div>
                ) : (
                  professionals.map((pro) => {
                    const professionalId = Number(pro.id);
                    const blocks = blocksByProfessional[professionalId] ?? {
                      morning: false,
                      afternoon: false,
                      night: false,
                    };

                    return (
                      <div
                        key={professionalId}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: pro.color || "#6B3EFF" }}
                          />
                          <span className="min-w-0 truncate text-[13px] font-semibold text-white/85">
                            {pro.name}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {PERIODS.map((period) => {
                            return (
                              <button
                                key={period.key}
                                onClick={() => {
                                  toggleBlock(professionalId, period.key);
                                }}
                                disabled={saving}
                                aria-pressed={blocks[period.key] ?? false}
                                className={`rounded-xl border py-2.5 text-[13px] font-semibold transition-colors
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/50
                                  ${blocks[period.key]
                                      ? "border-red-400/50 bg-red-500/10 text-red-300"
                                      : "border-white/[0.08] bg-[#1a1a1a] text-white/50 hover:border-[#6B3EFF]/60 hover:text-white/80"}`}
                              >
                                {period.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          {feedback && (
            <p aria-live="polite" className="text-center text-[12px] font-medium text-red-300">
              {feedback}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/[0.08] bg-[#111]
                         py-2.5 text-[14px] font-semibold text-white/50
                         hover:bg-white/5 hover:text-white/80 transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingBlocks}
              className="flex-1 rounded-xl bg-[#6B3EFF] py-2.5 text-[14px] font-semibold text-white
                         hover:brightness-110 transition-all shadow-[0_4px_16px_rgba(107,62,255,0.35)]
                         disabled:cursor-not-allowed disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* Lightbox */}
        {previewOpen && (
          <div
            onClick={() => setPreviewOpen(false)}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90"
          >
            <button
              onClick={() => setPreviewOpen(false)}
              aria-label="Fechar preview"
              className="fixed right-8 top-8 z-[100001] h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm
                         flex items-center justify-center text-white hover:bg-black/80 transition"
            >
              <X size={18} />
            </button>
            <img
              src={avatarRaw || avatar2x || avatar1x}
              alt="Foto do perfil"
              className="max-w-[96vw] max-h-[95vh] object-contain select-none rounded-2xl"
            />
          </div>
        )}
      </motion.div>
    </div>
  );

  return createPortal(modal, document.body);
}
