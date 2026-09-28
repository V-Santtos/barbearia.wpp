import React, { useEffect, useMemo, useRef } from 'react';
import type { Event, Professional } from '../types';
import { disporDia } from '../lib/sobreposicao';

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event, anchor: { x: number; y: number }) => void;
  onTimeslotClick?: (date: string, time: string) => void;
  /* A Folha do Dia embute esta linha do tempo em tela cheia, sem a pilula com
     borda que ela usa como tela propria no desktop. */
  moldura?: boolean;
  /* Hora decimal para deixar visivel assim que a tela abre. Sem isto, um dia
     com marcacoes so a tarde nasce mostrando as 05:00 vazias. */
  horaInicialVisivel?: number;
}

const PRIMEIRA_HORA = 5;
const PIXELS_POR_HORA = 60;
const ALTURA_MINIMA = 30;
/* Quanto tempo o bloco mais curto OCUPA na tela, em minutos: e o que a
   colisao usa, para que a altura minima nunca produza dois blocos
   sobrepostos. */
const DURACAO_VISUAL_MINIMA = (ALTURA_MINIMA / PIXELS_POR_HORA) * 60;

/* Tamanho por estilo inline, e nao por classe: `index.css` declara
   `button, input, textarea { font: inherit }` FORA de qualquer `@layer`, e
   regra sem camada vence a camada `utilities`. Num <button>, `text-[14px]` e
   silenciosamente ignorado — era por isso que o nome saia nos 16 px herdados
   do corpo da pagina. */
const TAMANHO_DO_NOME = 13;
const TAMANHO_DA_HORA = 11;
/* Abaixo desta altura o bloco nao comporta duas linhas: nome (13 px) + faixa
   (11 px) + respiro pedem ~36 px, e um atendimento de 30 min desenha 30. Nesse
   caso a faixa de horario sai e fica so o nome — a calha da esquerda ja diz a
   hora, e o nome e quem identifica o agendamento. Antes as duas linhas eram
   desenhadas sempre, e o `overflow-hidden` cortava justamente o nome. */
const ALTURA_PARA_DUAS_LINHAS = 38;

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  professionals,
  onEventClick,
  onTimeslotClick,
  moldura = true,
  horaInicialVisivel,
}) => {
  const hours = Array.from({ length: 18 }, (_, i) => PRIMEIRA_HORA + i); // 05h - 22h
  const dateISO = currentDate.toLocaleDateString('en-CA');
  const roloRef = useRef<HTMLDivElement | null>(null);

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === dateISO),
    [events, dateISO]
  );

  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith('#') ? color : '#5650f9';
  };

  const timeToPosition = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h + m / 60 - PRIMEIRA_HORA) * PIXELS_POR_HORA;
  };

  const positionedEvents = useMemo(
    () => disporDia(dayEvents, { duracaoVisualMinima: DURACAO_VISUAL_MINIMA }),
    [dayEvents]
  );

  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  useEffect(() => {
    const rolo = roloRef.current;
    if (!rolo || horaInicialVisivel === undefined) return;
    /* Um respiro de meia hora acima do alvo, para ele nao nascer colado no
       topo e parecer que nao ha nada antes. */
    rolo.scrollTop = Math.max(
      0,
      (horaInicialVisivel - PRIMEIRA_HORA - 0.5) * PIXELS_POR_HORA
    );
  }, [horaInicialVisivel, dateISO]);

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden bg-[#141314] ${
        moldura ? 'mx-4 md:mx-0 rounded-[28px] border border-white/[0.08]' : ''
      }`}
    >
      <div
        ref={roloRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative px-4 py-6"
      >
        <div className="flex relative" style={{ minHeight: hours.length * PIXELS_POR_HORA }}>
          {/* Coluna de Horas */}
          <div className="w-16 shrink-0 border-r border-white/5">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: PIXELS_POR_HORA }}>
                <span className="absolute -top-2 right-2 text-[11px] text-gray-500 font-medium">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Grid de Conteúdo */}
          <div className="flex-1 relative">
            {/* Linhas de grade */}
            {hours.map((h) => (
              <button
                type="button"
                key={h}
                aria-label={`Criar agendamento às ${String(h).padStart(2, '0')}:00`}
                disabled={!onTimeslotClick}
                className="block w-full border-b border-white/5 text-left hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70 disabled:cursor-default"
                style={{ height: PIXELS_POR_HORA }}
                onClick={() => onTimeslotClick?.(dateISO, `${String(h).padStart(2, '0')}:00`)}
              />
            ))}

            {/* Linha do Tempo Atual */}
            {isToday && currentHour >= PRIMEIRA_HORA && currentHour <= 22 && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none flex items-center"
                style={{ top: (currentHour - PRIMEIRA_HORA) * PIXELS_POR_HORA }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
              </div>
            )}

            {/* Eventos */}
            {positionedEvents.map(({ evento, coluna, colunasDoGrupo }) => {
              const top = timeToPosition(evento.startTime);
              const end = timeToPosition(evento.endTime);
              const height = Math.max(ALTURA_MINIMA, end - top);

              return (
                <button
                  type="button"
                  key={evento.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(evento, { x: e.clientX, y: e.clientY });
                  }}
                  aria-label={`${evento.title}, das ${evento.startTime} às ${evento.endTime}`}
                  className="absolute flex flex-col justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] px-2.5 py-1 text-left text-white shadow-xl transition-[background-color,border-color,box-shadow] hover:border-white/20 hover:bg-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
                  style={{
                    boxShadow: `inset 3px 0 0 ${getProfessionalColor(evento.professionalId)}, 0 12px 24px rgba(0,0,0,0.22)`,
                    top,
                    height,
                    /* Largura e recuo saem do MESMO denominador, o do grupo de
                       colisao — e nao do maior amontoado do dia, que encolhia
                       ate os blocos que estavam sozinhos. */
                    left: `calc(${(coluna * 100) / colunasDoGrupo}% + 4px)`,
                    width: `calc(${100 / colunasDoGrupo}% - 8px)`,
                  }}
                >
                  <span
                    className="truncate font-bold leading-tight"
                    style={{ fontSize: TAMANHO_DO_NOME }}
                  >
                    {evento.title}
                  </span>
                  {height >= ALTURA_PARA_DUAS_LINHAS && (
                    <span
                      className="truncate tabular-nums leading-tight opacity-75"
                      style={{ fontSize: TAMANHO_DA_HORA }}
                    >
                      {evento.startTime} - {evento.endTime}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
