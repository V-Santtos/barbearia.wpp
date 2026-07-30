import React, { useMemo, useState, useEffect } from "react";
import type { Professional } from "../types";
import { useCalendar } from "../hooks/useCalendar";
import { AnimatePresence, motion } from "framer-motion";
import {
  Settings,
  PaintBucket,
  Trash2,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Clock,
} from "lucide-react";
import WhatsAppPanel, { type Conversation } from "./WhatsAppPanel";
import {
  getWhatsAppConversations,
  markWhatsAppConversationAsRead,
  type WhatsAppConversation,
  updateAgendaConfig,
  type AgendaConfig,
} from "../services/calendarApi";
import TimeSelect from "./ui/TimeSelect";
import { usePolling } from "../hooks/usePolling";

const mockConversations: Conversation[] = [
  {
    id: 1,
    name: "João Silva",
    preview: "Tem horário amanhã cedo?",
    time: "09:42",
    unread: 2,
    color: "#FF5000",
  },
  {
    id: 2,
    name: "Maria Souza",
    preview: "Ficou ótimo, obrigada! 👍",
    time: "ontem",
    unread: 0,
    color: "#07FF99",
  },
  {
    id: 3,
    name: "Carlos M.",
    preview: "Pode confirmar pra mim?",
    time: "14:30",
    unread: 1,
    color: "#0047FF",
  },
  {
    id: 4,
    name: "Pedro Alves",
    preview: "Ok, até lá!",
    time: "ter",
    unread: 0,
    color: "#8400FF",
  },
  {
    id: 5,
    name: "Ana Clara",
    preview: "Qual o valor do corte?",
    time: "seg",
    unread: 0,
    color: "#FC00FF",
  },
  {
    id: 6,
    name: "Lucas Rocha",
    preview: "Quero marcar pra sábado",
    time: "dom",
    unread: 3,
    color: "#FF2A29",
  },
  {
    id: 7,
    name: "Fernanda L.",
    preview: "Tá bom, obrigada!",
    time: "sáb",
    unread: 0,
    color: "#07FFF5",
  },
  {
    id: 8,
    name: "Rafael S.",
    preview: "Tem vaga pra barba também?",
    time: "sex",
    unread: 0,
    color: "#2FFF40",
  },
  {
    id: 9,
    name: "Thiago M.",
    preview: "Cancelei, desculpa 😅",
    time: "qui",
    unread: 0,
    color: "#FF5000",
  },
  {
    id: 10,
    name: "Bruno Costa",
    preview: "Confirma o horário das 10h?",
    time: "qua",
    unread: 1,
    color: "#0047FF",
  },
  {
    id: 11,
    name: "Isabela F.",
    preview: "Meu namorado vai aí amanhã",
    time: "ter",
    unread: 0,
    color: "#FC00FF",
  },
  {
    id: 12,
    name: "Diego Nunes",
    preview: "Quanto tempo leva o corte?",
    time: "seg",
    unread: 0,
    color: "#8400FF",
  },
];

interface SidebarProps {
  onAddEvent: () => void;
  professionals: Professional[];
  selectedProfessionals: Set<number>;
  onProfessionalToggle: (id: number) => void;
  onAddProfessional: (
    name: string,
    color: string,
  ) => Promise<Professional | null>;
  onDeleteProfessional: (id: number) => void;
  onChangeProfessionalColor: (id: number, color: string) => void;
  onOpenSettings: (professionalId: number) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  mobilePanel?: "professionals" | "conversations" | null;
  onCloseMobilePanel?: () => void;
  externalShowAddModal?: boolean;
  onExternalAddModalClose?: () => void;
}

// ✅ Ícone "+" fixo roxo
const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6B3EFF"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

// ✅ agora são HEX, compatíveis com o restante do app
const COLORS = [
  "#FF2A29",
  "#FF5000",
  "#2FFF40",
  "#07FF99",
  "#07FFF5",
  "#0047FF",
  "#8400FF",
  "#FC00FF",
];

const WORK_DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];
const DURACOES = [15, 20, 30, 45, 60];
const INTERVALOS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2h" },
];

type AgendaFormConfig = Omit<AgendaConfig, "profissional_id" | "atualizado_em">;

const DEFAULT_AGENDA: AgendaFormConfig = {
  dias_semana: [1, 2, 3, 4, 5, 6],
  hora_inicio: "08:00",
  hora_fim: "19:00",
  duracao_min: 60,
  intervalo_inicio: null,
  intervalo_duracao_min: null,
  janela_agendamento_dias: 10,
};

function timeToMins(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(totalMinutes: number) {
  const total = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildSlotPreview(config: AgendaFormConfig) {
  const slots: string[] = [];
  const start = timeToMins(config.hora_inicio);
  const end = timeToMins(config.hora_fim);
  const brkStart = config.intervalo_inicio
    ? timeToMins(config.intervalo_inicio)
    : null;
  const brkEnd =
    brkStart !== null && config.intervalo_duracao_min
      ? brkStart + config.intervalo_duracao_min
      : null;
  let cur = start;
  while (cur + config.duracao_min <= end) {
    const overlaps =
      brkStart !== null &&
      brkEnd !== null &&
      cur < brkEnd &&
      cur + config.duracao_min > brkStart;
    if (!overlaps) slots.push(minsToTime(cur));
    cur += config.duracao_min;
  }
  return slots;
}

const formatConversationTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const toConversation = (
  item: WhatsAppConversation,
  index: number,
): Conversation => {
  const name = item.contact.name || item.contact.phone;
  return {
    id: item.id,
    name,
    preview:
      item.last_message?.body ||
      item.last_message?.message_type ||
      "Mensagem recebida",
    time: formatConversationTime(item.last_message_at),
    unread: item.unread_count ?? 0,
    color: COLORS[index % COLORS.length],
  };
};

const Sidebar: React.FC<SidebarProps> = ({
  onAddEvent,
  professionals,
  selectedProfessionals,
  onProfessionalToggle,
  onAddProfessional,
  onDeleteProfessional,
  onChangeProfessionalColor,
  onOpenSettings,
  currentDate,
  onDateChange,
  mobilePanel = null,
  onCloseMobilePanel,
  externalShowAddModal,
  onExternalAddModalClose,
}) => {
  const {
    currentDate: miniCalDate,
    days: miniCalDays,
    goToNext: miniCalNext,
    goToPrev: miniCalPrev,
  } = useCalendar(currentDate);

  const miniCalWeekdays = useMemo(
    () => ["D", "S", "T", "Q", "Q", "S", "S"],
    [],
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProfName, setNewProfName] = useState("");
  const [newProfColor, setNewProfColor] = useState(COLORS[0]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [newProfId, setNewProfId] = useState<number | null>(null);
  const [agendaConfig, setAgendaConfig] =
    useState<AgendaFormConfig>(DEFAULT_AGENDA);
  const [addingProfLoading, setAddingProfLoading] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [agendaFeedback, setAgendaFeedback] = useState<string | null>(null);

  usePolling(
    async () => {
      const data = await getWhatsAppConversations();
      setConversations(data.map(toConversation));
    },
    { intervalMs: 8000 },
    [],
  );

  useEffect(() => {
    if (externalShowAddModal) setShowAddModal(true);
  }, [externalShowAddModal]);

  const closeAddModal = () => {
    setShowAddModal(false);
    onExternalAddModalClose?.();
    setNewProfName("");
    setNewProfColor(COLORS[0]);
    setAddStep(1);
    setNewProfId(null);
    setAgendaConfig(DEFAULT_AGENDA);
    setAgendaFeedback(null);
  };

  const handleGoToStep2 = async () => {
    if (!newProfName.trim()) return;
    setAddingProfLoading(true);
    try {
      const prof = await onAddProfessional(newProfName.trim(), newProfColor);
      if (!prof) return;
      setNewProfId(prof.id);
      setAddStep(2);
    } finally {
      setAddingProfLoading(false);
    }
  };

  const handleCreateComplete = async () => {
    if (!newProfId) return;
    setAddingSaving(true);
    setAgendaFeedback(null);
    try {
      await updateAgendaConfig(newProfId, {
        ...agendaConfig,
        dias_semana: agendaConfig.dias_semana.filter((d) => d !== 0),
      });
      closeAddModal();
    } catch {
      setAgendaFeedback("Erro ao salvar agenda. Tente novamente.");
      setTimeout(() => setAgendaFeedback(null), 3000);
    } finally {
      setAddingSaving(false);
    }
  };

  const toggleAgendaDia = (d: number) => {
    setAgendaConfig((prev) => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(d)
        ? prev.dias_semana.filter((x) => x !== d)
        : [...prev.dias_semana, d].sort((a, b) => a - b),
    }));
  };

  const toggleMenu = (id: number) =>
    setOpenMenuId(openMenuId === id ? null : id);

  const handleDelete = (id: number) => {
    onDeleteProfessional(id);
    setOpenMenuId(null);
  };

  const handleColorChange = (id: number, color: string) => {
    onChangeProfessionalColor(id, color);
    setShowColorPicker(null);
    setOpenMenuId(null);
  };

  // ✅ Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const dropdown = document.querySelector(".menu-dropdown");
      if (dropdown && !dropdown.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside
      className={
        mobilePanel
          ? "fixed inset-0 z-50 bg-[#1c1c1c] flex flex-col"
          : "hidden md:flex w-72 pt-8 pb-4 px-4 bg-[#1c1c1c] flex-col gap-6 min-h-0"
      }
    >
      {/* Header no modo mobile panel */}
      {mobilePanel && (
        <div
          className="flex items-center gap-3 px-4 pb-4 border-b border-white/10 flex-shrink-0"
          style={{ paddingTop: "max(3.5rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={onCloseMobilePanel}
            className="rounded-xl p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-base font-semibold text-white">
            {mobilePanel === "professionals" ? "Equipe" : "Conversas"}
          </h2>
          {mobilePanel === "professionals" && (
            <button
              onClick={() => setShowAddModal(true)}
              aria-label="Adicionar profissional"
              className="ml-auto rounded-xl p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Botão "Create" - apenas no desktop */}
      {!mobilePanel && (
        <button
          onClick={onAddEvent}
          className="mt-2 flex w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_4px_14px_rgba(0,0,0,0.30)] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <PlusIcon />
          <span className="ml-2">Criar</span>
        </button>
      )}

      {/* Mini Calendar - apenas no desktop */}
      {!mobilePanel && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-200">
              {miniCalDate.toLocaleString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div className="flex items-center space-x-1">
              <button
                onClick={miniCalPrev}
                aria-label="Mês anterior"
                className="rounded-xl p-1 text-gray-400 hover:bg-[#5f6368] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={miniCalNext}
                aria-label="Próximo mês"
                className="rounded-xl p-1 text-gray-400 hover:bg-[#5f6368] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-gray-400">
            {miniCalWeekdays.map((day, index) => (
              <div
                key={index}
                className="w-8 h-8 flex items-center justify-center"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 mt-1 text-xs">
            {miniCalDays.map((day, index) => (
              <button
                key={index}
                onClick={() => onDateChange(new Date(day.date + "T00:00:00"))}
                className={`w-8 h-8 flex items-center justify-center rounded-full
                  ${!day.isCurrentMonth ? "text-gray-600" : "text-gray-200"}
                  ${day.isToday ? "bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF66]" : ""}
                  ${
                    !day.isToday &&
                    new Date(day.date + "T00:00:00").toDateString() ===
                      currentDate.toDateString()
                      ? "bg-gray-700"
                      : ""
                  }`}
              >
                {new Date(day.date + "T00:00:00").getDate()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Professionals */}
      {(!mobilePanel || mobilePanel === "professionals") && (
        <div
          className={
            mobilePanel === "professionals"
              ? "flex-1 min-h-0 overflow-y-auto px-4 py-4"
              : ""
          }
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-300 text-sm font-medium">Profissionais</h3>
            <button
              onClick={() => setShowAddModal(true)}
              aria-label="Adicionar profissional"
              className="rounded-xl p-1 text-gray-400 transition hover:bg-[#3c4043] hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>

          <ul className="space-y-2">
            {professionals.map((prof) => (
              <li
                key={prof.id}
                className="flex items-center justify-between relative"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`prof-${prof.id}`}
                    checked={selectedProfessionals.has(prof.id)}
                    onChange={() => onProfessionalToggle(prof.id)}
                    className="w-4 h-4 rounded focus:ring-[#6B3EFF]"
                    style={{
                      accentColor: prof.color.startsWith("#")
                        ? prof.color
                        : undefined,
                    }}
                  />
                  <label
                    htmlFor={`prof-${prof.id}`}
                    className="ml-2 text-sm text-gray-300"
                  >
                    {prof.name}
                  </label>
                </div>

                <div className="relative">
                  <button
                    onClick={() => toggleMenu(prof.id)}
                    aria-label={`Opções de ${prof.name}`}
                    className="rounded-xl p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {openMenuId === prof.id && (
                      <motion.div
                        role="menu"
                        className="menu-dropdown absolute left-1/2 translate-x-2 mt-1 w-48 bg-[#2a2a2a]/60 backdrop-blur-md border border-white/10 text-sm rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] z-20 overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                      >
                        <button
                          role="menuitem"
                          onClick={() => {
                            onOpenSettings(prof.id);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-200 transition hover:bg-white/10"
                        >
                          <Settings size={16} />
                          <span>Configurar agenda</span>
                        </button>

                        <button
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(prof.id);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-200 transition hover:bg-white/10"
                        >
                          <PaintBucket size={16} />
                          <span>Alterar cor</span>
                        </button>

                        <button
                          role="menuitem"
                          onClick={() => handleDelete(prof.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-200 transition hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                          <span>Excluir profissional</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conversas WhatsApp */}
      {(!mobilePanel || mobilePanel === "conversations") && (
        <div
          className={`flex-1 min-h-0 flex flex-col${mobilePanel === "conversations" ? " px-4 pt-4" : ""}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-300 text-sm font-medium flex items-center gap-1.5">
              <MessageCircle size={14} className="text-[#25D366]" />
              Conversas
            </h3>
            {conversations.filter((c) => c.unread > 0).length > 0 && (
              <span className="min-w-4 h-4 rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white flex items-center justify-center">
                {conversations.filter((c) => c.unread > 0).length}
              </span>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-1 -mx-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {conversations.length === 0 && (
              <div className="px-2 py-3 text-xs leading-relaxed text-white/35">
                Nenhuma conversa espelhada ainda.
              </div>
            )}

            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  const isOpening = selectedConv?.id !== conv.id;
                  setSelectedConv(isOpening ? conv : null);

                  // Só marca como lida ao ABRIR (não ao fechar) e se tiver não-lidas
                  if (isOpening && conv.unread > 0) {
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === conv.id ? { ...c, unread: 0 } : c,
                      ),
                    );
                    markWhatsAppConversationAsRead(conv.id).catch((err) => {
                      console.error("Erro ao marcar conversa como lida:", err);
                    });
                  }
                }}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ backgroundColor: conv.color }}
                >
                  {conv.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span
                      className={`text-[13px] truncate ${conv.unread > 0 ? "font-semibold text-white" : "font-medium text-gray-300"}`}
                    >
                      {conv.name}
                    </span>
                    <span className="text-[11px] flex-shrink-0 text-white/35">
                      {conv.time}
                    </span>
                  </div>
                  <p
                    className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? "text-white/70" : "text-white/40"}`}
                  >
                    {conv.preview}
                  </p>
                </div>

                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedConv && (
        <WhatsAppPanel
          conversation={selectedConv}
          onClose={() => setSelectedConv(null)}
        />
      )}

      {/* Modal de "Novo profissional" - multi-step */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            key="add-prof-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeAddModal}
          >
            <motion.div
              layout
              className="w-full max-w-lg rounded-2xl overflow-hidden bg-[#1e1f24] border border-white/10 shadow-2xl"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence mode="wait" initial={false}>
                {addStep === 1 ? (
                  <motion.div
                    key="step-1"
                    className="p-6"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {/* Step 1 header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#6B3EFF]/15 flex-shrink-0">
                          <UserPlus size={16} className="text-[#8b5cf6]" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white leading-tight">
                            Novo profissional
                          </h3>
                          <p className="text-xs text-white/40 mt-0.5">
                            Preencha os dados abaixo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-1.5 bg-[#6B3EFF] rounded-full" />
                        <div className="w-2 h-1.5 bg-white/15 rounded-full" />
                      </div>
                    </div>

                    {/* Nome */}
                    <div className="mb-5">
                      <label className="block text-xs font-medium text-white/70 mb-1.5">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={newProfName}
                        onChange={(e) => setNewProfName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleGoToStep2();
                          if (e.key === "Escape") closeAddModal();
                        }}
                        placeholder="Ex: Lucas Costa"
                        autoFocus
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30
                                   bg-[#111114] border border-white/10
                                   focus:outline-none focus:border-[#8b5cf6]/60 focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/20
                                   transition-all duration-200"
                      />
                    </div>

                    {/* Cor */}
                    <div className="mb-6">
                      <label className="block text-xs font-medium text-white/70 mb-2.5">
                        Cor
                      </label>
                      <div className="flex gap-2.5 flex-wrap">
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewProfColor(color)}
                            aria-label={`Cor ${color}`}
                            aria-pressed={newProfColor === color}
                            className="w-7 h-7 rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            style={{
                              backgroundColor: color,
                              transform:
                                newProfColor === color
                                  ? "scale(1.2)"
                                  : undefined,
                              boxShadow:
                                newProfColor === color
                                  ? `0 0 0 2px #1e1f24, 0 0 0 3.5px ${color}`
                                  : undefined,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Ações step 1 */}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeAddModal}
                        className="rounded-xl px-4 py-2 text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-200 focus-visible:outline-none"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleGoToStep2}
                        disabled={!newProfName.trim() || addingProfLoading}
                        className="rounded-xl px-5 py-2 text-sm font-semibold text-white
                                   bg-[#6B3EFF] hover:bg-[#825CFF]
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-all duration-200
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/50"
                        style={{
                          boxShadow: newProfName.trim()
                            ? "0 4px 16px rgba(107,62,255,0.45)"
                            : undefined,
                        }}
                      >
                        {addingProfLoading ? "Criando..." : "Próximo →"}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-2"
                    className="p-6"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {/* Step 2 header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#6B3EFF]/15 flex-shrink-0">
                          <Settings size={16} className="text-[#8b5cf6]" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-white leading-tight">
                            Configurar agenda
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: newProfColor }}
                            />
                            <span className="text-xs text-white/40">
                              {newProfName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-1.5 bg-[#6B3EFF]/40 rounded-full" />
                        <div className="w-5 h-1.5 bg-[#6B3EFF] rounded-full" />
                      </div>
                    </div>

                    {/* Agenda form */}
                    <div
                      className="space-y-4 max-h-[calc(90vh-240px)] overflow-y-auto pr-1
                                  [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full
                                  [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:transparent"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(255,255,255,0.1) transparent",
                      }}
                    >
                      {/* Dias da semana */}
                      <div>
                        <p className="text-xs text-white/60 mb-2">
                          Dias de trabalho
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {WORK_DAYS.map((dia) => (
                            <button
                              key={dia.value}
                              onClick={() => toggleAgendaDia(dia.value)}
                              aria-pressed={agendaConfig.dias_semana.includes(
                                dia.value,
                              )}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                                ${
                                  agendaConfig.dias_semana.includes(dia.value)
                                    ? "bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]"
                                    : "bg-white/5 text-white/50 hover:bg-white/10"
                                }`}
                            >
                              {dia.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Horários */}
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-white/60 mb-2">Início</p>
                          <TimeSelect
                            label="Horário de início do expediente"
                            value={agendaConfig.hora_inicio}
                            onChange={(v) =>
                              setAgendaConfig((p) => ({ ...p, hora_inicio: v }))
                            }
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-white/60 mb-2">Fim</p>
                          <TimeSelect
                            label="Horário de término do expediente"
                            value={agendaConfig.hora_fim}
                            onChange={(v) =>
                              setAgendaConfig((p) => ({ ...p, hora_fim: v }))
                            }
                          />
                        </div>
                      </div>

                      {/* Intervalo de descanso */}
                      <div
                        className={`space-y-3 rounded-xl border p-3 transition-colors ${
                          Boolean(
                            agendaConfig.intervalo_inicio &&
                            agendaConfig.intervalo_duracao_min,
                          )
                            ? "border-[#6B3EFF]/30 bg-[#6B3EFF]/[0.04]"
                            : "border-white/10 bg-white/[0.025]"
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              agendaConfig.intervalo_inicio &&
                              agendaConfig.intervalo_duracao_min,
                            )}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setAgendaConfig((p) => ({
                                ...p,
                                intervalo_inicio: enabled
                                  ? (p.intervalo_inicio ?? "12:00")
                                  : null,
                                intervalo_duracao_min: enabled
                                  ? (p.intervalo_duracao_min ?? 60)
                                  : null,
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div
                            className="relative w-9 h-5 flex-shrink-0 rounded-full transition-colors
                            bg-white/10 peer-checked:bg-[#6B3EFF]/70
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                            after:h-4 after:w-4 after:rounded-full after:transition-all after:duration-200
                            after:bg-white/40 peer-checked:after:translate-x-4 peer-checked:after:bg-white"
                          />
                          <span className="text-sm text-white/85">
                            Intervalo de descanso
                          </span>
                        </label>

                        {agendaConfig.intervalo_inicio &&
                          agendaConfig.intervalo_duracao_min && (
                            <>
                              <div className="flex gap-4">
                                <div className="w-32">
                                  <p className="text-xs text-white/60 mb-2">
                                    Início
                                  </p>
                                  <TimeSelect
                                    label="Início do intervalo de descanso"
                                    value={
                                      agendaConfig.intervalo_inicio ?? "12:00"
                                    }
                                    onChange={(v) =>
                                      setAgendaConfig((p) => ({
                                        ...p,
                                        intervalo_inicio: v,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-white/60 mb-2">
                                    Duração
                                  </p>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {INTERVALOS.map((intervalo) => (
                                      <button
                                        key={intervalo.value}
                                        onClick={() =>
                                          setAgendaConfig((p) => ({
                                            ...p,
                                            intervalo_duracao_min:
                                              intervalo.value,
                                          }))
                                        }
                                        aria-pressed={
                                          agendaConfig.intervalo_duracao_min ===
                                          intervalo.value
                                        }
                                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                                        ${
                                          agendaConfig.intervalo_duracao_min ===
                                          intervalo.value
                                            ? "bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]"
                                            : "bg-white/5 text-white/50 hover:bg-white/10"
                                        }`}
                                      >
                                        {intervalo.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-white/40">
                                Descanso: {agendaConfig.intervalo_inicio} até{" "}
                                {minsToTime(
                                  timeToMins(agendaConfig.intervalo_inicio) +
                                    agendaConfig.intervalo_duracao_min,
                                )}
                              </p>
                            </>
                          )}
                      </div>

                      {/* Duração por atendimento */}
                      <div>
                        <p className="text-xs text-white/50 mb-2 flex items-center gap-1">
                          <Clock size={12} />
                          Duração por atendimento
                        </p>
                        <div className="flex gap-1.5">
                          {DURACOES.map((d) => (
                            <button
                              key={d}
                              onClick={() =>
                                setAgendaConfig((p) => ({
                                  ...p,
                                  duracao_min: d,
                                }))
                              }
                              aria-pressed={agendaConfig.duracao_min === d}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                                ${
                                  agendaConfig.duracao_min === d
                                    ? "bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]"
                                    : "bg-white/5 text-white/50 hover:bg-white/10"
                                }`}
                            >
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Abertura da agenda */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-white/50">
                              Agenda aberta por
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {agendaConfig.janela_agendamento_dias} dias
                            </p>
                          </div>
                          <span className="rounded-full bg-[#6B3EFF]/20 px-2.5 py-1 text-xs font-semibold text-[#c9b8ff]">
                            {agendaConfig.janela_agendamento_dias === 7
                              ? "Mínimo"
                              : agendaConfig.janela_agendamento_dias === 15
                                ? "Máximo"
                                : "Personalizado"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={7}
                          max={15}
                          step={1}
                          value={agendaConfig.janela_agendamento_dias}
                          aria-label="Dias de abertura da agenda"
                          onChange={(e) =>
                            setAgendaConfig((p) => ({
                              ...p,
                              janela_agendamento_dias: Number(e.target.value),
                            }))
                          }
                          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#6B3EFF]
                                     [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                                     [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(107,62,255,0.35),0_0_18px_rgba(107,62,255,0.55)]
                                     [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
                                     [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
                          style={{
                            background: `linear-gradient(to right, #6B3EFF 0%, #6B3EFF ${
                              ((agendaConfig.janela_agendamento_dias - 7) / 8) *
                              100
                            }%, rgba(255,255,255,0.1) ${
                              ((agendaConfig.janela_agendamento_dias - 7) / 8) *
                              100
                            }%, rgba(255,255,255,0.1) 100%)`,
                          }}
                        />
                        <div className="relative mt-2 h-4 text-[10px] font-medium text-white/35">
                          <span className="absolute left-0 top-0">7 dias</span>
                          <span
                            className="absolute top-0 -translate-x-1/2"
                            style={{ left: "37.5%" }}
                          >
                            10 dias
                          </span>
                          <span className="absolute right-0 top-0">
                            15 dias
                          </span>
                        </div>
                      </div>

                      {/* Slots preview */}
                      <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-xs text-white/55 mb-1.5">
                          Slots gerados
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {buildSlotPreview(agendaConfig).map((s) => (
                            <span
                              key={s}
                              className="text-xs text-white/65 bg-white/[0.08] px-2 py-0.5 rounded-lg"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer step 2 */}
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.08]">
                      {agendaFeedback ? (
                        <span className="text-xs text-red-400">
                          {agendaFeedback}
                        </span>
                      ) : (
                        <div />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={closeAddModal}
                          className="rounded-xl px-4 py-2 text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.07] transition-all duration-200 focus-visible:outline-none"
                        >
                          Pular
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateComplete}
                          disabled={addingSaving}
                          className="rounded-xl px-5 py-2 text-sm font-semibold text-white
                                     bg-[#6B3EFF] hover:bg-[#825CFF]
                                     disabled:opacity-40 disabled:cursor-not-allowed
                                     transition-all duration-200
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/50"
                          style={{
                            boxShadow: "0 4px 16px rgba(107,62,255,0.45)",
                          }}
                        >
                          {addingSaving ? "Salvando..." : "Concluir"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Picker */}
      {showColorPicker && (
        <div
          className="fixed inset-0 bg-black/15 backdrop-blur-[2px] flex items-center justify-center z-50"
          onClick={() => setShowColorPicker(null)}
        >
          <div
            className="rounded-2xl bg-[#28292d] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(showColorPicker, color)}
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
