import React from 'react';
import type { CalendarDay, Event, Professional } from '../types';
import EventPopover, { type Anchor } from './EventPopover';
import DayEventsPopover, { type Anchor as DayAnchor } from './DayEventsPopover';
import TarjaDeEvento from './agenda/TarjaDeEvento';
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

/* As alturas abaixo sao a UNICA fonte da verdade: a conta de quantas tarjas
   cabem le estes numeros, e o desenho recebe estes mesmos numeros por estilo
   inline. Antes existiam dois modelos da mesma altura — as constantes aqui e o
   que as classes do Tailwind realmente pintavam — e eles divergiram em quatro
   pontos, todos no ramo desktop: a conta usava 17 px e o CSS desenhava 20, 18
   ou 15 conforme a lotacao do dia; o respiro da celula era 16 px e a conta
   declarava 8; o botao `+N` media 24 px e a conta reservava 17; e um piso
   `Math.max(4, ...)` mandava desenhar quatro tarjas mesmo quando so cabiam
   duas. A celula tem `overflow-hidden`, entao todo excesso virava tarja
   cortada — o defeito que se via na tela.

   Mexer em qualquer numero daqui continua correto sem tocar em mais nada. */
const ALTURA_DA_TARJA = 18;
const ESPACO_ENTRE_TARJAS = 2;
const ALTURA_DO_NUMERO = 20;
const RESPIRO_VERTICAL_DA_CELULA = 16;
const ESPACO_ANTES_DA_LISTA = 6;
/* Tamanho inline, nao classe: ver a nota em `TarjaDeEvento` sobre o
   `font: inherit` sem camada que o `index.css` aplica a todo <button>. */
const TAMANHO_DA_FONTE = 11;
const TAMANHO_DA_FONTE_MOBILE = 9;

/* Teto de tarjas por celula. O que passar disso cede a ultima linha para o
   botao de expandir. */
const MAXIMO_DE_TARJAS = 4;

/* O celular tem numeros proprios, ja validados, e eles ficam intactos: a
   unica coisa que o desktop e o celular passaram a dividir e a tarja. */
const MOBILE_CELL_VERTICAL_PADDING = 4;
const MOBILE_DAY_HEADER_HEIGHT = 20;
const MOBILE_FIRST_ROW_HEADER_HEIGHT = 35;
const MOBILE_EVENT_ROW_HEIGHT = 14;
const MOBILE_EVENT_LIST_GAP = 1;
const MOBILE_EVENT_LIST_MARGIN = 2;
const MOBILE_MORE_INDICATOR_HEIGHT = 8;

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

  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith('#') ? color : '#5650f9';
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

  const handleEventClickInGrid = (e: React.MouseEvent<HTMLButtonElement>, event: Event) => {
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

  const grade = (
    <div
      ref={gridRef}
      onWheel={handleWheel}
      className={`grid grid-cols-7 auto-rows-fr min-w-0 w-full ${
        isMobile ? 'flex-1 h-full bg-[#141314] overflow-hidden' : 'min-h-0 flex-1'
      }`}
      style={
        // `minmax(0, 1fr)` deixa todas as semanas iguais e permite que a
        // célula encolha de verdade. Sem o zero, o conteúdo define a altura
        // mínima da linha e as pílulas empurram a grade para trás do dock.
        isMobile
          ? {
              gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
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

        const cellHeight = gridHeight > 0 ? gridHeight / rowCount : 0;
        /* No desktop a sigla do dia da semana saiu da célula e virou uma linha
           própria acima da grade. Sem isso a primeira semana pagava 34 px a
           mais que as outras e cabia uma tarja a menos — a mesma agenda
           mostrava três numa linha e quatro na seguinte. */
        const headerHeight = isMobile
          ? isFirstRow
            ? MOBILE_FIRST_ROW_HEADER_HEIGHT
            : MOBILE_DAY_HEADER_HEIGHT
          : ALTURA_DO_NUMERO;
        const rowHeight = isMobile ? MOBILE_EVENT_ROW_HEIGHT : ALTURA_DA_TARJA;
        const rowGap = isMobile ? MOBILE_EVENT_LIST_GAP : ESPACO_ENTRE_TARJAS;
        const listMargin = isMobile ? MOBILE_EVENT_LIST_MARGIN : ESPACO_ANTES_DA_LISTA;
        const verticalPadding = isMobile
          ? MOBILE_CELL_VERTICAL_PADDING
          : RESPIRO_VERTICAL_DA_CELULA;

        const availableEventHeight = Math.max(
          0,
          cellHeight - headerHeight - verticalPadding - listMargin
        );
        const calculatedRows = Math.floor(
          (availableEventHeight + rowGap) / (rowHeight + rowGap)
        );
        /* Sem piso: se a conta diz que cabem duas, desenha duas. O piso era o
           que fazia a tarja nascer cortada nos meses de seis semanas. */
        const eventRowsThatFit = cellHeight
          ? Math.min(MAXIMO_DE_TARJAS, Math.max(0, calculatedRows))
          : 3;
        const mobileRowsWithOverflow = Math.min(
          MAXIMO_DE_TARJAS,
          Math.max(
            0,
            Math.floor(
              (availableEventHeight - MOBILE_MORE_INDICATOR_HEIGHT + rowGap) /
                (rowHeight + rowGap)
            )
          )
        );
        const visibleCount =
          all.length > eventRowsThatFit
            ? isMobile
              ? mobileRowsWithOverflow
              : /* O botao de expandir ocupa exatamente uma linha de tarja, e a
                   conta acima ja reservou espaco para ela. */
                Math.max(0, eventRowsThatFit - 1)
            : Math.min(all.length, eventRowsThatFit);
        const visible = all.slice(0, visibleCount);
        const hiddenCount = Math.max(0, all.length - visible.length);

        return (
          <div
            key={day.date}
            data-day-cell
            className={`relative flex min-h-0 flex-col items-center justify-start overflow-hidden border-white/10 transition-colors hover:bg-white/[0.03]
                ${!day.isCurrentMonth ? 'text-gray-500' : ''}
                ${
                  /* No desktop a sigla do dia virou uma linha propria acima da
                     grade, e a borda de topo da primeira semana passaria bem
                     entre as duas — um traco que nunca existiu ali. */
                  isFirstRow && isMobile ? 'border-t border-white/10' : ''
                }
                ${!isLastRow ? 'border-b border-white/10' : ''}
                ${
                  /* Só no celular, onde o mês não tem moldura. No desktop a
                     borda da moldura já é a linha da esquerda, e esta ficava
                     colada nela: duas linhas encavaladas na beirada. */
                  isFirstCol && isMobile ? 'border-l border-white/10' : ''
                }
                ${!isLastCol ? 'border-r border-white/10' : ''}
                ${isMobile ? 'px-1 pb-0.5 pt-0.5' : 'px-2'}`}
            style={
              isMobile
                ? undefined
                : {
                    paddingTop: RESPIRO_VERTICAL_DA_CELULA / 2,
                    paddingBottom: RESPIRO_VERTICAL_DA_CELULA / 2,
                  }
            }
            onClick={() => onDayClick(day.date)}
          >
            {isMobile && isFirstRow && (
              <span className="text-[11px] text-gray-400 mb-[2px]">
                {weekdays[index]}
              </span>
            )}

            <button
              type="button"
              aria-label={`Abrir agenda de ${new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}`}
              className={`flex min-w-6 items-center justify-center rounded-md text-[12px] font-semibold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
                highlight
                  ? 'text-accent-400 drop-shadow-[0_0_6px_rgba(86,80,249,0.9)]'
                  : ''
              }`}
              style={{ minHeight: isMobile ? 20 : ALTURA_DO_NUMERO }}
            >
              {new Date(day.date + 'T00:00:00').getDate()}
            </button>

            <div
              className={`${isMobile ? 'space-y-px' : ''} min-h-0 w-full`}
              style={
                isMobile
                  ? { marginTop: MOBILE_EVENT_LIST_MARGIN }
                  : {
                      marginTop: ESPACO_ANTES_DA_LISTA,
                      display: 'flex',
                      flexDirection: 'column',
                      rowGap: ESPACO_ENTRE_TARJAS,
                    }
              }
            >
              {visible.map((event) => (
                <TarjaDeEvento
                  key={event.id}
                  titulo={event.title}
                  horaInicio={event.startTime}
                  cor={getProfessionalColor(event.professionalId)}
                  ancora="hora"
                  onClick={(e) => handleEventClickInGrid(e, event)}
                  larguraDaBorda={isMobile ? 2 : 3}
                  tamanhoDaFonte={isMobile ? TAMANHO_DA_FONTE_MOBILE : TAMANHO_DA_FONTE}
                  /* No celular a tarja mede 14 px de altura: como alvo de
                     toque ela e uma armadilha, e o que ela abriria e um
                     popover de mouse. Entao ela deixa de capturar o toque e a
                     CELULA inteira vira o alvo, que abre a Folha do Dia. O
                     leitor de tela ja tem o botao do numero do dia como porta
                     de entrada, com o mesmo destino. */
                  naoInterativa={isMobile}
                  className={
                    isMobile
                      ? 'w-full rounded-[4px] px-1 pl-2'
                      : 'w-full rounded-md px-2 pl-2.5'
                  }
                  style={{
                    height: isMobile ? MOBILE_EVENT_ROW_HEIGHT : ALTURA_DA_TARJA,
                  }}
                />
              ))}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => handleMoreClick(e, day.date)}
                  aria-label={`Mostrar mais ${hiddenCount} agendamentos`}
                  title={`Mostrar mais ${hiddenCount} agendamentos`}
                  /* Mesma razao da tarja: no celular quem abre o dia e a
                     celula, entao os tres pontos sao so o aviso de que ha
                     mais. */
                  aria-hidden={isMobile || undefined}
                  tabIndex={isMobile ? -1 : undefined}
                  className={`${
                    isMobile
                      ? 'pointer-events-none flex h-2 min-h-2 items-center justify-center gap-[2px] leading-none px-1 text-[9px]'
                      : /* Nao e um indicador passivo: e um alvo, do tamanho de
                           uma tarja e da largura da celula, para o dono abrir a
                           lista do dia. */
                        'flex w-full items-center justify-center rounded-md border border-dashed border-white/15 leading-none'
                  } font-medium text-white/45 transition-colors hover:bg-white/10 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70`}
                  style={
                    isMobile
                      ? undefined
                      : { height: ALTURA_DA_TARJA, fontSize: TAMANHO_DA_FONTE }
                  }
                >
                  {/* Três pontos desenhados, não o caractere "•": no celular o
                      glifo saía grande e espaçado demais. Assim o tamanho e a
                      distância entre eles são exatos. */}
                  {isMobile ? (
                    <span aria-hidden="true" className="flex items-center gap-[2px]">
                      <span className="h-[2px] w-[2px] rounded-full bg-current" />
                      <span className="h-[2px] w-[2px] rounded-full bg-current" />
                      <span className="h-[2px] w-[2px] rounded-full bg-current" />
                    </span>
                  ) : (
                    `+${hiddenCount}`
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex flex-1 h-full min-w-0 w-full flex-col overflow-hidden bg-[#141314]">
          {grade}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#141314]">
          <div className="grid grid-cols-7">
            {weekdays.map((sigla, i) => (
              <div
                key={`sigla-${i}`}
                /* O divisor de coluna sobe até a borda da moldura: sem ele
                   aqui, as linhas verticais nasciam na primeira semana e
                   paravam antes do topo. Mesmo traço das células; a última
                   coluna não tem, porque ali quem fecha é a moldura. */
                className={`py-1.5 text-center text-[11px] text-gray-400 ${
                  i < 6 ? 'border-r border-white/10' : ''
                }`}
              >
                {sigla}
              </div>
            ))}
          </div>
          {grade}
        </div>
      )}

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
