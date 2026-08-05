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
import { getAgendaConfig, getAvailableSlots, getConfiguredServices, type AgendaConfig, type ConfiguredService } from "../services/calendarApi";
import cardBgTexture from "../assets/4b5627d79bc66c97c95c39ec56cdaf20.jpg";
import BottomSheet from "./ui/BottomSheet";

/* Serviço só existe de verdade com dashboard premium + financeiro (V1 não
   tem). "Ocultar, nunca apagar": o campo some da tela e composeDescription()
   para de escrever a linha, mas SERVICE_LINE_RE continua lendo o que já foi
   gravado -- agendamento antigo não perde o dado, e o campo volta inteiro no
   dia em que esta constante virar `true`. Ver ANEXO-PLANO-LAPIDACAO 4.2. */
const SERVICO_HABILITADO = false;

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
  // Sem gate de SERVICO_HABILITADO aqui de propósito: com o campo oculto,
  // `service` só chega não-vazio quando um agendamento antigo já trouxe a
  // linha (parse no load). Reescrever sem ela apagaria o dado do cliente só
  // por reabrir e salvar o card -- exatamente o que a regra "nunca apagar"
  // (4.2) proíbe. Evento novo nunca preenche `service` (campo sem UI), então
  // a linha simplesmente não nasce.
  return [
    phone ? `Telefone: ${phone}` : null,
    service.trim() ? `Serviço: ${service.trim()}` : null,
    notes.trim() ? `Anotação: ${notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function timeToMins(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(totalMinutes: number) {
  const total = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
    const [phone, setPhone] = useState("");
    const [service, setService] = useState("");
    const [notes, setNotes] = useState("");
    const [serviceOptions, setServiceOptions] = useState<ConfiguredService[]>([]);
    const [professionalId, setProfessionalId] = useState<number>(
      professionals[0]?.id || 1
    );
    const [error, setError] = useState("");

    // Término deixa de ser escolha (Frente 4.4): Início vem de
    // getAvailableSlots, Término é início + duracao_min, texto derivado.
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsError, setSlotsError] = useState(false);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isServiceOpen, setIsServiceOpen] = useState(false);
    const [agendaConfig, setAgendaConfig] = useState<AgendaConfig | null>(null);

    const prefersReducedMotion = useReducedMotion();
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const serviceInputRef = useRef<HTMLInputElement | null>(null);
    const notesInputRef = useRef<HTMLTextAreaElement | null>(null);
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

    // Início alimentado pela agenda de verdade, não mais uma lista estática:
    // horário ocupado deixa de ser oferecido. Refaz a busca sempre que
    // profissional ou data mudarem (ANEXO-PLANO-LAPIDACAO 4.4).
    useEffect(() => {
      if (!isOpen || !professionalId || !date) {
        setAvailableSlots([]);
        return;
      }
      let cancelled = false;
      setSlotsLoading(true);
      setSlotsError(false);

      getAvailableSlots(professionalId, date)
        .then((slots) => {
          if (cancelled) return;
          // Editando: o próprio horário do evento está ocupado por ele mesmo
          // e some da lista -- sem repor, dá pra editar tudo do evento menos
          // o horário que ele já tem.
          const ownSlot =
            eventToEdit &&
            eventToEdit.professionalId === professionalId &&
            eventToEdit.date === date
              ? eventToEdit.startTime
              : null;
          const withOwnSlot =
            ownSlot && !slots.includes(ownSlot)
              ? [...slots, ownSlot].sort()
              : slots;
          setAvailableSlots(withOwnSlot);
        })
        .catch(() => {
          if (!cancelled) setSlotsError(true);
        })
        .finally(() => {
          if (!cancelled) setSlotsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [isOpen, professionalId, date, eventToEdit]);

    // Horário escolhido pode deixar de valer se profissional ou data mudarem
    // depois -- sem isto, dava pra marcar em cima de um horário que não é
    // mais livre (o próprio defeito que esta frente resolve).
    useEffect(() => {
      if (!isOpen || slotsLoading) return;
      if (startTime && !availableSlots.includes(startTime)) {
        setStartTime("");
      }
    }, [isOpen, availableSlots, slotsLoading]);

    useEffect(() => {
      if (!isOpen || !SERVICO_HABILITADO) return;
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

      setStartTime("");
    };

    const closeAllDropdowns = () => {
      setIsDropdownOpen(false);
      setIsDateOpen(false);
      setIsStartOpen(false);
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
      if (!title || !date || !startTime || !professionalId) {
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

      // A agenda só é dispensável quando a checagem falhou de vez
      // (`slotsError`, que já libera a entrada manual). Fora disso, o
      // horário tem que vir da lista de livres -- é a correção que esta
      // frente existe pra fazer.
      if (!slotsError && !availableSlots.includes(startTime)) {
        setError("Selecione um horário disponível na agenda.");
        return;
      }

      if (
        SERVICO_HABILITADO &&
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
        endTime: minsToTime(timeToMins(startTime) + (agendaConfig?.duracao_min ?? 60)),
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

    // Término não é escolha: início + duração configurada do profissional
    // (a mesma que o bot usa) -- ANEXO-PLANO-LAPIDACAO 4.4.
    const duracaoMin = agendaConfig?.duracao_min ?? 60;
    const computedEndTime = startTime
      ? minsToTime(timeToMins(startTime) + duracaoMin)
      : "";

    /* CAMPOS
       Eram `border-2 border-[#8b5cf6]/80`: contorno roxo de 2px, em alfa
       alto, em TODOS os campos ao mesmo tempo. É a razão nº 1 de o modal ler
       como se fosse de outro aplicativo -- em nenhuma outra tela um campo tem
       contorno colorido, e o de busca de Conversas (que o dono validou) não
       tem contorno nenhum: é superfície preenchida e ponto.
       Aqui a régua vira a mesma: superfície preenchida, fio de 1px neutro, e
       cor SÓ no foco -- que é o único momento em que o contorno carrega
       informação ("é aqui que você está digitando"). Com 8 campos na tela,
       contorno permanente não destaca nada, só faz barulho.
       `p-3` -> `px-3.5 py-3.5` leva o campo a ~52px, o mesmo do login. */
    const fieldClass =
      "w-full rounded-xl px-3.5 py-3.5 text-[15px] text-white placeholder:text-white/40 " +
      "bg-white/[0.05] border border-white/[0.10] " +
      "focus:outline-none focus:border-white/25 focus-visible:ring-2 focus-visible:ring-white/20 " +
      "shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] " +
      "transition-all duration-200";

    return (
      <AnimatePresence>
        <motion.div
          key="backdrop"
          /* z-50 era MENOR que o z-index 100 do dock -- por isso o dock era
             desenhado POR CIMA do rodapé do modal e comia os botões
             "Cancelar" e "Salvar". Não era o modal ser alto demais: era o
             dock estar na frente. 110 põe o modal acima de tudo, que é o
             certo para um diálogo modal. Os dropdowns de Profissional/Data/
             Início viraram BottomSheet (4.5, z-[130]), então não precisam
             mais escapar do card -- `overflow-y-auto` aqui é só um piso de
             segurança pra telas baixíssimas; quem rola de verdade agora é o
             miolo do card. */
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto px-4 py-6 sm:px-0"
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
            /* `my-auto` centraliza enquanto couber e vira topo-do-scroll
               quando não couber -- com `items-center` puro, conteúdo mais
               alto que a tela tem o topo cortado e inalcançável.
               `max-h-[85vh]` + `flex-col` + `overflow-hidden`: o card virou
               moldura de altura fixa com três fatias (header, miolo rolável,
               rodapé fixo) -- Cancelar/Salvar sempre alcançáveis mesmo num
               dia cheio de campos (4.5). Só dá pra fechar em `overflow-hidden`
               porque os três dropdowns que escapavam do card viraram
               BottomSheet -- nada mais precisa vazar pra fora dele. */
            className="relative my-auto flex max-h-[85vh] w-full max-w-md flex-shrink-0 flex-col overflow-hidden rounded-3xl text-white"
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


            {/* CONTEÚDO -- três fatias dentro do <form>: header fixo, miolo
                rolável (os campos) e rodapé fixo (Cancelar/Salvar), pra eles
                nunca saírem de alcance num dia cheio de campos (4.5). */}
            <form onSubmit={handleSubmit} className="relative z-10 flex min-h-0 flex-1 flex-col">
              {/* Header -- fora do scroll. Respiro de 32px de lateral e
                  topo, o dobro do resto do app (tudo aqui anda em 16px) de
                  propósito: é a única peça que não compete por altura com o
                  miolo rolável. */}
              <div className="flex-shrink-0 px-5 pt-6">
                {/* Título alinhado à esquerda e em 22px, o padrão da casa
                    (Conversas, Agenda, Dashboard). Centralizado em 24px era a
                    única tela do app com esse tratamento -- parte do porquê
                    ele lia como peça de outro produto. */}
                <h2 id="event-modal-title" className="mb-4 text-[22px] font-bold leading-tight tracking-[-0.01em] text-white" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.8), 0 0 32px rgba(0,0,0,0.6)" }}>
                  {eventToEdit ? "Editar Evento" : "Criar Evento"}
                </h2>
                <div aria-hidden="true" className="h-px w-full" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)" }} />
              </div>

              {/* Miolo -- só ele rola. `space-y-5` -> `space-y-4`: com 8
                  campos, cada 4px a menos entre eles tira 28px da altura
                  total. */}
              <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-5 ${SCROLLBAR_CLASS}`}>
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

                {/* Telefone -- campo próprio, não mais linha dentro da caixa
                    "Descrição". Sobe pra logo abaixo do nome porque os dois
                    são a pessoa (ANEXO-PLANO-LAPIDACAO 4.3). O formato
                    gravado no banco não muda: composeDescription() continua
                    escrevendo "Telefone: ..." dentro da mesma coluna de
                    texto que o bot lê (4.1). */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(33) 99999-9999"
                    className={fieldClass}
                    required
                  />
                </div>

                {/* Profissional -- BottomSheet (4.5): folha ancorada no
                    rodapé da tela, não mais caixa flutuando perto do campo
                    (o campo é `absolute` cortado se o card tiver que rolar
                    por dentro). */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Profissional
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      closeAllDropdowns();
                      setIsDropdownOpen(true);
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

                  <BottomSheet
                    open={isDropdownOpen}
                    onClose={() => setIsDropdownOpen(false)}
                    title="Profissional"
                  >
                    {professionals.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProfessionalId(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] transition hover:bg-white/10 ${
                          professionalId === p.id ? "bg-white/10" : ""
                        }`}
                      >
                        <span
                          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={
                            p.color?.startsWith("#")
                              ? { backgroundColor: p.color }
                              : undefined
                          }
                        />
                        {p.name}
                      </button>
                    ))}
                  </BottomSheet>
                </div>

                {/* Data -- BottomSheet (4.5). */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Data
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      closeAllDropdowns();
                      setIsDateOpen(true);
                    }}
                    className={"flex w-full items-center justify-between " + fieldClass}
                  >
                    {date
                      ? new Date(date + "T00:00:00").toLocaleDateString("en-GB")
                      : "Selecionar data"}
                    <ChevronDown size={16} />
                  </button>

                  <BottomSheet
                    open={isDateOpen}
                    onClose={() => setIsDateOpen(false)}
                    title={`${monthName} ${currentYear}`}
                  >
                    <div className="grid grid-cols-7 gap-1 px-3 text-center text-sm">
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
                            className={`rounded-xl p-2.5 transition ${
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
                  </BottomSheet>
                </div>

                {/* Início -- alimentado pela agenda de verdade
                    (getAvailableSlots), não mais uma lista estática que
                    ignorava o que já está marcado. Término deixa de ser
                    escolha: texto derivado ao lado do rótulo
                    (ANEXO-PLANO-LAPIDACAO 4.4). Uma coluna só -- devolve os
                    ~88px que o grid de duas colunas gastava. Dropdown virou
                    BottomSheet (4.5). */}
                <div>
                  <div className="mb-1 ml-1 flex items-baseline justify-between gap-2">
                    <label className="block text-sm font-medium text-white">
                      Início
                    </label>
                    {startTime && !slotsLoading && (
                      <span className="text-xs text-white/45">
                        Término {computedEndTime}
                      </span>
                    )}
                  </div>

                  {slotsLoading ? (
                    <div className={`${fieldClass} animate-pulse text-white/20`}>
                      Carregando horários…
                    </div>
                  ) : slotsError ? (
                    <>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          if (error) setError("");
                        }}
                        className={fieldClass}
                      />
                      <p className="mt-1.5 ml-1 text-xs text-amber-300/80">
                        Não deu pra conferir a agenda -- confira o horário à
                        mão antes de salvar.
                      </p>
                    </>
                  ) : availableSlots.length === 0 ? (
                    <div className={`${fieldClass} text-white/40`}>
                      {selectedProfessional?.name ?? "Este profissional"} não
                      tem horário livre em{" "}
                      {currentSelectedDate.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                      . Escolha outra data ou outro profissional.
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          closeAllDropdowns();
                          setIsStartOpen(true);
                        }}
                        className={"flex w-full items-center justify-between " + fieldClass}
                      >
                        {startTime || "Selecionar"}
                        <ChevronDown size={16} />
                      </button>

                      <BottomSheet
                        open={isStartOpen}
                        onClose={() => setIsStartOpen(false)}
                        title="Início"
                      >
                        {availableSlots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              setStartTime(time);
                              setIsStartOpen(false);
                              if (error) setError("");
                            }}
                            className={`w-full rounded-xl px-3 py-3.5 text-left text-[15px] tabular-nums transition hover:bg-white/10 ${
                              startTime === time ? "bg-white/10" : ""
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </BottomSheet>
                    </>
                  )}
                </div>

                {/* Serviço -- oculto no V1 (4.2), campo próprio pronto pra
                    religar quando o dashboard premium com financeiro
                    existir. Nunca apagado: composeDescription() só para de
                    emitir a linha, SERVICE_LINE_RE continua lendo o que já
                    foi gravado.
                    ponytail: dropdown ainda `absolute` (não virou BottomSheet
                    como Profissional/Data/Início em 4.5) porque fica dormente
                    -- gatilho de upgrade: no dia de religar SERVICO_HABILITADO,
                    converter pro mesmo padrão, senão o miolo `overflow-y-auto`
                    do card corta a lista se o campo cair perto da borda. */}
                {SERVICO_HABILITADO && (
                  <div className="relative">
                    <label className="mb-1 ml-1 block text-sm font-medium text-white">
                      Serviço
                    </label>
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
                      className={fieldClass}
                    />

                    <AnimatePresence>
                      {isServiceOpen && serviceOptions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 text-sm text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
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
                )}

                {/* Descrição -- campo próprio, texto livre e mais nada. Os
                    rótulos roxos internos ("Telefone:" / "Anotação:") saem
                    junto com a caixa combinada que os continha (4.3). */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Descrição
                  </label>
                  <textarea
                    ref={notesInputRef}
                    rows={3}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Observações (opcional)"
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                {error && (
                  <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>

              {/* Rodapé -- fixo, fora do scroll (4.5). Antes, num dia cheio
                  de campos, dava pra rolar a página inteira e nunca alcançar
                  Cancelar/Salvar -- o "canto mais difícil da tela". */}
              <div className="flex-shrink-0 border-t border-white/[0.08] px-5 pb-6 pt-4">
                <div className="flex items-center justify-between">
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
                      /* py-2 dava ~34px numa dupla de botões que fica no
                         canto mais difícil da tela. 44px é o piso. */
                      className="min-h-[44px] rounded-xl px-4 py-2.5 text-[15px] font-medium text-white/50 transition-all duration-200 hover:text-white/80"
                    >
                      Cancelar
                    </button>

                    {/* O "Salvar" é a ÚNICA peça que continua roxa neste
                        modal, e de propósito: é a ação primária, e depois de
                        tirar o roxo dos 8 campos ele volta a ser o que a cor
                        deveria marcar desde o começo -- o que confirma. O
                        halo de 14px saiu junto com os contornos: com um único
                        elemento colorido na tela, ele já é o mais forte sem
                        precisar brilhar. */}
                    <button
                      type="submit"
                      className="min-h-[44px] rounded-xl bg-[#6a3dff] px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-[#5b2ee6] active:scale-[0.98]"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
);

EventModal.displayName = "EventModal";
export default EventModal;
