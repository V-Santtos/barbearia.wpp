import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Menu, Search } from 'lucide-react';
import type { CalendarView, Professional } from '../types';
import type { OwnerSession } from './LoginScreen';
import UserMenu from './UserMenu';
import { Button } from './ui/Button';
import MonthPillsStrip from './MonthPillsStrip';

interface Props {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  view: CalendarView;
  viewMode?: 'timeline' | 'kanban';
  onViewChange: (view: CalendarView) => void;
  onToggleKanban?: () => void;
  owner: OwnerSession;
  onLogout: () => void;
  professionals: Professional[];
  presencialIds: Map<number, number>;
  onMenuOpen?: () => void;
  onNavigateToDate?: (date: Date) => void;
  onOpenDashboard?: () => void;
}

type HeaderView = 'day' | 'kanban' | 'week' | 'month';

const CalendarHeader: React.FC<Props> = ({
  currentDate,
  onPrev,
  onNext,
  onToday,
  view,
  viewMode = 'timeline',
  onViewChange,
  onToggleKanban,
  owner,
  onLogout,
  professionals,
  presencialIds,
  onMenuOpen,
  onNavigateToDate,
  onOpenDashboard,
}) => {
  const getTitle = () => {
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();

    if (view === 'month') return `${monthName} ${year}`;

    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startMonth = start.toLocaleString('pt-BR', { month: 'short' });
      const endMonth = end.toLocaleString('pt-BR', { month: 'short' });
      if (start.getFullYear() !== end.getFullYear()) {
        return `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      }
      if (startMonth !== endMonth) {
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
      }
      return `${monthName} ${start.getDate()} - ${end.getDate()}, ${year}`;
    }

    return currentDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const today = new Date();
  const isTodayActive =
    currentDate.getDate() === today.getDate() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear();

  const activeView: HeaderView = view === 'day' && viewMode === 'kanban' ? 'kanban' : view;
  const showKanbanOption = view === 'day';

  const handleNavClick = (key: HeaderView) => {
    if (key === 'kanban') {
      onViewChange('day');
      if (viewMode !== 'kanban') onToggleKanban?.();
      return;
    }
    if (key === 'day') {
      onViewChange('day');
      if (viewMode !== 'timeline') onToggleKanban?.();
      return;
    }
    onViewChange(key);
  };

  const fixedOptions: Array<{ key: HeaderView; label: string }> = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
  ];

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const mobileTitle = (() => {
    const day = currentDate.getDate();
    if (view === 'day') {
      const weekday = currentDate.toLocaleString('pt-BR', { weekday: 'long' });
      return `${capitalize(weekday)}, ${day}`;
    }
    const month = currentDate.toLocaleString('pt-BR', { month: 'long' });
    if (view === 'month') return `${capitalize(month)}, ${day}`;
    return capitalize(month);
  })();

  return (
    <header className="relative z-20 bg-background">

      {/* ── MOBILE LAYOUT ── */}
      <div
        className="md:hidden flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(44px, env(safe-area-inset-top))' }}
      >
        {/* Esquerda: hambúrguer + mês atual */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onMenuOpen}
            className="p-2.5 -ml-1.5 rounded-xl hover:bg-white/[0.08] transition-colors flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu size={24} className="text-white/80" />
          </button>
          {/* A data é o TÍTULO DESTA TELA e estava em 15px -- o mesmo corpo de
              um item da gaveta, e 7px menor que o título de Conversas. Era a
              única das três abas sem título no tamanho de título. 22px é o
              padrão da casa, herdado de Conversas. */}
          <button
            onClick={onToday}
            aria-current={isTodayActive ? 'date' : undefined}
            className="text-[22px] font-bold capitalize leading-tight tracking-[-0.01em] text-white hover:text-white transition-colors truncate"
          >
            {mobileTitle}
          </button>
        </div>

        {/* Direita: lupa + avatar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-2 rounded-xl hover:bg-white/[0.08] transition-colors"
            aria-label="Pesquisar"
          >
            <Search size={20} className="text-white/55" />
          </button>
          <UserMenu owner={owner} onLogout={onLogout} professionals={professionals} onOpenDashboard={onOpenDashboard} />
        </div>
      </div>

      {/* Badge "Em atendimento" — mobile only */}
      <AnimatePresence>
        {presencialIds.size > 0 && (
          <motion.div
            className="md:hidden flex flex-wrap gap-2 px-4 pb-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {Array.from(presencialIds.keys()).map((profId) => {
              const prof = professionals.find((p) => p.id === profId);
              if (!prof) return null;
              const firstName = prof.name.trim().split(' ')[0];
              return (
                <motion.div
                  key={profId}
                  className="flex items-center gap-2 rounded-full px-3 py-[5px]"
                  style={{
                    background: `${prof.color}08`,
                    border: `1px solid ${prof.color}70`,
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 0 2px ${prof.color}12, 0 0 8px ${prof.color}38`,
                      `0 0 0 2px ${prof.color}28, 0 0 18px ${prof.color}60`,
                      `0 0 0 2px ${prof.color}12, 0 0 8px ${prof.color}38`,
                    ],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="relative flex h-[6px] w-[6px] flex-shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full"
                      style={{ backgroundColor: prof.color, opacity: 0.65 }}
                    />
                    <span
                      className="relative inline-flex h-[6px] w-[6px] rounded-full"
                      style={{ backgroundColor: prof.color }}
                    />
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.04em]" style={{ color: prof.color }}>
                    {firstName}
                  </span>
                  <span className="text-[11px] font-medium tracking-[0.04em] text-white/55">
                    · Em atendimento
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Faixa de pills de meses (mobile only) — oculta na view Dia */}
      {onNavigateToDate && view !== 'day' && (
        <MonthPillsStrip currentDate={currentDate} onNavigate={onNavigateToDate} />
      )}

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex items-center justify-between px-6 pt-11 pb-4 md:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onToday}
            type="button"
            aria-current={isTodayActive ? 'date' : undefined}
            className={[
              'text-[13px] font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isTodayActive ? 'text-white' : 'text-white/55 hover:text-white',
            ].join(' ')}
          >
            Hoje
          </button>

          <div className="flex items-center">
            <Button onClick={onPrev} variant="ghost" size="icon" aria-label="Anterior" className="size-7">
              <ChevronLeft size={15} />
            </Button>
            <Button onClick={onNext} variant="ghost" size="icon" aria-label="Próximo" className="size-7">
              <ChevronRight size={15} />
            </Button>
          </div>

          <h2 className="text-2xl font-semibold capitalize tracking-[-0.01em] text-white">
            {getTitle()}
          </h2>

          <AnimatePresence>
            {Array.from(presencialIds.keys()).map((profId) => {
              const prof = professionals.find((p) => p.id === profId);
              if (!prof) return null;
              const firstName = prof.name.trim().split(' ')[0];
              return (
                <motion.div
                  key={profId}
                  className="ml-10"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.div
                    className="flex items-center gap-2 rounded-full px-4 py-[6px]"
                    style={{
                      background: `${prof.color}08`,
                      border: `1px solid ${prof.color}70`,
                    }}
                    animate={{
                      boxShadow: [
                        `0 0 0 3px ${prof.color}12, 0 0 10px ${prof.color}38, 0 0 24px ${prof.color}15`,
                        `0 0 0 3px ${prof.color}28, 0 0 22px ${prof.color}68, 0 0 46px ${prof.color}30`,
                        `0 0 0 3px ${prof.color}12, 0 0 10px ${prof.color}38, 0 0 24px ${prof.color}15`,
                      ],
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="relative flex h-[7px] w-[7px] flex-shrink-0">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full"
                        style={{ backgroundColor: prof.color, opacity: 0.65 }}
                      />
                      <span
                        className="relative inline-flex h-[7px] w-[7px] rounded-full"
                        style={{ backgroundColor: prof.color }}
                      />
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.04em]" style={{ color: prof.color }}>
                      {firstName}
                    </span>
                    <span className="text-[11px] font-medium tracking-[0.04em] text-white/55">
                      · Em atendimento
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {showKanbanOption && (
                <motion.div
                  key="kanban-group"
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <button
                    type="button"
                    onClick={() => handleNavClick('kanban')}
                    className={[
                      'relative pb-[5px]',
                      'text-[13px] transition-colors duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                      activeView === 'kanban' ? 'font-semibold text-white' : 'font-medium text-white/45 hover:text-white/75',
                    ].join(' ')}
                  >
                    Kanban
                    {activeView === 'kanban' && (
                      <motion.div
                        layoutId="view-indicator"
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                        style={{
                          background: '#6B3EFF',
                          boxShadow: '0 0 6px rgba(107,62,255,0.9), 0 0 14px rgba(107,62,255,0.5)',
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                  </button>
                  <div className="h-3.5 w-px bg-white/[0.12]" />
                </motion.div>
              )}
            </AnimatePresence>

            {fixedOptions.map((option, index) => (
              <React.Fragment key={option.key}>
                {index > 0 && <div className="h-3.5 w-px bg-white/[0.12]" />}
                <button
                  type="button"
                  onClick={() => handleNavClick(option.key)}
                  className={[
                    'relative pb-[5px]',
                    'text-[13px] transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                    activeView === option.key ? 'font-semibold text-white' : 'font-medium text-white/45 hover:text-white/75',
                  ].join(' ')}
                >
                  {option.label}
                  {activeView === option.key && (
                    <motion.div
                      layoutId="view-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                      style={{
                        background: '#6B3EFF',
                        boxShadow: '0 0 6px rgba(107,62,255,0.9), 0 0 14px rgba(107,62,255,0.5)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>

          <UserMenu owner={owner} onLogout={onLogout} professionals={professionals} onOpenDashboard={onOpenDashboard} />
        </div>
      </div>
    </header>
  );
};

export default CalendarHeader;
