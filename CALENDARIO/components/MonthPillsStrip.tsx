import { useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

const MONTHS_PT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

interface Props {
  currentDate: Date;
  onNavigate: (date: Date) => void;
}

export default function MonthPillsStrip({ currentDate, onNavigate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

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
    container.scrollTo({
      left: active.offsetLeft - 16,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [currentDate.getMonth(), currentDate.getFullYear(), prefersReducedMotion]);

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto gap-2 px-4 pb-1 md:hidden"
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
               razões (2026-08-04). O fundo continua vidro; só o CONTORNO do
               ativo é roxo (`accent`), a regra do site público validada em
               2026-09-15: traço roxo marca a escolha feita, preenchimento não. */
            /* O alvo de toque continua com 44 px de altura; quem encolheu foi
               só a superfície visível, dentro dele. Assim a pílula ganha um
               respiro em relação ao avatar da linha de cima sem devolver um
               alvo pequeno demais para o dedo. */
            className="flex flex-shrink-0 items-center min-h-[44px]"
          >
            <span
              className={[
                'flex items-center rounded-full px-4 h-9 text-[14px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-200',
                isActive
                  ? 'bg-white/[0.12] text-white border border-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'bg-white/[0.07] text-white/45 border border-transparent',
              ].join(' ')}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
