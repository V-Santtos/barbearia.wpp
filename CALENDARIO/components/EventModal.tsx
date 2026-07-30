// =====================
//  EVENT MODAL - V3 FINAL (ROXO CORRIGIDO)
// =====================

import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import type { Event, Professional } from "../types";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { getAgendaConfig, getConfiguredServices, type AgendaConfig, type ConfiguredService } from "../services/calendarApi";
import cardBgTexture from "../assets/4b5627d79bc66c97c95c39ec56cdaf20.jpg";

export interface EventModalHandles {
  deleteCurrent: () => void;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<Event, "id"> & { id?: number }) => void;
  onDelete: (eventId: number) => void;
  selectedDate: string | null;
  professionals: Professional[];
  eventToEdit: Event | null;
}

// ======================
//  TEXTURA — GLOWING CARD (ravikatiyar style)
// ======================
const CARD_TEXTURE = [
  `linear-gradient(rgba(10,10,14,0.70), rgba(10,10,14,0.70))`,
  `url(${cardBgTexture})`,
].join(", ");

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SCROLLBAR_CLASS =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#101014] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6B3EFF]/45 hover:[&::-webkit-scrollbar-thumb]:bg-[#6B3EFF]/65";

const PHONE_LINE_RE = /Telefone:\s*([^\n]+)/i;
const SERVICE_LINE_RE = /Servi[cç]o:\s*([^\n]+)/i;
const NOTES_LINE_RE = /(?:Anota[cç][ãa]o|Observa[cç][õo]es):\s*([\s\S]+)/i;

function hasFirstAndLastName(value: string) {
  return value.trim().split(/\s+/).length >= 2;
}

function getPhoneDigitsFromDescription(value: string) {
  const match = value.match(PHONE_LINE_RE);
  return match ? match[1].replace(/\D/g, "") : "";
}

function getLineValue(value: string, regex: RegExp) {
  const match = value.match(regex);
  return match ? match[1].trim() : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPhoneValue(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, 11);
  if (!clean) return "";
  if (clean.length <= 2) return `(${clean}`;

  const area = clean.slice(0, 2);
  const rest = clean.slice(2);
  const prefixLength = clean.length > 10 ? 5 : 4;
  const prefix = rest.slice(0, prefixLength);
  const suffix = rest.slice(prefixLength);

  return `(${area}) ${prefix}${suffix ? `-${suffix}` : ""}`;
}

function composeDescription(phone: string, service: string, notes: string) {
  return [
    phone ? `Telefone: ${phone}` : null,
    service.trim() ? `Serviço: ${service.trim()}` : null,
    notes.trim() ? `Anotação: ${notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const EventModal = forwardRef<EventModalHandles, EventModalProps>(
  (
    {
      isOpen,
      onClose,
      onSave,
      onDelete,
      selectedDate,
      professionals,
      eventToEdit,
    },
    ref
  ) => {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [phone, setPhone] = useState("");
    const [service, setService] = useState("");
    const [notes, setNotes] = useState("");
    const [serviceOptions, setServiceOptions] = useState<ConfiguredService[]>([]);
    const [professionalId, setProfessionalId] = useState<number>(
      professionals[0]?.id || 1
    );
    const [error, setError] = useState("");

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [isEndOpen, setIsEndOpen] = useState(false);
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isServiceOpen, setIsServiceOpen] = useState(false);
    const [agendaConfig, setAgendaConfig] = useState<AgendaConfig | null>(null);

    const prefersReducedMotion = useReducedMotion();
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const serviceInputRef = useRef<HTMLInputElement | null>(null);
    const notesInputRef = useRef<HTMLInputElement | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
      if (!isOpen) return;
      previousFocusRef.current = document.activeElement as HTMLElement;
      return () => { previousFocusRef.current?.focus(); };
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          closeAllDropdowns();
          onClose();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    useEffect(() => {
      if (!isOpen) return;

      if (eventToEdit) {
        const nextDescription = eventToEdit.description || "";
        setTitle(eventToEdit.title);
        setDate(eventToEdit.date);
        setStartTime(eventToEdit.startTime);
        setEndTime(eventToEdit.endTime);
        setPhone(formatPhoneValue(getPhoneDigitsFromDescription(nextDescription)));
        setService(getLineValue(nextDescription, SERVICE_LINE_RE));
        setNotes(getLineValue(nextDescription, NOTES_LINE_RE));
        setProfessionalId(eventToEdit.professionalId);
        setError("");

        setTimeout(() => titleInputRef.current?.focus(), 0);
      } else {
        resetForm();
        setTimeout(() => titleInputRef.current?.focus(), 0);
      }
    }, [isOpen, eventToEdit, selectedDate]);

    useEffect(() => {
      if (!isOpen || !professionalId) return;
      getAgendaConfig(professionalId).then(setAgendaConfig).catch(() => setAgendaConfig(null));
    }, [isOpen, professionalId]);

    useEffect(() => {
      if (!isOpen) return;
      let cancelled = false;

      getConfiguredServices()
        .then((items) => {
          if (!cancelled) setServiceOptions(items);
        })
        .catch(() => {
          if (!cancelled) setServiceOptions([]);
        });

      return () => {
        cancelled = true;
      };
    }, [isOpen]);

    const resetForm = () => {
      setTitle("");
      setPhone("");
      setService("");
      setNotes("");
      setError("");
      setProfessionalId(professionals[0]?.id || 1);

      if (selectedDate) {
        setDate(selectedDate);
      } else {
        const today = new Date().toLocaleDateString("en-CA");
        setDate(today);
      }

      setStartTime("09:00");
      setEndTime("10:00");
    };

    const closeAllDropdowns = () => {
      setIsDropdownOpen(false);
      setIsDateOpen(false);
      setIsStartOpen(false);
      setIsEndOpen(false);
      setIsServiceOpen(false);
    };

    /*
    const handleDescriptionFocus = () => {
      if (description.trim()) return;
      setDescription("Telefone: ");
      window.setTimeout(() => {
        const textarea = descriptionRef.current;
        if (!textarea) return;
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }, 0);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = normalizeDescriptionInput(e.target.value);
      setDescription(next);
      if (error) setError("");

      window.requestAnimationFrame(() => {
        const textarea = descriptionRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      });
    };

    const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;

      const textarea = e.currentTarget;
      const cursor = textarea.selectionStart;
      const lineIndex = textarea.value.slice(0, cursor).split("\n").length - 1;

      if (lineIndex === 0) {
        const phoneDigits = getPhoneDigitsFromDescription(textarea.value);
        if (phoneDigits.length < 10) {
          e.preventDefault();
          setError("Complete o telefone antes de avançar.");
          return;
        }

        e.preventDefault();
        if (!textarea.value.includes("\nServico:")) {
          setDescription(`${textarea.value}\nServico: `);
        }
        window.setTimeout(() => {
          const end = descriptionRef.current?.value.length ?? 0;
          descriptionRef.current?.setSelectionRange(end, end);
        }, 0);
      }

      if (lineIndex === 1) {
        e.preventDefault();
        if (!textarea.value.includes("\nObservacoes:")) {
          setDescription(`${textarea.value}\nObservacoes: `);
        }
        window.setTimeout(() => {
          const end = descriptionRef.current?.value.length ?? 0;
          descriptionRef.current?.setSelectionRange(end, end);
        }, 0);
      }
    };

    */

    const handlePhoneChange = (value: string) => {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      setPhone(formatPhoneValue(digits));
      if (error) setError("");

      if (digits.length === 11) {
        window.setTimeout(() => serviceInputRef.current?.focus(), 0);
      }
    };

    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;

      e.preventDefault();
      if (phone.replace(/\D/g, "").length < 10) {
        setError("Complete o telefone antes de avançar.");
        return;
      }
      serviceInputRef.current?.focus();
    };

    const handleServiceKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (serviceOptions.length > 0 && service.trim()) {
        const exact = serviceOptions.find(
          (option) => normalizeText(option.name) === normalizeText(service)
        );
        const selected = exact ?? filteredServiceOptions[0];
        if (selected) setService(selected.name);
      }
      setIsServiceOpen(false);
      notesInputRef.current?.focus();
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!title || !date || !startTime || !endTime || !professionalId) {
        setError("Por favor, preencha todos os campos obrigatórios.");
        return;
      }

      if (!hasFirstAndLastName(title)) {
        setError("Informe nome e sobrenome do cliente.");
        return;
      }

      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        setError("Informe um telefone válido.");
        return;
      }

      if (
        service &&
        serviceOptions.length > 0 &&
        !serviceOptions.some((option) => option.name === service)
      ) {
        setError("Selecione um serviço configurado na base.");
        return;
      }

      onSave({
        id: eventToEdit?.id,
        title: title.trim(),
        date,
        startTime,
        endTime,
        description: composeDescription(phone, service, notes),
        professionalId,
      });

      closeAllDropdowns();
    };

    const handleDeleteInternal = () => {
      if (eventToEdit) {
        onDelete(eventToEdit.id);
        closeAllDropdowns();
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        deleteCurrent: handleDeleteInternal,
      }),
      [eventToEdit]
    );

    if (!isOpen) return null;

    const selectedProfessional = professionals.find(
      (p) => p.id === professionalId
    );
    const filteredServiceOptions = serviceOptions
      .filter((option) =>
        service.trim()
          ? normalizeText(option.name).includes(normalizeText(service))
          : false
      )
      .slice(0, 6);

    const currentSelectedDate = date ? new Date(date + "T12:00:00") : new Date();
    const currentYear = currentSelectedDate.getFullYear();
    const currentMonth = currentSelectedDate.getMonth();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthName = currentSelectedDate.toLocaleString("default", { month: "long" });
    const modalDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // CAMPOS
    const fieldClass =
      "w-full rounded-xl p-3 text-white placeholder:text-white/60 " +
      "bg-[#191919] border-2 border-[#8b5cf6]/80 " +
      "focus:outline-none focus:border-[#8b5cf6] focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/20 " +
      "shadow-[inset_0_1px_4px_rgba(255,255,255,0.05),inset_0_-1px_4px_rgba(0,0,0,0.6)] " +
      "transition-all duration-200";

    return (
      <AnimatePresence>
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0"
          style={{
            overscrollBehavior: 'contain',
            backgroundColor: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAllDropdowns();
              onClose();
            }
          }}
        >
          <motion.div
            ref={cardRef}
            key="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            className="relative w-full max-w-md overflow-visible rounded-3xl text-white"
            style={{
              backgroundImage: CARD_TEXTURE,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: [
                "0 32px 72px rgba(0,0,0,0.85)",
                "0 8px 24px rgba(0,0,0,0.55)",
                "inset 0 0 80px rgba(0,0,0,0.55)",
                "inset 60px 0 80px rgba(0,0,0,0.40)",
                "inset -60px 0 80px rgba(0,0,0,0.40)",
              ].join(", "),
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: "easeOut" }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key !== 'Tab') return;
              const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SEL) ?? []);
              if (!focusable.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
              } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
              }
            }}
          >
            {/* RAY — glow central vindo do topo */}
            <div aria-hidden="true" style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '380px', height: '160px', pointerEvents: 'none', zIndex: 0,
              borderTopLeftRadius: 'inherit',
              borderTopRightRadius: 'inherit',
              background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.036) 44%, transparent 72%)',
            }} />


            {/* CONTEÚDO */}
            <div className="relative z-10 px-8 pt-8 pb-10">
              <h2 id="event-modal-title" className="mb-5 text-center text-2xl font-semibold tracking-wide text-white" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.8), 0 0 32px rgba(0,0,0,0.6)" }}>
                {eventToEdit ? "Editar Evento" : "Criar Evento"}
              </h2>
              <div aria-hidden="true" className="mb-6 h-px w-full" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)" }} />

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nome */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Nome Completo
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    name="title"
                    autoComplete="name"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (error) setError("");
                    }}
                    className={fieldClass}
                    placeholder="Nome e sobrenome"
                    required
                  />
                </div>

                {/* Profissional */}
                <div className="relative">
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Profissional
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isDropdownOpen;
                      closeAllDropdowns();
                      setIsDropdownOpen(next);
                    }}
                    className={"flex w-full items-center justify-between gap-2 " + fieldClass}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={
                          selectedProfessional?.color?.startsWith("#")
                            ? { backgroundColor: selectedProfessional.color }
                            : undefined
                        }
                      />
                      {selectedProfessional
                        ? selectedProfessional.name
                        : "Selecionar"}
                    </div>
                    <ChevronDown size={16} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 text-sm text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                        style={{ backgroundColor: "#1c1c1c" }}
                      >
                        <div className={`max-h-60 overflow-y-auto ${SCROLLBAR_CLASS}`}>
                          {professionals.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProfessionalId(p.id);
                                setIsDropdownOpen(false);
                              }}
                              className={`flex items-center gap-2 w-full px-3 py-2 text-left transition hover:bg-white/10 ${
                                professionalId === p.id ? "bg-white/10" : ""
                              }`}
                            >
                              <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={
                                  p.color?.startsWith("#")
                                    ? { backgroundColor: p.color }
                                    : undefined
                                }
                              />
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Data */}
                <div className="relative">
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Data
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !isDateOpen;
                      closeAllDropdowns();
                      setIsDateOpen(next);
                    }}
                    className={"flex w-full items-center justify-between " + fieldClass}
                  >
                    {date
                      ? new Date(date + "T00:00:00").toLocaleDateString("en-GB")
                      : "Selecionar data"}
                    <ChevronDown size={16} />
                  </button>

                  <AnimatePresence>
                    {isDateOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 p-3 text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                        style={{ backgroundColor: "#1c1c1c" }}
                      >
                        <div className="mb-2 text-center text-xs text-white/70 capitalize">
                          {monthName} {currentYear}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                          {modalDays.map((d) => {
                            const dayNum = d.toString().padStart(2, "0");
                            const dateValue = `${currentYear}-${(
                              currentMonth + 1
                            )
                              .toString()
                              .padStart(2, "0")}-${dayNum}`;
                            const isSelected = date === dateValue;

                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  setDate(dateValue);
                                  setTimeout(() => setIsDateOpen(false), 120);
                                }}
                                className={`rounded-xl p-2 transition ${
                                  isSelected
                                    ? "bg-[#8b5cf6] text-white"
                                    : "text-white/90 hover:bg-white/10"
                                }`}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Início / Término */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "Início",
                      state: startTime,
                      setter: setStartTime,
                      open: isStartOpen,
                      setOpen: setIsStartOpen,
                    },
                    {
                      label: "Término",
                      state: endTime,
                      setter: setEndTime,
                      open: isEndOpen,
                      setOpen: setIsEndOpen,
                    },
                  ].map(({ label, state, setter, open, setOpen }) => (
                    <div key={label} className="relative">
                      <label className="mb-1 ml-1 block text-sm font-medium text-white">
                        {label}
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !open;
                          closeAllDropdowns();
                          setOpen(next);
                        }}
                        className={"flex w-full items-center justify-between " + fieldClass}
                      >
                        {state || "Selecionar"}
                        <ChevronDown size={16} />
                      </button>

                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 text-sm text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                            style={{ backgroundColor: "#1c1c1c" }}
                          >
                            <div className={`max-h-60 overflow-y-auto ${SCROLLBAR_CLASS}`}>
                              {(() => {
                                const startH = agendaConfig
                                  ? parseInt(agendaConfig.hora_inicio.split(':')[0], 10)
                                  : 8;
                                const endH = agendaConfig
                                  ? parseInt(agendaConfig.hora_fim.split(':')[0], 10)
                                  : 19;
                                const slots: string[] = [];
                                for (let h = startH; h <= endH; h++) {
                                  for (const m of ['00', '30']) {
                                    const totalMin = h * 60 + parseInt(m, 10);
                                    const endMin = endH * 60 + parseInt(agendaConfig?.hora_fim.split(':')[1] ?? '0', 10);
                                    if (totalMin <= endMin) slots.push(`${h.toString().padStart(2, '0')}:${m}`);
                                  }
                                }
                                return slots.map((time) => {
                                  const isSel = state === time;
                                  return (
                                    <button
                                      key={time}
                                      type="button"
                                      onClick={() => {
                                        setter(time);
                                        setOpen(false);
                                      }}
                                      className={`w-full px-3 py-2 text-left transition hover:bg-white/10 ${
                                        isSel ? "bg-white/10" : ""
                                      }`}
                                    >
                                      {time}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {/* Descrição */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Descrição
                  </label>

                  <div className={`${fieldClass} space-y-1.5 overflow-visible py-3`}>
                    <div className="flex items-center gap-2">
                      <span className="w-[92px] shrink-0 text-sm font-semibold text-[#a78bfa]">
                        Telefone:
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onKeyDown={handlePhoneKeyDown}
                        placeholder="(33) 99999-9999"
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="relative flex items-center gap-2">
                      <span className="w-[92px] shrink-0 text-sm font-semibold text-[#a78bfa]">
                        Serviço:
                      </span>
                      <input
                        ref={serviceInputRef}
                        type="text"
                        value={service}
                        onFocus={() => {
                          if (serviceOptions.length > 0 && service.trim()) setIsServiceOpen(true);
                        }}
                        onChange={(e) => {
                          setService(e.target.value);
                          setIsServiceOpen(serviceOptions.length > 0 && Boolean(e.target.value.trim()));
                          if (error) setError("");
                        }}
                        onKeyDown={handleServiceKeyDown}
                        placeholder="opcional"
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                      />
                      <ChevronDown
                        size={13}
                        className={`shrink-0 text-white/35 transition-transform duration-150 ${
                          isServiceOpen ? "rotate-180" : ""
                        }`}
                      />

                      <AnimatePresence>
                        {isServiceOpen && serviceOptions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-[100px] right-0 top-7 z-[80] overflow-hidden rounded-xl border border-white/10 text-sm text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                            style={{ backgroundColor: "#1c1c1c" }}
                          >
                            <div className={`max-h-48 overflow-y-auto ${SCROLLBAR_CLASS}`}>
                              {filteredServiceOptions.length > 0 ? (
                                filteredServiceOptions.map((option) => (
                                  <button
                                    key={option.slug ?? option.id ?? option.name}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setService(option.name);
                                      setIsServiceOpen(false);
                                      notesInputRef.current?.focus();
                                    }}
                                    className={`w-full px-3 py-2 text-left transition hover:bg-white/10 ${
                                      service === option.name ? "bg-white/10" : ""
                                    }`}
                                  >
                                    <span className="block truncate">{option.name}</span>
                                    {option.price && (
                                      <span className="text-[11px] text-white/35">{option.price}</span>
                                    )}
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-xs text-white/35">
                                  Nenhum serviço encontrado
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-[92px] shrink-0 text-sm font-semibold text-[#a78bfa]">
                        Anotação:
                      </span>
                      <input
                        ref={notesInputRef}
                        type="text"
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="opcional"
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-400">{error}</p>
                )}

                {/* Botões */}
                <div className="mt-6 flex items-center justify-between">
                  <div>
                    {eventToEdit && (
                      <button
                        type="button"
                        onClick={handleDeleteInternal}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/45 transition-all duration-200 hover:border-red-500/45 hover:bg-red-500/10 hover:text-red-200"
                      >
                        Excluir
                      </button>
                    )}
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        closeAllDropdowns();
                        onClose();
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-white/50 transition-all duration-200 hover:text-white/80"
                    >
                      Cancelar
                    </button>

                    {/* ============================
                        BOTÃO ROXO CORRIGIDO
                    ============================= */}
                    <button
                      type="submit"
                      className="
                        rounded-xl 
                        bg-[#6a3dff] 
                        px-5 py-2 
                        text-sm font-medium text-white 
                        shadow-[0_0_14px_rgba(106,61,255,0.45)] 
                        transition-all duration-200 
                        hover:bg-[#5b2ee6]
                      "
                    >
                      Salvar
                    </button>

                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
);

EventModal.displayName = "EventModal";
export default EventModal;
