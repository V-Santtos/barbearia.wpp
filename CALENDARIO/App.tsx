import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import CalendarHeader from "./components/CalendarHeader";
import CalendarGrid from "./components/CalendarGrid";
import Sidebar from "./components/Sidebar";
import { useCalendar } from "./hooks/useCalendar";
import type { Event, Professional, CalendarView } from "./types";
import EventModal from "./components/EventModal";
import WeekView from "./components/WeekView";
import DayView from "./components/DayView";
import DayKanban from "./components/DayKanban";
import EventPopover from "./components/EventPopover";
import LoginScreen, { type OwnerSession } from "./components/LoginScreen";
import AgendaSettingsModal from "./components/AgendaSettingsModal";
import {
  getEvents,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  getProfessionals,
  createProfessional,
  updateProfessional,
  deleteProfessional,
  getAvailableSlots,
  getAgendaConfig,
} from "./services/calendarApi";
import PresencialFAB from "./components/PresencialFAB";
import { toast, Toaster } from "./components/Toast";
import MobileBottomNav, { type MobileTab } from "./components/MobileBottomNav";
import HamburgerPanel from "./components/HamburgerPanel";
import DashboardScreen from "./components/dashboard/DashboardScreen";
import LimiteDeErro from "./components/dashboard/LimiteDeErro";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePolling } from "./hooks/usePolling";

const OWNER_SESSION_KEY = "barbearia-calendar-owner-session";

const readSession = (): OwnerSession | null => {
  try {
    const raw = window.localStorage.getItem(OWNER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as OwnerSession;
    return session.remember ? session : null;
  } catch {
    return null;
  }
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function normalizeProf(p: Professional): Professional {
  return {
    ...p,
    name: p.name || p.nome || "",
    color: p.color || p.cor || "#888888",
  };
}

function phoneToWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function App() {
  const [ownerSession, setOwnerSession] = useState<OwnerSession | null>(
    readSession,
  );
  const [view, setView] = useState<CalendarView>("month");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobileTab, setMobileTab] = useState<MobileTab>("calendar");
  const [viewMode, setViewMode] = useState<"timeline" | "kanban">("timeline");
  const [appReady, setAppReady] = useState(false);

  // A faixa embaixo do indicador de home nao e pintada pelo iOS: em PWA
  // standalone quem pinta a tela inteira e a pagina. O que aparecia ali era o
  // `body` (#1c1c1c) por baixo de telas que pintam #0e0e10 — duas cores, emenda
  // visivel. Nao da pra resolver com uma cor fixa no CSS porque as telas
  // discordam: entrada e carregamento sao #0e0e10, o app e #1c1c1c.
  //
  // Entao o fundo da pagina segue a tela ativa. Casado com `h-dvh` (que alcanca
  // a borda de verdade, diferente de `h-screen`/100vh no iOS), nao sobra faixa
  // de cor nenhuma pra emendar.
  useEffect(() => {
    const corDaTela = ownerSession && appReady ? "#1c1c1c" : "#0e0e10";
    document.documentElement.style.backgroundColor = corDaTela;
    document.body.style.backgroundColor = corDaTela;
  }, [ownerSession, appReady]);

  // O dashboard é camada, não visualização: `view` não é tocado, então voltar
  // devolve a agenda exatamente como estava — mesma data, mesma visualização,
  // mesmo filtro. No celular quem manda é o dock, e `mobileTab` já é o estado
  // dele; aqui só o desktop precisa de um interruptor próprio.
  const [dashboardAberto, setDashboardAberto] = useState(false);
  const dashboardVisivel = isMobile
    ? mobileTab === "dashboard"
    : dashboardAberto;

  const fecharDashboard = useCallback(() => {
    setDashboardAberto(false);
    setMobileTab((atual) => (atual === "dashboard" ? "calendar" : atual));
  }, []);

  const {
    currentDate,
    days,
    weekdays,
    week,
    goToNext,
    goToPrev,
    goToToday,
    setDate,
  } = useCalendar(new Date(), view);

  const [events, setEvents] = useState<Event[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState<
    Set<number>
  >(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [settingsProfessional, setSettingsProfessional] =
    useState<Professional | null>(null);

  // presencialIds: professionalId → bookingId do agendamento presencial ativo
  // presencialIntervals: professionalId → intervalo_duracao_min do profissional
  const [presencialIds, setPresencialIds] = useState<Map<number, number>>(
    new Map(),
  );
  const [presencialIntervals, setPresencialIntervals] = useState<
    Map<number, number>
  >(new Map());
  const [presencialLoading, setPresencialLoading] = useState(false);

  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [showAddProfModal, setShowAddProfModal] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(dx) < 60 || view !== "month") return;
      dx < 0 ? goToNext() : goToPrev();
    },
    [view, goToNext, goToPrev],
  );

  // Inicializa view mobile como Kanban/Dia na primeira montagem
  const mobileViewInitialized = useRef(false);
  useEffect(() => {
    if (isMobile && !mobileViewInitialized.current) {
      mobileViewInitialized.current = true;
      setView("day");
      setViewMode("kanban");
    }
  }, [isMobile]);

  // Auto-expiração: destravar e remover o card presencial em endTime - intervalo_duracao_min.
  useEffect(() => {
    if (presencialIds.size === 0) return;

    const check = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const today = now.toLocaleDateString("en-CA");
      const next = new Map(presencialIds);
      const nextIntervals = new Map(presencialIntervals);
      const expiredBookingIds: number[] = [];
      let changed = false;

      for (const [profId, bookingId] of presencialIds.entries()) {
        const expire = () => {
          next.delete(profId);
          nextIntervals.delete(profId);
          expiredBookingIds.push(bookingId);
          changed = true;
        };

        const evt = events.find((e) => e.id === bookingId);
        if (!evt) {
          expire();
          continue;
        }
        if (evt.date !== today) {
          expire();
          continue;
        }
        if (evt.endTime) {
          const [h, m] = evt.endTime.split(":").map(Number);
          const intervalMin = presencialIntervals.get(profId) ?? 0;
          if (nowMins >= h * 60 + m - intervalMin) expire();
        }
      }

      if (!changed) return;

      setPresencialIds(next);
      setPresencialIntervals(nextIntervals);
      setEvents((prev) =>
        prev.filter((event) => !expiredBookingIds.includes(event.id)),
      );
      void Promise.allSettled(
        expiredBookingIds.map((bookingId) => deleteEvent(bookingId)),
      ).then((results) => {
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(
              "Erro ao remover atendimento presencial expirado:",
              expiredBookingIds[index],
              result.reason,
            );
          }
        });
      });
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [presencialIds, presencialIntervals, events]);

  // Auto-conclusão: marca 'concluido' (e some do front) quando o horário de
  // término já passou. Usa o endTime calculado pelo backend (duração do PROFISSIONAL).
  // Não-destrutivo: registro permanece no banco como histórico/CRM.
  useEffect(() => {
    const ATIVOS = new Set(["agendado", "confirmado"]);

    const check = () => {
      const now = new Date();
      const today = now.toLocaleDateString("en-CA"); // 'YYYY-MM-DD'
      const nowMins = now.getHours() * 60 + now.getMinutes();

      const expirados = events.filter((evt) => {
        if (!evt.status || !ATIVOS.has(evt.status)) return false; // só ativos
        if (!evt.endTime) return false; // sem fim calculável
        if (evt.date > today) return false; // futuro: ignora
        if (evt.date < today) return true; // dia passado: já terminou
        const [h, m] = evt.endTime.split(":").map(Number); // hoje: compara horário
        return nowMins >= h * 60 + m;
      });

      if (expirados.length === 0) return;

      const ids = expirados.map((e) => e.id);
      // Otimista: esconde já (filteredEvents exclui 'concluido')
      setEvents((prev) =>
        prev.map((e) =>
          ids.includes(e.id) ? { ...e, status: "concluido" } : e,
        ),
      );
      // Persiste no banco
      void Promise.allSettled(
        ids.map((id) => updateEventStatus(id, "concluido")),
      ).then((results) => {
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(
              "Erro ao concluir agendamento expirado:",
              ids[i],
              r.reason,
            );
          }
        });
      });
    };

    check();
    const id = setInterval(check, 60_000); // re-checa a cada 60s
    return () => clearInterval(id);
  }, [events]);

  const [popoverEvent, setPopoverEvent] = useState<Event | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [popoverProfessional, setPopoverProfessional] = useState<
    Professional | undefined
  >(undefined);

  // Carrega dados da API ao fazer login
  useEffect(() => {
    if (!ownerSession) return;

    let cancelled = false;

    async function load() {
      try {
        const profs = await getProfessionals();
        const normalized = profs.map(normalizeProf);
        if (cancelled) return;
        setProfessionals(normalized);
        setSelectedProfessionals(new Set(normalized.map((p) => p.id)));
        const evts = await getEvents().catch((err) => {
          console.error("Erro ao carregar agendamentos:", err);
          return [];
        });
        if (cancelled) return;
        setEvents(evts);

        // Restaura presencial ativo após F5: busca eventos de hoje com source='presencial'
        const today = new Date().toLocaleDateString("en-CA");
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

        // Coleta candidatos (sem checar expiração ainda — precisa do intervalo primeiro)
        const candidates = new Map<number, number>(); // profId → bookingId
        for (const evt of evts) {
          if (evt.source !== "presencial" || evt.date !== today) continue;
          if (evt.professionalId) candidates.set(evt.professionalId, evt.id);
        }

        if (candidates.size > 0) {
          // Busca intervalo_duracao_min de cada profissional
          const intervalsMap = new Map<number, number>();
          await Promise.all(
            Array.from(candidates.keys()).map(async (profId) => {
              try {
                const cfg = await getAgendaConfig(profId);
                intervalsMap.set(profId, cfg.intervalo_duracao_min ?? 0);
              } catch {
                intervalsMap.set(profId, 0);
              }
            }),
          );

          // Filtra com a regra correta: destravar em endTime - intervalMin
          const restoredMap = new Map<number, number>();
          const expiredBookingIds: number[] = [];
          for (const [profId, bookingId] of candidates.entries()) {
            const evt = evts.find((e) => e.id === bookingId);
            if (!evt) continue;
            if (evt.endTime) {
              const [h, m] = evt.endTime.split(":").map(Number);
              const intervalMin = intervalsMap.get(profId) ?? 0;
              if (nowMins >= h * 60 + m - intervalMin) {
                expiredBookingIds.push(bookingId);
                continue; // já expirou
              }
            }
            restoredMap.set(profId, bookingId);
          }

          if (expiredBookingIds.length > 0) {
            setEvents((prev) =>
              prev.filter((event) => !expiredBookingIds.includes(event.id)),
            );
            void Promise.allSettled(
              expiredBookingIds.map((bookingId) => deleteEvent(bookingId)),
            ).then((results) => {
              results.forEach((result, index) => {
                if (result.status === "rejected") {
                  console.error(
                    "Erro ao remover atendimento presencial expirado:",
                    expiredBookingIds[index],
                    result.reason,
                  );
                }
              });
            });
          }

          if (restoredMap.size > 0) {
            setPresencialIds(restoredMap);
            setPresencialIntervals(intervalsMap);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Erro ao carregar dados:", err);
        window.alert("Não foi possível conectar à API. Verifique sua conexão.");
      } finally {
        if (!cancelled) setAppReady(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ownerSession]);

  // Mantém os agendamentos atualizados sem precisar dar F5. Roda em paralelo à
  // carga inicial acima (que faz normalização/presencial/expiração só 1x).
  // Aqui é SÓ buscar e setar os eventos. Pausa enquanto um modal de evento
  // está aberto pra não sobrescrever o que o usuário está criando/editando.
  usePolling(
    async () => {
      const evts = await getEvents();
      setEvents(evts);
    },
    { intervalMs: 15000, enabled: !!ownerSession && !isModalOpen },
    [ownerSession, isModalOpen],
  );

  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
    if (isMobile && newView === "day") setViewMode("kanban");
  };

  const handleProfessionalToggle = useCallback((professionalId: number) => {
    setSelectedProfessionals((prev) => {
      const next = new Set(prev);
      next.has(professionalId)
        ? next.delete(professionalId)
        : next.add(professionalId);
      return next;
    });
  }, []);

  const filteredEvents = events.filter(
    (event) =>
      event.status !== "concluido" &&
      selectedProfessionals.has(event.professionalId!),
  );

  const handleSaveEvent = async (
    eventData: Omit<Event, "id"> & { id?: number },
  ) => {
    const start = toMinutes(eventData.startTime);
    const end = toMinutes(eventData.endTime);

    if (end <= start) {
      window.alert(
        "O horário de término precisa ser maior que o horário de início.",
      );
      return;
    }

    const hasConflict = events.some((event) => {
      if (event.status === "concluido") return false;
      if (event.id === eventData.id) return false;
      if (event.date !== eventData.date) return false;
      if (event.professionalId !== eventData.professionalId) return false;
      const existingStart = toMinutes(event.startTime);
      const existingEnd = toMinutes(event.endTime);
      return start < existingEnd && end > existingStart;
    });

    if (hasConflict) {
      window.alert(
        "Já existe um agendamento para esse profissional neste horário.",
      );
      return;
    }

    const professional = professionals.find(
      (p) => p.id === eventData.professionalId,
    );
    if (!professional) return;

    // Tenta extrair telefone e serviço da descrição se existirem
    const desc = eventData.description || "";
    const phoneMatch = desc.match(/Telefone:\s*([^\n]+)/);
    const serviceMatch = desc.match(/Servi[cç]o:\s*([^\n]+)/i);
    const telefone = phoneMatch ? phoneMatch[1].trim() : "";
    const servico = serviceMatch ? serviceMatch[1].trim() : "";
    const whatsappUrl = telefone ? phoneToWhatsAppUrl(telefone) : "";

    const descFinal =
      [
        servico ? `Servico: ${servico}` : null,
        telefone ? `Telefone: ${telefone}` : null,
        whatsappUrl ? `WhatsApp: ${whatsappUrl}` : null,
      ]
        .filter(Boolean)
        .join("\n") || desc;

    try {
      if (typeof eventData.id === "number") {
        const updated = await updateEvent(eventData.id, {
          telefone,
          cliente: eventData.title,
          profissional: professional.name,
          servico,
          dia_marcado: eventData.date,
          hora_marcada: eventData.startTime,
        });
        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e)),
        );
      } else {
        const created = await createEvent({
          telefone,
          cliente: eventData.title,
          profissional: professional.name,
          servico,
          dia_marcado: eventData.date,
          hora_marcada: eventData.startTime,
          source: "calendario-admin",
        });
        setEvents((prev) => [
          ...prev,
          { ...created, endTime: eventData.endTime, description: descFinal },
        ]);
      }
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error(err);
      window.alert(
        "Erro ao salvar agendamento. Verifique a conexão com a API.",
      );
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error(err);
      window.alert("Erro ao deletar agendamento.");
    }
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleCompleteEvent = async (eventId: number) => {
    try {
      await updateEventStatus(eventId, "concluido");
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: "concluido" } : e)),
      );
    } catch (err) {
      console.error(err);
      window.alert("Erro ao marcar como concluído.");
    }
  };

  const handleAddProfessional = async (
    name: string,
    color: string,
  ): Promise<Professional | null> => {
    try {
      const prof = await createProfessional(name, color);
      const normalized = normalizeProf(prof);
      setProfessionals((prev) => [...prev, normalized]);
      setSelectedProfessionals((prev) => new Set(prev).add(normalized.id));
      return normalized;
    } catch (err) {
      console.error(err);
      window.alert("Erro ao adicionar profissional.");
      return null;
    }
  };

  const handleDeleteProfessional = async (id: number) => {
    try {
      await deleteProfessional(id);
      setProfessionals((prev) => prev.filter((p) => p.id !== id));
      setEvents((prev) => prev.filter((e) => e.professionalId !== id));
      setSelectedProfessionals((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error(err);
      window.alert("Erro ao remover profissional.");
    }
  };

  const handleOpenSettings = (id: number) => {
    const prof = professionals.find((p) => p.id === id) ?? null;
    setSettingsProfessional(prof);
  };

  const handleChangeProfessionalColor = async (id: number, color: string) => {
    // Optimistic update
    setProfessionals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color } : p)),
    );
    try {
      await updateProfessional(id, { color });
    } catch (err) {
      console.error(err);
      // Reverte em caso de erro
      const profs = await getProfessionals();
      setProfessionals(profs.map(normalizeProf));
    }
  };

  const openModalWithDate = (date: string) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleEventClick = (
    event: Event,
    anchor?: { x: number; y: number },
  ) => {
    if (anchor) {
      setPopoverEvent(event);
      setPopoverAnchor(anchor);
      setPopoverProfessional(
        professionals.find((p) => p.id === event.professionalId),
      );
      return;
    }
    setEditingEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleClosePopover = () => {
    setPopoverEvent(null);
    setPopoverAnchor(null);
    setPopoverProfessional(undefined);
  };

  const handlePresencialActivate = async (prof: Professional) => {
    setPresencialLoading(true);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const [slots, agendaConfig] = await Promise.all([
        getAvailableSlots(prof.id, today),
        getAgendaConfig(prof.id),
      ]);
      if (!slots.length) {
        toast.warning(
          `Barbearia fechada hoje — não há horário disponível para ${prof.name}.`,
        );
        return;
      }
      /*
        window.alert(`Não há horário disponível para bloquear para ${prof.name}.`);
      */
      const nextSlot = slots[0];
      const created = await createEvent({
        cliente: "Atendimento Presencial",
        profissional: prof.name,
        dia_marcado: today,
        hora_marcada: nextSlot,
        telefone: "",
        servico: "Presencial",
        source: "presencial",
      });
      const intervalMin = agendaConfig.intervalo_duracao_min ?? 0;
      // POST não retorna professional_id (sem JOIN), sobrescreve com prof.id correto
      setEvents((prev) => [...prev, { ...created, professionalId: prof.id }]);
      setPresencialIds((prev) => new Map(prev).set(prof.id, created.id));
      setPresencialIntervals((prev) => new Map(prev).set(prof.id, intervalMin));
    } catch (err) {
      console.error(
        "Erro no FAB presencial ao consultar/criar agendamento:",
        err,
      );
      toast.error(
        "Erro ao registrar atendimento presencial. Verifique se a API (porta 3333) está ativa.",
      );
    } finally {
      setPresencialLoading(false);
    }
  };

  const handlePresencialDeactivate = async (professionalId: number) => {
    const bookingId = presencialIds.get(professionalId);
    if (!bookingId) return;

    // Limpa estado local imediatamente — FAB desbloqueia independente do resultado da API
    setPresencialIds((prev) => {
      const next = new Map(prev);
      next.delete(professionalId);
      return next;
    });
    setPresencialIntervals((prev) => {
      const next = new Map(prev);
      next.delete(professionalId);
      return next;
    });
    setEvents((prev) => prev.filter((e) => e.id !== bookingId));

    setPresencialLoading(true);
    try {
      await deleteEvent(bookingId);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      // 404 = evento já não existe no banco, sem problema
      if (!msg.includes("não encontrado") && !msg.includes("404")) {
        console.error(
          "Erro ao remover agendamento presencial do servidor:",
          err,
        );
      }
    } finally {
      setPresencialLoading(false);
    }
  };

  const handleLogin = (session: OwnerSession) => {
    setOwnerSession(session);
    if (session.remember) {
      window.localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(OWNER_SESSION_KEY);
    }
  };

  const handleLogout = () => {
    setOwnerSession(null);
    setAppReady(false);
    window.localStorage.removeItem(OWNER_SESSION_KEY);
    setEvents([]);
    setProfessionals([]);
    setSelectedProfessionals(new Set());
    setPresencialIds(new Map());
    setPresencialIntervals(new Map());
  };

  const renderView = () => {
    switch (view) {
      case "day":
        return viewMode === "kanban" ? (
          <motion.div
            key="kanban"
            className="flex-1 min-h-0"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <DayKanban
              currentDate={currentDate}
              events={filteredEvents}
              professionals={professionals}
              selectedProfessionals={selectedProfessionals}
              onProfessionalToggle={handleProfessionalToggle}
              onEventClick={handleEventClick}
              onCompleteEvent={handleCompleteEvent}
            />
          </motion.div>
        ) : (
          <DayView
            currentDate={currentDate}
            events={filteredEvents}
            professionals={professionals}
            onEventClick={handleEventClick}
            onTimeslotClick={(date) => openModalWithDate(`${date}`)}
          />
        );

      case "week":
        return (
          <WeekView
            week={week}
            events={filteredEvents}
            professionals={professionals}
            onEventClick={handleEventClick}
            onTimeslotClick={(date) => openModalWithDate(`${date}`)}
          />
        );

      case "month":
      default:
        return (
          <CalendarGrid
            days={days}
            weekdays={weekdays}
            events={filteredEvents}
            professionals={professionals}
            selectedDate={selectedDate || undefined}
            onDayClick={openModalWithDate}
            onEventClick={handleEventClick}
            onRequestDelete={handleDeleteEvent}
            onScrollPrev={goToPrev}
            onScrollNext={goToNext}
          />
        );
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!ownerSession && (
        <motion.div
          key="login"
          className="h-dvh w-screen"
          exit={{ opacity: 0, filter: "blur(10px)", scale: 1.02 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          <LoginScreen onLogin={handleLogin} />
        </motion.div>
      )}

      {ownerSession && !appReady && (
        <motion.div
          key="loading"
          className="h-dvh w-screen bg-[#0e0e10] flex flex-col items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#6B3EFF]" />
          <span className="text-sm text-white/70">Carregando dados...</span>
        </motion.div>
      )}

      {ownerSession && appReady && (
        <motion.div
          key="app"
          className="flex h-dvh overflow-hidden bg-background font-sans text-foreground"
          initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <Sidebar
            onAddEvent={() =>
              openModalWithDate(new Date().toLocaleDateString("en-CA"))
            }
            professionals={professionals}
            selectedProfessionals={selectedProfessionals}
            onProfessionalToggle={handleProfessionalToggle}
            onAddProfessional={handleAddProfessional}
            onDeleteProfessional={handleDeleteProfessional}
            onChangeProfessionalColor={handleChangeProfessionalColor}
            onOpenSettings={handleOpenSettings}
            currentDate={currentDate}
            onDateChange={setDate}
            mobilePanel={
              isMobile && mobileTab === "conversations" ? "conversations" : null
            }
            onCloseMobilePanel={() => setMobileTab("calendar")}
            externalShowAddModal={showAddProfModal}
            onExternalAddModalClose={() => setShowAddProfModal(false)}
          />

          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <CalendarHeader
              currentDate={currentDate}
              onPrev={goToPrev}
              onNext={goToNext}
              onToday={goToToday}
              view={view}
              viewMode={viewMode}
              onViewChange={handleViewChange}
              onToggleKanban={() =>
                setViewMode((prev) =>
                  prev === "timeline" ? "kanban" : "timeline",
                )
              }
              owner={ownerSession}
              onLogout={handleLogout}
              professionals={professionals}
              presencialIds={presencialIds}
              onMenuOpen={() => setHamburgerOpen(true)}
              onNavigateToDate={setDate}
              onOpenDashboard={() => setDashboardAberto(true)}
            />

            <main
              /* pb-16 e não pb-28: o card do dia (`DayKanban`) esticou
                 verticalmente a pedido do dono em 2026-08-04, e o dock passou
                 a flutuar levemente POR CIMA da borda inferior do card, não
                 mais só sobre o respiro vazio depois dele. Mês e semana
                 continuam sem nenhum respiro (viram tela cheia desde
                 2026-08-04) — só o dia guarda uma folga, agora menor. */
              className={`flex-1 flex flex-col min-h-0 md:p-6 lg:p-8 md:pb-6 lg:pb-8 ${
                view === "month" || view === "week" ? "" : "pb-16"
              }`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className={`flex-1 flex flex-col min-h-0 ${
                  view === "month" || view === "week" || viewMode === "kanban"
                    ? "overflow-hidden"
                    : "overflow-y-auto"
                }`}
              >
                {renderView()}
              </div>
            </main>
          </div>

          {popoverEvent && popoverAnchor && (
            <EventPopover
              event={popoverEvent}
              professional={popoverProfessional}
              anchor={popoverAnchor}
              onEdit={(event) => {
                handleEventClick(event);
                handleClosePopover();
              }}
              onDelete={(id) => {
                handleDeleteEvent(id);
                handleClosePopover();
              }}
              onClose={handleClosePopover}
            />
          )}

          <AgendaSettingsModal
            professional={settingsProfessional}
            onClose={() => setSettingsProfessional(null)}
          />
          <Toaster />
          <PresencialFAB
            professionals={professionals}
            presencialIds={presencialIds}
            onActivate={handlePresencialActivate}
            onDeactivate={handlePresencialDeactivate}
            isLoading={presencialLoading}
            visible={
              !hamburgerOpen &&
              settingsProfessional === null &&
              !dashboardVisivel &&
              (!isMobile || (mobileTab === "calendar" && view === "day"))
            }
          />

          {/* Mês e semana no celular trocam a tesoura (presencial não faz
              sentido sem um dia em foco) pelo "+" de novo agendamento, como no
              Google Calendar — mesmo canto, mesmo `openModalWithDate` que a
              grade já usa ao tocar num dia. */}
          {isMobile &&
            mobileTab === "calendar" &&
            (view === "month" || view === "week") &&
            !hamburgerOpen &&
            settingsProfessional === null &&
            !dashboardVisivel && (
              <button
                onClick={() =>
                  openModalWithDate(currentDate.toLocaleDateString("en-CA"))
                }
                aria-label="Novo agendamento"
                className="fixed bottom-[100px] right-5 z-50 flex h-14 w-14 items-center
                           justify-center rounded-2xl bg-[#6B3EFF] text-white shadow-xl
                           shadow-[#6B3EFF]/30 transition-transform active:scale-90
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                           md:hidden"
              >
                <Plus size={26} />
              </button>
            )}

          <EventModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            selectedDate={selectedDate}
            professionals={professionals}
            eventToEdit={editingEvent}
          />

          <LimiteDeErro onFechar={fecharDashboard}>
            <DashboardScreen
              aberto={dashboardVisivel}
              isMobile={isMobile}
              onFechar={fecharDashboard}
            />
          </LimiteDeErro>

          {/* Trocar de aba fecha a gaveta. O dock vive em z-index 100 e o
              backdrop da gaveta em z-60, então o dedo SEMPRE alcançou os
              ícones com o menu aberto -- só que ninguém avisava o painel, e a
              tela nova nascia escondida atrás dele. O único jeito de sair era
              o X. Fecha inclusive ao tocar na aba em que já se está: com a
              gaveta por cima, tocar o ícone da aba atual é pedido de voltar
              pra ela. */}
          <MobileBottomNav
            tab={mobileTab}
            onChange={(nova) => {
              setHamburgerOpen(false);
              setMobileTab(nova);
            }}
          />

          <HamburgerPanel
            open={hamburgerOpen}
            onClose={() => setHamburgerOpen(false)}
            onAddEvent={() =>
              openModalWithDate(new Date().toLocaleDateString("en-CA"))
            }
            view={view}
            onViewChange={handleViewChange}
            professionals={professionals}
            selectedProfessionals={selectedProfessionals}
            onProfessionalToggle={handleProfessionalToggle}
            onAddProfessionalRequest={() => {
              setHamburgerOpen(false);
              setShowAddProfModal(true);
            }}
            onDeleteProfessional={handleDeleteProfessional}
            onChangeProfessionalColor={handleChangeProfessionalColor}
            onOpenSettings={handleOpenSettings}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
