import React, { useMemo, useState } from "react";
import type { CalendarDay, Event, Professional } from "../types";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { empilharPorHora } from "../lib/empilhamento";
import TarjaDeEvento from "./agenda/TarjaDeEvento";
import DayEventsPopover, { type Anchor as DayAnchor } from "./DayEventsPopover";

interface WeekViewProps {
  week: CalendarDay[];
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event, anchor: { x: number; y: number }) => void;
  onTimeslotClick: (date: string, time: string) => void;
}

const PRIMEIRA_HORA = 5;
const PIXELS_POR_HORA = 48;
/* Altura UNICA para toda tarja, e nao uma altura proporcional a duracao.

   A duracao dos atendimentos aqui varia pouco (20 a 45 min), entao desenhar
   22, 30 e 34 px lado a lado nao comunicava duracao: comunicava desalinho —
   duas pilulas no mesmo horario, uma maior que a outra, sem motivo visivel.
   Com altura unica, a grade ganha um ritmo so, e a duracao exata fica no
   clique, junto do resto do agendamento.

   A posicao vertical continua saindo do horario real; o que deixou de sair de
   la e o tamanho. */
const ALTURA_DA_TARJA = 24;
/* Respiro entre blocos encostados, para dois horarios seguidos nao virarem um
   retangulo so. */
const RESPIRO = 2;
/* Quantas tarjas cabem empilhadas dentro de uma celula de uma hora. Sai da
   divisao, e nao de um numero escrito a mao, para que mexer na altura da tarja
   nao deixe a conta para tras. */
const TARJAS_POR_CELULA = Math.floor(PIXELS_POR_HORA / ALTURA_DA_TARJA);
/* Calha reservada a tarja `+N`, e so na linha que a recebe. */
const CALHA_DO_EXCEDENTE = 26;

const WeekView: React.FC<WeekViewProps> = ({
  week,
  events,
  professionals,
  onEventClick,
  onTimeslotClick,
}) => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const hours = Array.from({ length: 18 }, (_, i) => PRIMEIRA_HORA + i); // 05h - 22h
  const gridTemplateColumns = isMobile
    ? "56px repeat(7, minmax(96px, 1fr))"
    : "80px repeat(7, 1fr)";

  const [diaAberto, setDiaAberto] = useState<{
    dateISO: string;
    eventos: Event[];
    anchor: DayAnchor;
  } | null>(null);

  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith("#") ? color : "#5650f9";
  };

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      (acc[event.date] = acc[event.date] || []).push(event);
      return acc;
    }, {} as Record<string, Event[]>);
  }, [events]);

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  /* Onde uma tarja comeca: a celula da hora, mais a linha que ela ocupa dentro
     da celula. A posicao nao sai mais do minuto exato — e isso e deliberado,
     porque minuto exato de tres profissionais com ritmos diferentes (40, 30 e
     45 min) nunca alinha, e era o que deixava as pilulas tortas. */
  const topoDaLinha = (hora: number, linha: number) =>
    (hora - PRIMEIRA_HORA) * PIXELS_POR_HORA + linha * ALTURA_DA_TARJA;

  const orderedWeek = useMemo(() => {
    const days = [...week];
    const sundayIndex = days.findIndex(
      (d) => new Date(d.date + "T12:00:00").getDay() === 0
    );
    if (sundayIndex !== -1) {
      return days.slice(sundayIndex).concat(days.slice(0, sundayIndex));
    }
    return days;
  }, [week]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#141314] md:border md:border-white/[0.08] md:rounded-[28px] overflow-hidden">
      <div
        className="flex flex-1 min-h-0 overflow-x-auto custom-scrollbar"
        style={{
          scrollbarGutter: "stable" as React.CSSProperties["scrollbarGutter"],
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        <div className="flex min-h-0 min-w-[728px] flex-1 flex-col md:min-w-0">
          <div
            className="flex flex-col flex-1 overflow-y-auto custom-scrollbar"
            style={{
              scrollbarGutter: "stable" as React.CSSProperties["scrollbarGutter"],
              paddingTop: 4,
              paddingBottom: 4,
              paddingRight: 4,
            }}
          >
            <div
              className="grid sticky top-0 z-10 bg-[#141314]"
              style={{ gridTemplateColumns }}
            >
              <div className="border-b border-[#333]" />

              {orderedWeek.map((day) => {
                const isToday =
                  new Date(day.date + "T12:00:00").toDateString() ===
                  now.toDateString();

                return (
                  <div
                    key={`${day.date}-header`}
                    className="text-center border-l border-b border-[#333] py-2.5 md:py-3"
                  >
                    <p className="text-xs text-gray-400 capitalize md:text-sm">
                      {new Date(day.date + "T12:00:00").toLocaleDateString(
                        "default",
                        { weekday: "short" }
                      )}
                    </p>

                    <p
                      className={`mt-1 mx-auto flex h-7 w-7 items-center justify-center rounded-full text-base font-medium md:h-8 md:w-8 md:text-lg ${
                        isToday ? "bg-accent text-white" : "text-gray-300"
                      }`}
                    >
                      {new Date(day.date + "T12:00:00").getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 relative">
              <div className="grid" style={{ gridTemplateColumns }}>
                <div className="relative border-r border-[#333]">
                  {hours.map((h) => (
                    <div
                      key={`hour-${h}`}
                      className="h-[48px] border-b border-[#333] flex items-center justify-end pr-1.5 text-[11px] text-gray-400 md:pr-2 md:text-xs"
                    >
                      {`${String(h).padStart(2, "0")}:00`}
                    </div>
                  ))}
                </div>

                {orderedWeek.map((day) => {
                  const doDia = eventsByDate[day.date] || [];
                  const { tarjas, excedentes } = empilharPorHora(
                    doDia,
                    TARJAS_POR_CELULA
                  );
                  const isToday =
                    new Date(day.date + "T12:00:00").toDateString() ===
                    now.toDateString();

                  return (
                    <div
                      key={`${day.date}-col`}
                      className="relative border-l border-[#333]"
                    >
                      {hours.map((h) => (
                        <div
                          key={`${day.date}-${h}`}
                          className="h-[48px] border-b border-[#333] cursor-pointer"
                          onClick={() =>
                            onTimeslotClick(
                              day.date,
                              `${String(h).padStart(2, "0")}:00`
                            )
                          }
                        />
                      ))}

                      {tarjas.map(
                        ({
                          evento,
                          hora,
                          linha,
                          continuacao,
                          divideAlinhaComExcedente,
                        }) => (
                          <TarjaDeEvento
                            key={`event-${evento.id}-${hora}`}
                            atenuada={continuacao}
                            titulo={evento.title}
                            horaInicio={evento.startTime}
                            cor={getProfessionalColor(evento.professionalId)}
                            ancora="nome"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(evento, {
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className="absolute left-0 rounded-lg px-2.5 text-[12px]"
                            style={{
                              top: `${topoDaLinha(hora, linha)}px`,
                              height: `${ALTURA_DA_TARJA - RESPIRO}px`,
                              width: divideAlinhaComExcedente
                                ? `calc(100% - ${CALHA_DO_EXCEDENTE}px)`
                                : "100%",
                            }}
                          />
                        )
                      )}

                      {excedentes.map((grupo) => {
                        const top = topoDaLinha(grupo.hora, grupo.linha);

                        return (
                          <button
                            key={`excedente-${day.date}-${grupo.hora}`}
                            type="button"
                            aria-label={`Mostrar mais ${grupo.eventos.length} agendamentos`}
                            title={`Mostrar mais ${grupo.eventos.length} agendamentos`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setDiaAberto({
                                dateISO: day.date,
                                eventos: doDia,
                                anchor: {
                                  x: rect.left,
                                  y: rect.top + rect.height / 2,
                                },
                              });
                            }}
                            className="absolute right-0 flex w-[24px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
                            style={{
                              top: `${top}px`,
                              height: `${ALTURA_DA_TARJA - RESPIRO}px`,
                            }}
                          >
                            +{grupo.eventos.length}
                          </button>
                        );
                      })}

                      {isToday && (
                        <div
                          className="absolute left-0 right-0 h-[2px] bg-accent/80"
                          style={{
                            top: `${(currentHour - PRIMEIRA_HORA) * PIXELS_POR_HORA}px`,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {diaAberto && (
        <DayEventsPopover
          dateISO={diaAberto.dateISO}
          events={diaAberto.eventos}
          professionals={professionals}
          anchor={diaAberto.anchor}
          onPick={(ev) => {
            const anchor = diaAberto.anchor;
            setDiaAberto(null);
            onEventClick(ev, anchor);
          }}
          onClose={() => setDiaAberto(null)}
        />
      )}
    </div>
  );
};

export default WeekView;
