import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Calendar, CalendarDays, CalendarRange, Settings, PaintBucket, Trash2 } from 'lucide-react';
import type { CalendarView, Professional } from '../types';

const COLORS = [
  '#FF2A29', '#FF5000', '#2FFF40', '#07FF99',
  '#07FFF5', '#0047FF', '#8400FF', '#FC00FF',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAddEvent: () => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  professionals: Professional[];
  selectedProfessionals: Set<number>;
  onProfessionalToggle: (id: number) => void;
  onAddProfessionalRequest: () => void;
  onDeleteProfessional: (id: number) => void;
  onChangeProfessionalColor: (id: number, color: string) => void;
  onOpenSettings: (id: number) => void;
}

const VIEW_OPTIONS = [
  { key: 'day' as CalendarView, label: 'Dia', Icon: Calendar },
  { key: 'week' as CalendarView, label: 'Semana', Icon: CalendarRange },
  { key: 'month' as CalendarView, label: 'Mês', Icon: CalendarDays },
];

export default function HamburgerPanel({
  open,
  onClose,
  onAddEvent,
  view,
  onViewChange,
  professionals,
  selectedProfessionals,
  onProfessionalToggle,
  onAddProfessionalRequest,
  onDeleteProfessional,
  onChangeProfessionalColor,
  onOpenSettings,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[60] bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.aside
            key="panel"
            className="fixed inset-y-0 left-0 z-[70] w-72 bg-[#161616] border-r border-white/[0.08] flex flex-col md:hidden"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {/* Header do painel */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-white/[0.06]">
              <span className="text-sm font-semibold text-white/80">Menu</span>
              <button
                onClick={onClose}
                className="p-2 -mr-1 rounded-full hover:bg-white/[0.08] transition-colors"
                aria-label="Fechar menu"
              >
                <X size={17} className="text-white/50" />
              </button>
            </div>

            {/* Botão Criar */}
            <div className="px-5 pt-5">
              <button
                onClick={() => { onAddEvent(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6B3EFF] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6B3EFF]/25 active:scale-[0.97] transition-transform"
              >
                <Plus size={17} strokeWidth={2.5} />
                Criar agendamento
              </button>
            </div>

            {/* Modos de visualização */}
            <div className="px-5 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">
                Visualização
              </p>
              <div className="flex flex-col gap-0.5">
                {VIEW_OPTIONS.map(({ key, label, Icon }) => {
                  const active = view === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { onViewChange(key); onClose(); }}
                      className={[
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors text-left',
                        active
                          ? 'bg-[#6B3EFF]/15 text-[#A78BFA]'
                          : 'text-white/55 hover:bg-white/[0.05] hover:text-white/80',
                      ].join(' ')}
                    >
                      <Icon
                        size={16}
                        className={active ? 'text-[#A78BFA]' : 'text-white/35'}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Profissionais */}
            <div className="px-5 pt-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                  Profissionais
                </p>
                <button
                  onClick={() => { onAddProfessionalRequest(); onClose(); }}
                  aria-label="Adicionar profissional"
                  className="rounded-xl p-1 -mr-1 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </div>

              <ul className="space-y-1">
                {professionals.map((prof) => (
                  <li key={prof.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        id={`hb-prof-${prof.id}`}
                        checked={selectedProfessionals.has(prof.id)}
                        onChange={() => onProfessionalToggle(prof.id)}
                        className="w-4 h-4 flex-shrink-0 rounded"
                        style={{ accentColor: prof.color }}
                      />
                      <label
                        htmlFor={`hb-prof-${prof.id}`}
                        className="text-sm text-gray-300 truncate cursor-pointer"
                      >
                        {prof.name}
                      </label>
                    </div>

                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === prof.id ? null : prof.id)}
                        aria-label={`Opções de ${prof.name}`}
                        className="p-1.5 rounded-xl text-white/35 hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {openMenuId === prof.id && (
                          <motion.div
                            className="absolute right-0 top-full mt-1 w-48 bg-[#2a2a2a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden"
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15 }}
                          >
                            <button
                              onClick={() => { onOpenSettings(prof.id); setOpenMenuId(null); onClose(); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left text-gray-200 hover:bg-white/10 transition-colors"
                            >
                              <Settings size={15} />
                              Configurar agenda
                            </button>
                            <button
                              onClick={() => { setShowColorPicker(prof.id); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left text-gray-200 hover:bg-white/10 transition-colors"
                            >
                              <PaintBucket size={15} />
                              Alterar cor
                            </button>
                            <button
                              onClick={() => { onDeleteProfessional(prof.id); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={15} />
                              Excluir profissional
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Color Picker (portal dentro do painel) */}
            {showColorPicker !== null && (
              <div
                className="fixed inset-0 z-[80] bg-black/20 flex items-center justify-center"
                onClick={() => setShowColorPicker(null)}
              >
                <div
                  className="rounded-2xl bg-[#28292d] p-4 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => { onChangeProfessionalColor(showColorPicker, color); setShowColorPicker(null); }}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
