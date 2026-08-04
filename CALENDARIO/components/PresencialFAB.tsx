import { useState, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import tesouraUrl from '../assets/Ativo 4.svg';
import type { Professional } from '../types';

const BLOB_STYLE = {
  '--border-radius': '115% 140% 145% 110% / 125% 140% 110% 125%',
  '--border-width': '10px',
  aspectRatio: '1',
  display: 'block',
  gridArea: 'stack',
  backgroundSize: 'calc(100% + var(--border-width) * 2)',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  border: 'var(--border-width) solid transparent',
  borderRadius: 'var(--border-radius)',
  maskImage: 'linear-gradient(transparent, transparent), linear-gradient(black, white)',
  maskClip: 'padding-box, border-box',
  maskComposite: 'intersect',
  mixBlendMode: 'screen',
  height: '97px',
  filter: 'blur(2px)',
} as CSSProperties;

const BLOBS_INACTIVE = [
  { backgroundColor: '#4C1D95', backgroundImage: 'linear-gradient(#4C1D95,#7C3AED,#4C1D95)', transform: 'rotate(30deg) scale(1.03)' },
  { backgroundColor: '#FFFFFF', backgroundImage: 'linear-gradient(#FFFFFF,#DDD6FE,#FFFFFF)', transform: 'rotate(60deg) scale(0.95)' },
  { backgroundColor: '#6B3EFF', backgroundImage: 'linear-gradient(#6B3EFF,#A78BFA,#6B3EFF)', transform: 'rotate(90deg) scale(0.97)' },
  { backgroundColor: '#7C3AED', backgroundImage: 'linear-gradient(#7C3AED,#DDD6FE,#7C3AED)', transform: 'rotate(120deg) scale(1.02)' },
];

function getBlobsForColor(color: string) {
  return [
    { backgroundColor: color, backgroundImage: `linear-gradient(${color},${color}bb,${color})`, transform: 'rotate(30deg) scale(1.03)' },
    { backgroundColor: '#FFFFFF', backgroundImage: `linear-gradient(#FFFFFF,${color}99,#FFFFFF)`, transform: 'rotate(60deg) scale(0.95)' },
    { backgroundColor: color, backgroundImage: `linear-gradient(${color},${color}dd,${color})`, transform: 'rotate(90deg) scale(0.97)' },
    { backgroundColor: color, backgroundImage: `linear-gradient(${color}aa,${color},${color}aa)`, transform: 'rotate(120deg) scale(1.02)' },
  ];
}

interface PresencialFABProps {
  professionals: Professional[];
  presencialIds: Map<number, number>;
  onActivate: (professional: Professional) => Promise<void>;
  onDeactivate: (professionalId: number) => Promise<void>;
  isLoading: boolean;
  visible?: boolean;
}

type FabVariant = 'desktop' | 'mobile';

export default function PresencialFAB({
  professionals,
  presencialIds,
  onActivate,
  onDeactivate,
  isLoading,
  visible = true,
}: PresencialFABProps) {
  const [open, setOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  const hasActive = presencialIds.size > 0;
  const activeProf = professionals.find((p) => presencialIds.has(p.id));
  const activeBlobs = hasActive && activeProf ? getBlobsForColor(activeProf.color) : BLOBS_INACTIVE;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!desktopRef.current?.contains(target) && !mobileRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleProfessionalClick = async (prof: Professional) => {
    setOpen(false);
    if (presencialIds.has(prof.id)) {
      await onDeactivate(prof.id);
    } else {
      await onActivate(prof);
    }
  };

  const renderMenu = (variant: FabVariant) => (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={
            variant === 'desktop'
              ? 'flex flex-col items-end gap-2'
              : 'absolute bottom-[78px] right-0 flex max-h-[min(56vh,calc(100vh-144px))] flex-col items-end gap-2 overflow-y-auto pr-1 custom-scrollbar'
          }
        >
          {professionals.map((prof, i) => {
            const isActive = presencialIds.has(prof.id);
            return (
              <motion.button
                key={prof.id}
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.92 }}
                transition={{ delay: (professionals.length - 1 - i) * 0.06, duration: 0.2, ease: 'easeOut' }}
                onClick={() => handleProfessionalClick(prof)}
                className="flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold
                           shadow-lg backdrop-blur-sm transition-all hover:scale-[1.03] active:scale-[0.97]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                style={{
                  backgroundColor: isActive ? `${prof.color}22` : '#1f1f1f',
                  borderColor: isActive ? prof.color : '#2f2f2f',
                  color: isActive ? prof.color : '#e5e5e5',
                  boxShadow: isActive ? `0 4px 20px ${prof.color}30` : '0 4px 16px rgba(0,0,0,0.4)',
                }}
                aria-label={isActive ? `Cancelar presencial de ${prof.name}` : `Registrar presencial de ${prof.name}`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
                <span>{prof.name}</span>
                {isActive && <X size={13} className="ml-1 flex-shrink-0" />}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderButton = (variant: FabVariant) => {
    const isDesktop = variant === 'desktop';
    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        layout
        onClick={() => !isLoading && setOpen((o) => !o)}
        aria-label={open ? 'Fechar menu presencial' : 'Registrar atendimento presencial'}
        aria-expanded={open}
        className={[
          'relative flex items-center justify-center rounded-full shadow-xl',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
          isDesktop ? 'h-[65px] w-[65px]' : 'h-[52px] w-[52px]',
        ].join(' ')}
        style={{ backgroundColor: 'transparent' }}
      >
        {!open && (
          <div
            className="absolute pointer-events-none animate-blob-cw"
            style={{
              inset: isDesktop ? '-16px' : '-11px',
              width: isDesktop ? 97 : 74,
              height: isDesktop ? 97 : 74,
              display: 'grid',
              gridTemplateAreas: "'stack'",
            }}
          >
            {activeBlobs.map((blob, i) => (
              <span key={i} style={{ ...BLOB_STYLE, ...blob, height: isDesktop ? 97 : 74 }} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 size={20} className="text-white animate-spin" />
            </motion.span>
          ) : open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X size={22} className="text-white" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
            >
              <img
                src={tesouraUrl}
                width={isDesktop ? 37 : 30}
                height={isDesktop ? 37 : 30}
                alt="tesoura"
                style={{ mixBlendMode: 'screen', filter: 'invert(1) drop-shadow(0 0 6px rgba(255,255,255,0.8))', transform: 'rotate(40deg)' }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  return (
    <>
      <motion.div
        ref={desktopRef}
        className="fixed bottom-[124px] right-[100px] z-50 hidden flex-col items-end gap-3 md:flex"
        animate={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {renderMenu('desktop')}
        {renderButton('desktop')}
      </motion.div>

      <motion.div
        ref={mobileRef}
        className="fixed bottom-[128px] right-8 z-50 flex flex-col items-end gap-3 md:hidden"
        animate={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        {renderMenu('mobile')}
        {renderButton('mobile')}
      </motion.div>
    </>
  );
}
