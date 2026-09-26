import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { Professional } from "../types";
import { getBlockedDays, saveBlockedPeriods, type BlockPeriod } from "../services/calendarApi";
import { ProfileBlockedPeriodsSkeleton } from "./ui/Skeleton";
import MarcaHubBarber from "./shell/MarcaHubBarber";
import { useMediaQuery } from "../hooks/useMediaQuery";

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
  { key: "morning", label: "Manhã" },
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
  const isMobile = useMediaQuery("(max-width: 767px)");

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

  const hasPhoto = Boolean(avatar1x || avatar2x);
  const imgSrcSet = hasPhoto && avatar2x ? `${avatar1x} 1x, ${avatar2x} 2x` : undefined;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex h-dvh items-stretch justify-center overflow-hidden bg-black/70 md:h-auto md:items-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <motion.div
        ref={modalContentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        initial={
          prefersReducedMotion
            ? { opacity: 0 }
            : isMobile
              ? { opacity: 0, y: 24 }
              : { opacity: 0, scale: 0.96, y: 8 }
        }
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : isMobile
              ? { opacity: 0, y: 16 }
              : { opacity: 0, scale: 0.96, y: 8 }
        }
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: "easeOut" }}
        className="relative flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden
                   rounded-none border-0 bg-[#191919] shadow-[0_24px_64px_rgba(0,0,0,0.46)]
                   md:mx-4 md:h-auto md:max-h-[88vh] md:max-w-lg md:rounded-[16px]
                   md:border md:border-white/[0.09]"
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
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-lg text-white/45 transition-colors
                     hover:bg-white/[0.06] hover:text-white focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent-400/70 md:top-4"
        >
          <X size={15} />
        </button>

        <div
          className="min-h-0 flex-1 overflow-y-auto
                     [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent
                     [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.14]
                     hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.24]"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.14) transparent",
          }}
        >
          {/* `min-h-full` no celular: o miolo ocupa a folha inteira e a lista
              distribui as linhas no espaço que sobra. Sem isso o conteúdo
              terminava no meio da tela e deixava um vazio grande até as ações
              ancoradas embaixo. */}
          <div className="flex flex-col gap-6 px-5 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] md:gap-4 md:pt-6 min-h-full md:min-h-0">

          {/* Avatar. No celular este bloco absorve parte da sobra vertical —
              até um teto — para o topo respirar em vez de a folha inteira
              terminar num vão antes das ações. */}
          <div
            className={`flex flex-col items-center gap-3 ${
              isMobile ? "min-h-[104px] max-h-[152px] flex-1 justify-center" : ""
            }`}
          >
            <button
              aria-label={hasPhoto ? "Visualizar foto do perfil" : "Foto do perfil"}
              disabled={!hasPhoto}
              /* No celular a foto é identificação, não capa: 56 px e sem o anel
                 roxo, que ali virava a peça mais pesada da tela inteira. No
                 desktop a geometria aprovada em 2026-09-09 continua. */
              className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full
                         border border-white/12 bg-primary text-primary-foreground transition
                         h-[88px] w-[88px] md:h-20 md:w-20 md:shadow-[0_0_0_3px_rgba(86,80,249,0.18)]
                         hover:border-accent-400/70 hover:brightness-110
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919]
                         disabled:cursor-default disabled:hover:border-white/12 disabled:hover:brightness-100"
              onClick={() => { if (hasPhoto) setPreviewOpen(true); }}
            >
              {hasPhoto ? (
                <img
                  alt="Foto do perfil"
                  className="h-full w-full select-none object-cover"
                  src={avatar1x}
                  srcSet={imgSrcSet}
                  width={80}
                  height={80}
                />
              ) : (
                <MarcaHubBarber className="h-1/2 w-1/2" />
              )}
            </button>

          </div>

          {/* Bloqueio de períodos.

              No celular esta parte deixou de ser cartão dentro de cartão dentro
              de cartão: título como rótulo de seção, data numa linha e um
              profissional por linha, separados por filete — a lista de ajustes
              de aparelho, não um formulário de desktop esticado. No desktop a
              moldura de 2026-09-09 continua intacta. */}
          <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : "overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#111]"}>
            <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : "px-4 py-4"}>
              <div className={`flex items-center gap-2 ${isMobile ? "mb-2" : "mb-3"}`}>
                {!isMobile && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0 text-white/35 fill-current">
                    <path d="M12 1a5 5 0 00-5 5v2H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 7V6a3 3 0 016 0v2H9zm3 5a1.5 1.5 0 11.001 3.001A1.5 1.5 0 0112 13z"/>
                  </svg>
                )}
                <span
                  className={
                    isMobile
                      ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35"
                      : "text-[12px] font-semibold text-white/50 tracking-tight"
                  }
                >
                  {isMobile ? "Bloqueio por período" : "Bloqueio de agendamentos por período"}
                </span>
              </div>

              {isMobile && (
                <p className="mb-4 text-[12px] leading-relaxed text-pretty text-white/40">
                  Os períodos marcados ficam indisponíveis nesta data.
                </p>
              )}

              <div
                className={
                  isMobile
                    ? "flex items-baseline justify-between border-y border-white/[0.07] py-3.5"
                    : "mb-3 rounded-lg border border-white/[0.08] bg-[#1c1c1c] px-3 py-2"
                }
              >
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

              <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : "space-y-2"}>
                {loadingBlocks ? (
                  <ProfileBlockedPeriodsSkeleton count={professionals.length || 2} />
                ) : professionals.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-5 text-center text-[12px] text-white/35">
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
                        className={
                          isMobile
                            ? "flex flex-1 flex-col justify-center border-b border-white/[0.07] py-3.5 max-h-[136px]"
                            : "rounded-[10px] border border-white/[0.08] bg-white/[0.025] p-3"
                        }
                      >
                        <div className={`flex items-center gap-2 ${isMobile ? "mb-3" : "mb-2"}`}>
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: pro.color || "#5650f9" }}
                          />
                          <span className="min-w-0 truncate text-[13px] font-semibold text-white/85">
                            {pro.name}
                          </span>
                        </div>

                        {/* No celular os três períodos viraram um controle
                            segmentado: uma superfície, três divisões. Eram três
                            botões contornados, com peso de ação principal cada
                            um, para uma escolha que é só ligar/desligar. */}
                        <div
                          className={
                            isMobile
                              ? "grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1"
                              : "grid grid-cols-3 gap-2"
                          }
                        >
                          {PERIODS.map((period) => {
                            return (
                              <button
                                key={period.key}
                                onClick={() => {
                                  toggleBlock(professionalId, period.key);
                                }}
                                disabled={saving}
                                aria-pressed={blocks[period.key] ?? false}
                                className={`${isMobile ? "min-h-[52px]" : "min-h-11"} text-[13px] font-semibold transition-colors
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                                  ${isMobile ? "rounded-lg px-2 py-2" : "rounded-lg border px-2 py-2.5"}
                                  ${blocks[period.key]
                                      ? isMobile
                                        ? "bg-red-500/15 text-red-300"
                                        : "border-red-400/50 bg-red-500/10 text-red-300"
                                      : isMobile
                                        ? "text-white/45 hover:text-white/80"
                                        : "border-white/[0.08] bg-[#1a1a1a] text-white/50 hover:border-accent/60 hover:text-white/80"}`}
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

          </div>
        </div>

        {/* Footer */}
        <div className="flex min-h-14 items-center justify-between gap-3 border-t border-white/[0.07]
                        px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 md:py-3">
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`text-xs font-medium text-red-300 ${feedback ? "" : "opacity-0"}`}
          >
            {feedback ?? "."}
          </span>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={onClose}
              className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-white/55 transition-colors
                         hover:bg-white/[0.05] hover:text-white/80
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 md:min-h-0"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingBlocks}
              className="min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white
                         transition-colors hover:bg-accent-hover
                         disabled:cursor-not-allowed disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919] md:min-h-0"
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
