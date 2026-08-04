import React from 'react';
import type { CalendarDay, Event, Professional } from '../types';
import EventPopover, { type Anchor } from './EventPopover';
import DayEventsPopover, { type Anchor as DayAnchor } from './DayEventsPopover';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface CalendarGridProps {
  days: CalendarDay[];
  weekdays: string[];
  events: Event[];
  professionals: Professional[];
  onDayClick: (date: string) => void;
  onEventClick: (event: Event) => void;
  onRequestDelete: (eventId: number) => void;
  onScrollPrev?: () => void;
  onScrollNext?: () => void;
  selectedDate?: string;
}

const POPOVER_OFFSET = 12;
const EVENT_ROW_HEIGHT = 17;
const CELL_VERTICAL_PADDING = 8;
const FIRST_ROW_HEADER_HEIGHT = 34;
const DAY_HEADER_HEIGHT = 24;
const MIN_EVENT_ROWS = 4;
/** No celular, quanto a última linha da grade pesa a mais que as outras — ver o `gridTemplateRows` abaixo. */
const LAST_ROW_WEIGHT_MOBILE = 1.6;

const CalendarGrid: React.FC<CalendarGridProps> = ({
  days,
  weekdays,
  events,
  professionals,
  onDayClick,
  onEventClick,
  onRequestDelete,
  onScrollPrev,
  onScrollNext,
}) => {
  const eventsByDate = React.useMemo(() => {
    const grouped = events.reduce((acc, event) => {
      (acc[event.date] = acc[event.date] || []).push(event);
      return acc;
    }, {} as Record<string, Event[]>);

    Object.values(grouped).forEach((dayEvents) => {
      dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return grouped;
  }, [events]);

  // ✅ agora retorna um estilo inline com a cor HEX
  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith('#')
      ? color
      : '#6B3EFF'; // fallback padrão
  };

  const isMobile = useMediaQuery('(max-width: 767px)');
  const rowCount = Math.ceil(days.length / 7);

  const [open, setOpen] = React.useState<{ event: Event; anchor: Anchor } | null>(null);
  const getProfessional = (id: number) => professionals.find((p) => p.id === id);

  const [openDay, setOpenDay] = React.useState<{ dateISO: string; anchor: DayAnchor } | null>(null);
  const [gridHeight, setGridHeight] = React.useState(0);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const wheelLockRef = React.useRef(false);
  const wheelDeltaRef = React.useRef(0);

  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateGridHeight = () => setGridHeight(grid.getBoundingClientRect().height);
    updateGridHeight();

    const observer = new ResizeObserver(updateGridHeight);
    observer.observe(grid);

    return () => observer.disconnect();
  }, []);

  const handleEventClickInGrid = (e: React.MouseEvent<HTMLDivElement>, event: Event) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    };

    const gridMidX = (gridRect.left + gridRect.right) / 2;
    const openOnRight = (rect.left + rect.right) / 2 <= gridMidX;

    const anchorX = openOnRight ? rect.right + POPOVER_OFFSET : rect.left - POPOVER_OFFSET;
    const anchorY = rect.top + 24;

    setOpen({ event, anchor: { x: anchorX, y: anchorY } });
  };

  const handleMoreClick = (e: React.MouseEvent<HTMLButtonElement>, dateISO: string) => {
    e.stopPropagation();
    const cell = (e.currentTarget.closest('[data-day-cell]') as HTMLDivElement) ?? e.currentTarget;
    const rect = cell.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    };

    const gridMidX = (gridRect.left + gridRect.right) / 2;
    const openOnRight = (rect.left + rect.right) / 2 <= gridMidX;

    const anchorX = openOnRight ? rect.right + POPOVER_OFFSET : rect.left - POPOVER_OFFSET;
    const anchorY = rect.top + rect.height / 2;

    setOpenDay({ dateISO, anchor: { x: anchorX, y: anchorY } });
  };

  const handlePickEventFromDay = (ev: Event) => {
    if (!openDay) return;
    const anchor = {
      x: Math.min(Math.max(openDay.anchor.x, 24), window.innerWidth - 24),
      y: Math.min(Math.max(openDay.anchor.y, 24), window.innerHeight - 24),
    };
    setOpenDay(null);
    setOpen({ event: ev, anchor });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!onScrollPrev || !onScrollNext) return;

    event.preventDefault();
    event.stopPropagation();

    wheelDeltaRef.current += event.deltaY;
    if (wheelLockRef.current || Math.abs(wheelDeltaRef.current) < 40) return;

    const direction = wheelDeltaRef.current > 0 ? 'next' : 'prev';
    wheelDeltaRef.current = 0;
    wheelLockRef.current = true;

    if (direction === 'next') onScrollNext();
    else onScrollPrev();

    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 520);
  };

  return (
    <>
      <div
        ref={gridRef}
        onWheel={handleWheel}
        className="grid grid-cols-7 auto-rows-fr flex-1 h-full min-w-0 w-full bg-[#141314] md:rounded-[28px] overflow-hidden md:border md:border-[#6B3EFF]/45"
        style={
          // No celular a grade agora vai atrás do dock (não sobra mais pb-28
          // reservado pra ele) — esse respiro extra vira altura pra ÚLTIMA
          // linha, como no Google Calendar, em vez de esticar as seis
          // igualmente. As de cima ficam do jeito que já estavam.
          isMobile
            ? {
                gridTemplateRows: `repeat(${rowCount - 1}, minmax(0, 1fr)) minmax(0, ${LAST_ROW_WEIGHT_MOBILE}fr)`,
              }
            : undefined
        }
      >
        {days.map((day, index) => {
          const isFirstRow = index < 7;
          const isLastRow = index >= days.length - 7;
          const isFirstCol = index % 7 === 0;
          const isLastCol = (index + 1) % 7 === 0;

          const highlight = day.isToday;

          const all = eventsByDate[day.date] || [];
          // A ultima linha pesa diferente das outras no celular (mesmo
          // `gridTemplateRows` do container) -- a media simples erraria a
          // altura das duas.
          const totalWeight = isMobile
            ? rowCount - 1 + LAST_ROW_WEIGHT_MOBILE
            : rowCount;
          const rowWeight = isMobile && isLastRow ? LAST_ROW_WEIGHT_MOBILE : 1;
          const cellHeight =
            gridHeight > 0 ? (gridHeight * rowWeight) / totalWeight : 0;
          const headerHeight = isFirstRow ? FIRST_ROW_HEADER_HEIGHT : DAY_HEADER_HEIGHT;
          const eventRowsThatFit = cellHeight
            ? Math.max(
                MIN_EVENT_ROWS,
                Math.floor((cellHeight - headerHeight - CELL_VERTICAL_PADDING) / EVENT_ROW_HEIGHT)
              )
            : 3;
          const visibleCount =
            all.length > eventRowsThatFit
              ? Math.max(1, eventRowsThatFit - 1)
              : eventRowsThatFit;
          const visible = all.slice(0, visibleCount);
          const hiddenCount = Math.max(0, all.length - visible.length);
          const totalEvents = all.length;
          const isDense = totalEvents >= 5;
          const isBalanced = totalEvents === 4;
          const isComfortable = totalEvents <= 3;
          const eventCardClass = isComfortable
            ? 'h-[20px] rounded-md px-2 pl-3 text-[12px] leading-[19px]'
            : isBalanced
              ? 'h-[18px] rounded-md px-2 pl-3 text-[12px] leading-[17px]'
              : 'h-[15px] rounded px-1.5 pl-2.5 text-[11px] leading-[14px]';
          const eventTimeClass = isComfortable || isBalanced ? 'text-[11px]' : 'text-[10px]';
          const accentWidth = isComfortable || isBalanced ? 3 : 2;

          return (
            <div
              key={day.date}
              data-day-cell
              className={`relative flex flex-col items-center justify-start cursor-pointer border-white/10 transition-colors hover:bg-white/[0.03]
                ${!day.isCurrentMonth ? 'text-gray-500' : ''}
                ${isFirstRow ? 'border-t border-white/10' : ''}
                ${!isLastRow ? 'border-b border-white/10' : ''}
                ${isFirstCol ? 'border-l border-white/10' : ''}
                ${!isLastCol ? 'border-r border-white/10' : ''}
                px-2 pt-2 pb-2`}
              onClick={() => onDayClick(day.date)}
            >
              {isFirstRow && (
                <span className="text-[11px] text-gray-400 mb-[2px]">
                  {weekdays[index]}
                </span>
              )}

              <span
                className={`text-[12px] font-semibold leading-none ${
                  highlight
                    ? 'text-[#8c6dff] drop-shadow-[0_0_6px_rgba(107,62,255,0.9)]'
                    : ''
                }`}
              >
                {new Date(day.date + 'T00:00:00').getDate()}
              </span>

              <div className="mt-2 w-full space-y-0.5">
                {visible.map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => handleEventClickInGrid(e, event)}
                    className={`group relative overflow-hidden border border-white/10 bg-[#1f1f1f] font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.16)] transition hover:border-white/20 hover:bg-[#262626] ${eventCardClass}`}
                    style={{
                      boxShadow: `inset ${accentWidth}px 0 0 ${getProfessionalColor(event.professionalId)}, 0 3px 8px rgba(0,0,0,0.16)`,
                    }}
                    title={`${event.title} – ${event.startTime}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                      <span className={`shrink-0 font-bold text-white/95 ${eventTimeClass}`}>
                        {event.startTime}
                      </span>
                      <span className="min-w-0 truncate text-white/90">{event.title}</span>
                    </span>
                  </div>
                ))}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => handleMoreClick(e, day.date)}
                    className="w-auto rounded px-1 py-0 text-left text-[9px] font-medium leading-[9px] text-white/45 transition hover:bg-white/10 hover:text-white/85"
                    title={`Mostrar mais ${hiddenCount} evento(s)`}
                  >
                    +{hiddenCount}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openDay && (
        <DayEventsPopover
          dateISO={openDay.dateISO}
          events={eventsByDate[openDay.dateISO] || []}
          professionals={professionals}
          anchor={openDay.anchor}
          onPick={handlePickEventFromDay}
          onClose={() => setOpenDay(null)}
        />
      )}

      {open && (
        <EventPopover
          event={open.event}
          professional={getProfessional(open.event.professionalId)}
          anchor={open.anchor}
          onEdit={(ev) => {
            setOpen(null);
            onEventClick(ev);
          }}
          onDelete={() => {
            onRequestDelete(open.event.id);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
};

export default CalendarGrid;
