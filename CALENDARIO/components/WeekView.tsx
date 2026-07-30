import React, { useMemo } from "react";
import type { CalendarDay, Event, Professional } from "../types";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface WeekViewProps {
  week: CalendarDay[];
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event, anchor: { x: number; y: number }) => void;
  onTimeslotClick: (date: string, time: string) => void;
}

type OverlappedEvent = Event & { column: number };

const WeekView: React.FC<WeekViewProps> = ({
  week,
  events,
  professionals,
  onEventClick,
  onTimeslotClick,
}) => {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const hours = Array.from({ length: 18 }, (_, i) => 5 + i); // 05h - 22h
  const gridTemplateColumns = isMobile
    ? "56px repeat(7, minmax(96px, 1fr))"
    : "80px repeat(7, 1fr)";

  const getProfessionalColor = (professionalId: number) => {
    const color = professionals.find((p) => p.id === professionalId)?.color;
    return color?.startsWith("#") ? color : "#6B3EFF";
  };

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      (acc[event.date] = acc[event.date] || []).push(event);
      return acc;
    }, {} as Record<string, Event[]>);
  }, [events]);

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const timeToPosition = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h + m / 60 - 5) * 48;
  };

  const calcOverlap = (dayEvents: Event[]) => {
    const sorted = [...dayEvents].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    const overlaps: OverlappedEvent[] = [];
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
    <div className="flex flex-col flex-1 min-h-0 bg-[#141314] md:border md:border-[#6B3EFF]/45 md:rounded-[28px] overflow-hidden">
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
                        isToday ? "bg-[#6B3EFF] text-white" : "text-gray-300"
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
                  const dayEvents = calcOverlap(eventsByDate[day.date] || []);
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

                      {dayEvents.map((event) => {
                        const overlappingEvents = dayEvents.filter(
                          (e) =>
                            !(
                              event.endTime <= e.startTime ||
                              event.startTime >= e.endTime
                            )
                        );

                        const hasOverlap = overlappingEvents.length > 1;
                        const top = timeToPosition(event.startTime);
                        const end = timeToPosition(event.endTime);
                        const height = Math.max(48, end - top);
                        const width = `${100 / overlappingEvents.length}%`;
                        const left = `${event.column * parseFloat(width)}%`;

                        return (
                          <div
                            key={`event-${event.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event, {
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className="absolute overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] font-semibold text-white shadow-md transition hover:border-white/20 hover:bg-[#262626]"
                            style={{
                              boxShadow: `inset 3px 0 0 ${getProfessionalColor(event.professionalId)}, 0 8px 18px rgba(0,0,0,0.2)`,
                              top: `${top}px`,
                              height: `${height}px`,
                              left,
                              width,
                              display: "flex",
                              flexDirection: hasOverlap ? "column" : "row",
                              justifyContent: hasOverlap
                                ? "center"
                                : "space-between",
                              alignItems: "center",
                              fontSize: hasOverlap ? "12px" : "13px",
                              padding: hasOverlap ? "4px 6px" : "3px 8px",
                              textAlign: "center",
                            }}
                          >
                            {hasOverlap ? (
                              <>
                                <span>{event.title}</span>
                                <span className="opacity-90 text-xs">
                                  {event.startTime} - {event.endTime}
                                </span>
                              </>
                            ) : (
                              <span className="truncate">
                                {event.title} {event.startTime} - {event.endTime}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {isToday && (
                        <div
                          className="absolute left-0 right-0 h-[2px] bg-[#6B3EFF]/80"
                          style={{ top: `${(currentHour - 5) * 48}px` }}
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
    </div>
  );
};

export default WeekView;
