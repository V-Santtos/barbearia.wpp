import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Event, Professional } from '../types';
import { Scissors, UserCheck, Sun, Sunset, Moon } from 'lucide-react';
import { NeonCheckbox } from './ui/NeonCheckbox';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface DayKanbanProps {
  currentDate: Date;
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event) => void;
  onCompleteEvent: (id: number) => void;
  selectedProfessionals?: Set<number>;
  onProfessionalToggle?: (id: number) => void;
}

type Period = 'morning' | 'afternoon' | 'night';

const periodConfig = {
  morning:   { label: 'Manhã', Icon: Sun,    accent: 'rgba(251,191,36,0.22)' },
  afternoon: { label: 'Tarde', Icon: Sunset, accent: 'rgba(255,255,255,0.10)' },
  night:     { label: 'Noite', Icon: Moon,   accent: 'rgba(99,102,241,0.28)' },
} as const;

const PERIOD_ORDER: Period[] = ['morning', 'afternoon', 'night'];

function currentPeriod(): Period {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'night';
}

const DayKanban: React.FC<DayKanbanProps> = ({
  currentDate,
  events,
  professionals,
  onEventClick,
  onCompleteEvent,
  selectedProfessionals,
  onProfessionalToggle,
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [completingIds, setCompletingIds] = useState<Set<number>>(() => new Set());
  const [liveMessage, setLiveMessage] = useState('');
  const [activePeriod, setActivePeriod] = useState<Period>(currentPeriod);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);

  const activePros = selectedProfessionals || new Set(professionals.map(p => p.id));

  const filteredEvents = events.filter(
    (e) =>
      activePros.has(e.professionalId) &&
      e.date === currentDate.toLocaleDateString('en-CA')
  );

  const getPeriod = (time: string): Period => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'night';
  };

  const byPeriod: Record<Period, Event[]> = {
    morning:   filteredEvents.filter((e) => getPeriod(e.startTime) === 'morning'),
    afternoon: filteredEvents.filter((e) => getPeriod(e.startTime) === 'afternoon'),
    night:     filteredEvents.filter((e) => getPeriod(e.startTime) === 'night'),
  };

  // Scroll to activePeriod on mount (mobile only)
  useEffect(() => {
    if (!isMobile || !scrollRef.current) return;
    const idx = PERIOD_ORDER.indexOf(activePeriod);
    scrollRef.current.scrollLeft = idx * scrollRef.current.clientWidth;
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToPeriod = useCallback((period: Period) => {
    if (!scrollRef.current) return;
    const idx = PERIOD_ORDER.indexOf(period);
    scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' });
    setActivePeriod(period);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || scrolling.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    const p = PERIOD_ORDER[Math.max(0, Math.min(idx, 2))];
    if (p !== activePeriod) setActivePeriod(p);
  }, [activePeriod]);

  const handleMarkAsDone = (event: Event) => {
    setCompletingIds((prev) => new Set(prev).add(event.id));
    setLiveMessage(`${event.title} marcado como feito`);
    setTimeout(() => {
      onCompleteEvent(event.id);
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      setTimeout(() => setLiveMessage(''), 1500);
    }, 220);
  };

  const renderCard = (event: Event) => {
    const professional = professionals.find(p => p.id === event.professionalId);
    const profColor = professional?.color || '#6B3EFF';
    const isCompleting = completingIds.has(event.id);
    const isPresencial = event.source === 'presencial';

    return (
      <div
        key={event.id}
        onClick={() => !isPresencial && onEventClick(event)}
        role={isPresencial ? undefined : 'button'}
        tabIndex={isPresencial ? undefined : 0}
        onKeyDown={isPresencial ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') e.preventDefault();
            onEventClick(event);
          }
        }}
        className={`rounded-xl p-3 border transition-[opacity,transform,box-shadow] duration-300
                   ease-[cubic-bezier(0.25,0.1,0.25,1)]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20
                   ${isPresencial
                     ? 'border-[#2a2a2a] cursor-default'
                     : 'bg-[#1f1f1f] border-[#2a2a2a] cursor-pointer hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
                   }
                   ${isCompleting ? 'translate-y-2 opacity-0' : 'opacity-100'}`}
        style={{
          backgroundColor: isPresencial ? `${profColor}18` : undefined,
          borderLeftColor: profColor,
          borderLeftWidth: '3px',
          borderLeftStyle: isPresencial ? 'dashed' : 'solid',
          boxShadow: `0 2px 8px ${profColor}${isPresencial ? '22' : '14'}`,
        }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-semibold leading-tight truncate"
             style={{ color: isPresencial ? profColor : '#ffffff' }}>
            {event.title}
          </p>
          {isPresencial && (
            <span className="ml-2 flex-shrink-0 rounded-md px-1.5 py-0.5
                             text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${profColor}25`, color: profColor }}>
              presencial
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-0.5 mb-2 tabular-nums">
          {event.startTime} → {event.endTime}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          {isPresencial ? (
            <UserCheck size={11} className="flex-shrink-0" style={{ color: profColor }} />
          ) : (
            <Scissors size={11} className="flex-shrink-0 text-gray-600" />
          )}
          <span className="truncate">
            {isPresencial ? professional?.name ?? 'Presencial' : event.servico}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkAsDone(event);
          }}
          disabled={isCompleting}
          className={`mt-1 w-full rounded-lg py-1.5 text-xs font-semibold text-white
                     transition-colors disabled:opacity-60
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                     ${!isPresencial ? 'bg-[#6B3EFF] hover:bg-[#825CFF]' : ''}`}
          style={isPresencial ? { backgroundColor: profColor } : undefined}
        >
          Marcar como Feito
        </button>
      </div>
    );
  };

  const renderPeriodColumn = (periodKey: Period, full?: boolean) => {
    const { label, Icon, accent } = periodConfig[periodKey];
    const periodEvents = byPeriod[periodKey];
    return (
      <div
        className={`flex flex-col min-h-0 rounded-2xl border border-[#2a2a2a] p-4 ${full ? 'h-full w-full' : 'flex-1'}`}
        style={{
          backgroundColor: '#181818',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          boxShadow: `inset 0 2px 0 ${accent}`,
        }}
      >
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-3 flex-shrink-0">
          <Icon size={12} className="opacity-60" />
          {label}
          {periodEvents.length > 0 && (
            <span className="ml-auto normal-case tracking-normal font-medium text-white/30">{periodEvents.length}</span>
          )}
        </h3>

        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5
                     [&::-webkit-scrollbar]:w-1
                     [&::-webkit-scrollbar-thumb]:rounded-full
                     [&::-webkit-scrollbar-thumb]:bg-white/10
                     [&::-webkit-scrollbar-track]:transparent"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {periodEvents.length > 0 ? (
            periodEvents.map(renderCard)
          ) : (
            <div className="flex flex-col items-center gap-2 pt-8">
              <Icon size={22} className="text-white/10" />
              <p className="text-xs text-white/25 text-center">{label} livre</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full mx-2 md:mx-0 bg-[#141314]
                 border border-[#6B3EFF]/40 rounded-[28px]
                 overflow-hidden px-5 pt-5 pb-5"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">{liveMessage}</div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-5 mb-4 flex-shrink-0">
        {professionals.map((p) => (
          <NeonCheckbox
            key={p.id}
            checked={activePros.has(p.id)}
            onChange={() => onProfessionalToggle?.(p.id)}
            color={p.color}
            size={20}
            label={
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  activePros.has(p.id) ? 'text-white/80' : 'text-white/35'
                }`}
              >
                {p.name}
              </span>
            }
          />
        ))}
      </div>

      {isMobile ? (
        <>
          {/* Tabs de período — mobile */}
          <div className="flex gap-2 mb-3 flex-shrink-0">
            {PERIOD_ORDER.map((p) => {
              const { label, Icon } = periodConfig[p];
              const isActive = activePeriod === p;
              const count = byPeriod[p].length;
              return (
                <button
                  key={p}
                  onClick={() => scrollToPeriod(p)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                    ${isActive
                      ? 'bg-[#6B3EFF]/20 text-white border border-[#6B3EFF]/40'
                      : 'bg-white/[0.04] text-white/35 border border-transparent hover:bg-white/[0.07]'
                    }`}
                >
                  <Icon size={11} />
                  {label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-[#a98bff]' : 'text-white/25'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Carrossel horizontal com snap */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {PERIOD_ORDER.map((p) => (
              <div key={p} className="flex-shrink-0 w-full snap-start h-full px-1.5">
                {renderPeriodColumn(p, true)}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Desktop — 3 colunas */
        <div className="flex flex-1 min-h-0 gap-4">
          {PERIOD_ORDER.map((p) => renderPeriodColumn(p))}
        </div>
      )}
    </div>
  );
};

export default DayKanban;
