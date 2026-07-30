import { useRef, useEffect } from 'react';

const MONTHS_PT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

interface Props {
  currentDate: Date;
  onNavigate: (date: Date) => void;
}

export default function MonthPillsStrip({ currentDate, onNavigate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gera 12 meses: mês real de hoje + próximos 11 (sem meses passados)
  const realToday = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    return new Date(realToday.getFullYear(), realToday.getMonth() + i, 1);
  });

  // Rola para deixar o pill ativo na borda esquerda (não centralizado)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!active) return;
    container.scrollTo({ left: active.offsetLeft - 16, behavior: 'smooth' });
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto gap-2 px-4 pb-3 md:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {months.map((d, i) => {
        const isActive =
          d.getMonth() === currentDate.getMonth() &&
          d.getFullYear() === currentDate.getFullYear();

        const label = MONTHS_PT[d.getMonth()];

        return (
          <button
            key={i}
            data-active={isActive}
            onClick={() => onNavigate(new Date(d))}
            className={[
              'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
              isActive
                ? 'bg-[#6B3EFF] text-white shadow-lg'
                : 'bg-white/[0.07] text-white/45 hover:bg-white/[0.12] hover:text-white/70',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
