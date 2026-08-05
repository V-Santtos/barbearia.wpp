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
            /* Mês ativo era roxo SÓLIDO -- o único roxo chapado que sobrava
               numa fileira de pílulas, e a mesma peça que Manhã/Tarde/Noite
               é logo abaixo. Mesmo idioma de vidro do dock, pelas mesmas
               razões (2026-08-04). */
            className={[
              'flex-shrink-0 rounded-full px-4 py-2.5 min-h-[44px] text-[14px] font-semibold transition-all duration-200',
              isActive
                ? 'bg-white/[0.12] text-white border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                : 'bg-white/[0.07] text-white/45 border border-transparent',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
