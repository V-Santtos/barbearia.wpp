import React, { useMemo } from 'react';
import type { Event, Professional } from '../types';

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event, anchor: { x: number; y: number }) => void;
  onTimeslotClick?: (date: string, time: string) => void;
}

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  professionals,
  onEventClick,
  onTimeslotClick,
}) => {
  const hours = Array.from({ length: 18 }, (_, i) => 5 + i); // 05h - 22h
  const dateISO = currentDate.toLocaleDateString('en-CA');

  const dayEvents = useMemo(() => {
    return events.filter(e => e.date === dateISO);
  }, [events, dateISO]);

  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith("#") ? color : "#6B3EFF";
  };

  const timeToPosition = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h + m / 60 - 5) * 60; // 60px por hora para o dia parecer mais espaçoso
  };

  const calcOverlap = (evs: Event[]) => {
    const sorted = [...evs].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const overlaps: any[] = [];
    sorted.forEach((event) => {
      let column = 0;
      while (
        overlaps.some(
          (o) =>
            o.column === column &&
            !(event.endTime <= o.startTime || event.startTime >= o.endTime)
        )
      ) {
        column++;
      }
      overlaps.push({ ...event, column });
    });
    return overlaps;
  };

  const positionedEvents = useMemo(() => calcOverlap(dayEvents), [dayEvents]);
  const maxColumns = Math.max(1, ...positionedEvents.map(e => e.column + 1));

  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  return (
    <div className="flex flex-col flex-1 min-h-0 mx-4 md:mx-0 bg-[#141314] border border-[#6B3EFF]/45 rounded-[28px] overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar relative px-4 py-6">
        <div className="flex relative min-h-[1080px]"> {/* 18 horas * 60px */}
          {/* Coluna de Horas */}
          <div className="w-16 shrink-0 border-r border-white/5">
            {hours.map(h => (
              <div key={h} className="h-[60px] relative">
                <span className="absolute -top-2 right-2 text-[11px] text-gray-500 font-medium">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Grid de Conteúdo */}
          <div className="flex-1 relative">
            {/* Linhas de grade */}
            {hours.map(h => (
              <div 
                key={h} 
                className="h-[60px] border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => onTimeslotClick?.(dateISO, `${String(h).padStart(2, '0')}:00`)}
              />
            ))}

            {/* Linha do Tempo Atual */}
            {isToday && currentHour >= 5 && currentHour <= 22 && (
              <div 
                className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none flex items-center"
                style={{ top: (currentHour - 5) * 60 }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
              </div>
            )}

            {/* Eventos */}
            {positionedEvents.map(event => {
              const top = timeToPosition(event.startTime);
              const end = timeToPosition(event.endTime);
              const height = Math.max(30, end - top);
              const width = `${100 / maxColumns}%`;
              const left = `${(event.column * 100) / maxColumns}%`;

              return (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event, { x: e.clientX, y: e.clientY });
                  }}
                  className="absolute flex cursor-pointer flex-col rounded-xl border border-white/10 bg-[#1f1f1f] p-2 pl-3 text-white shadow-xl transition-all hover:border-white/20 hover:bg-[#262626]"
                  style={{
                    boxShadow: `inset 3px 0 0 ${getProfessionalColor(event.professionalId)}, 0 12px 24px rgba(0,0,0,0.22)`,
                    top,
                    height,
                    left: `calc(${left} + 4px)`,
                    width: `calc(${width} - 8px)`,
                  }}
                >
                  <span className="text-xs font-bold truncate">{event.title}</span>
                  <span className="text-[10px] opacity-90">{event.startTime} - {event.endTime}</span>
                  {height > 50 && event.description && (
                     <p className="text-[10px] mt-1 line-clamp-2 opacity-80">{event.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
