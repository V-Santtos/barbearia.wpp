// =====================
//  EVENT MODAL - V3 FINAL (ROXO CORRIGIDO)
// =====================

import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
} from "react";
import type { Event, Professional } from "../types";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { buscarClientePorTelefone, getAgendaConfig, getAvailableSlots, getConfiguredServices, getPrimeiroDiaLivre, type AgendaConfig, type ConfiguredService } from "../services/calendarApi";
import BottomSheet from "./ui/BottomSheet";
import { SeletorDeServicos } from "./ui/SeletorDeServicos";
import { juntarServicos, separarServicos } from "../lib/fechamento";
import { CAMPO, FUNDO_CAMPO_MODAL } from "./ui/campo";
import { paraNacional } from "../lib/telefone";
import { useMediaQuery } from "../hooks/useMediaQuery";

/* Serviço voltou como campo obrigatório (2026-09-26, com o dono). Ficou
   oculto no V1 esperando o financeiro existir -- e ele existe: o Financeiro
   calcula o faturamento cruzando `agendamentos.servico` com o preço do
   catálogo (`servicos`). Por isso é SELEÇÃO do catálogo, não texto livre: um
   nome que não bate com o catálogo entra lá como "Serviço não informado", sem
   preço. */

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

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/* Barra neutra e fina, sem trilho (2026-09-26): a roxa com trilho escuro
   aparecia como uma faixa colorida ao lado dos campos mesmo quando quase não
   havia o que rolar. Só existe quando o miolo transborda. Sem
   `scrollbar-width`/`scrollbar-color` de propósito: no Chrome, declarar
   qualquer um dos dois desliga os `::-webkit-scrollbar` e volta a barra do
   sistema, com as setinhas em cima e embaixo. */
const SCROLLBAR_CLASS =
  "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15";

const PHONE_LINE_RE = /Telefone:\s*([^\n]+)/i;
const SERVICE_LINE_RE = /Servi[cç]o:\s*([^\n]+)/i;

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

function composeDescription(phone: string, service: string) {
  // O App.tsx lê daqui as linhas "Telefone:" e "Serviço:" e manda cada uma no
  // seu campo da API (`telefone`, `servico`).
  return [
    phone ? `Telefone: ${phone}` : null,
    service.trim() ? `Serviço: ${service.trim()}` : null,
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
    const [serviceOptions, setServiceOptions] = useState<ConfiguredService[]>([]);
    const [servicesError, setServicesError] = useState(false);
    const [ancoraServico, setAncoraServico] = useState<HTMLButtonElement | null>(null);
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
    /* Os campos que abrem seleção: no desktop a BottomSheet vira menu colado
       neles (ver `ui/BottomSheet.tsx`). */
    const [ancoraProfissional, setAncoraProfissional] = useState<HTMLButtonElement | null>(null);
    const [ancoraData, setAncoraData] = useState<HTMLButtonElement | null>(null);
    const [ancoraInicio, setAncoraInicio] = useState<HTMLButtonElement | null>(null);
    const [agendaConfig, setAgendaConfig] = useState<AgendaConfig | null>(null);

    const prefersReducedMotion = useReducedMotion();
    const isMobile = useMediaQuery("(max-width: 767px)");
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const phoneInputRef = useRef<HTMLInputElement | null>(null);
    /* Telefone primeiro, nome depois (2026-09-26, com o dono): mesmo fluxo do
       site de agendamento. Número completo dispara a busca; se o cliente já
       existe, o nome vem preenchido -- mas só por cima de campo vazio ou de um
       nome que a própria busca pôs (nunca apaga o que o barbeiro digitou). */
    const [buscaCliente, setBuscaCliente] = useState<"ocioso" | "buscando" | "encontrado" | "novo">("ocioso");
    const nomeAutopreenchidoRef = useRef("");
    const tituloRef = useRef("");
    tituloRef.current = title;
    const telefoneOriginalRef = useRef("");
    /* A data que o próprio modal escolheu, e não o barbeiro (2026-09-26, com o
       dono). Novo agendamento abre em hoje; se hoje não tem horário livre para
       o profissional, abrir já no primeiro dia que tem, em vez de obrigar a
       trocar a data à mão. Vale enquanto o barbeiro não mexer na data -- clicou
       num dia do calendário ou escolheu uma data, fica a dele. */
    const dataAutomaticaRef = useRef(false);
    const [dataPulou, setDataPulou] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const fieldsScrollRef = useRef<HTMLDivElement>(null);
    const revealFieldFrameRef = useRef<number | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const revealFocusedField = useCallback(() => {
      if (!isMobile) return;

      if (revealFieldFrameRef.current !== null) {
        window.cancelAnimationFrame(revealFieldFrameRef.current);
      }

      revealFieldFrameRef.current = window.requestAnimationFrame(() => {
        revealFieldFrameRef.current = null;

        const active = document.activeElement;
        const scrollArea = fieldsScrollRef.current;
        if (!(active instanceof HTMLElement) || !scrollArea?.contains(active)) return;

        const fieldRect = active.getBoundingClientRect();
        const scrollRect = scrollArea.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
        const visibleTop = Math.max(scrollRect.top, viewportTop) + 12;
        const visibleBottom = Math.min(scrollRect.bottom, viewportBottom) - 12;

        let delta = 0;
        if (fieldRect.bottom > visibleBottom) {
          delta = fieldRect.bottom - visibleBottom;
        } else if (fieldRect.top < visibleTop) {
          delta = fieldRect.top - visibleTop;
        }

        if (Math.abs(delta) > 1) scrollArea.scrollTop += delta;
      });
    }, [isMobile]);

    useEffect(() => {
      if (!isOpen) return;
      previousFocusRef.current = document.activeElement as HTMLElement;
      return () => { previousFocusRef.current?.focus(); };
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen || !isMobile || !window.visualViewport) return;

      window.visualViewport.addEventListener("resize", revealFocusedField);
      window.visualViewport.addEventListener("scroll", revealFocusedField);
      return () => {
        window.visualViewport?.removeEventListener("resize", revealFocusedField);
        window.visualViewport?.removeEventListener("scroll", revealFocusedField);
        if (revealFieldFrameRef.current !== null) {
          window.cancelAnimationFrame(revealFieldFrameRef.current);
          revealFieldFrameRef.current = null;
        }
      };
    }, [isOpen, isMobile, revealFocusedField]);

    useEffect(() => {
      if (!isOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (isDropdownOpen || isDateOpen || isStartOpen || isServiceOpen) {
            closeAllDropdowns();
            return;
          }
          closeAllDropdowns();
          onClose();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose, isDropdownOpen, isDateOpen, isStartOpen, isServiceOpen]);

    useEffect(() => {
      if (!isOpen) return;

      if (eventToEdit) {
        const nextDescription = eventToEdit.description || "";
        setTitle(eventToEdit.title);
        setDate(eventToEdit.date);
        setStartTime(eventToEdit.startTime);
        // O banco guarda com o 55 (`5533990223209`); o campo edita só DDD +
        // número. Formatar o canônico direto tratava o 55 como DDD e cortava o
        // fim: "(55) 33990-2232".
        setPhone(formatPhoneValue(paraNacional(getPhoneDigitsFromDescription(nextDescription))));
        setService(getLineValue(nextDescription, SERVICE_LINE_RE));
        setProfessionalId(eventToEdit.professionalId);
        setError("");
        telefoneOriginalRef.current = getPhoneDigitsFromDescription(nextDescription);
        dataAutomaticaRef.current = false;
        setDataPulou(false);
        nomeAutopreenchidoRef.current = "";
        setBuscaCliente("ocioso");

        setTimeout(() => titleInputRef.current?.focus(), 0);
      } else {
        resetForm();
        // Automática só quando o modal abriu em hoje (o "Criar"); um dia
        // clicado no calendário é escolha do barbeiro.
        dataAutomaticaRef.current =
          !selectedDate || selectedDate === new Date().toLocaleDateString("en-CA");
        setDataPulou(false);
        telefoneOriginalRef.current = "";
        nomeAutopreenchidoRef.current = "";
        setBuscaCliente("ocioso");
        setTimeout(() => phoneInputRef.current?.focus(), 0);
      }
    }, [isOpen, eventToEdit, selectedDate]);

    useEffect(() => {
      if (!isOpen || eventToEdit || !professionalId || !dataAutomaticaRef.current) return;
      let cancelado = false;
      getPrimeiroDiaLivre(professionalId)
        .then((primeiro) => {
          if (cancelado || !primeiro || !dataAutomaticaRef.current) return;
          const hoje = new Date().toLocaleDateString("en-CA");
          setDate(primeiro);
          setDataPulou(primeiro !== hoje);
        })
        .catch(() => undefined);
      return () => {
        cancelado = true;
      };
    }, [isOpen, eventToEdit, professionalId]);

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
      if (!isOpen) return;
      const digitos = phone.replace(/\D/g, "");
      // Incompleto, ou (editando) o mesmo número que já estava: não procura.
      if (digitos.length < 10 || digitos === paraNacional(telefoneOriginalRef.current)) {
        setBuscaCliente("ocioso");
        return;
      }
      let cancelado = false;
      setBuscaCliente("buscando");
      const espera = window.setTimeout(() => {
        buscarClientePorTelefone(digitos)
          .then((nome) => {
            if (cancelado) return;
            // Decide fora do `setTitle(fn)`: o React roda essa função duas
            // vezes em desenvolvimento, e mexer no ref lá dentro fazia a
            // segunda rodada desfazer a primeira.
            const atual = tituloRef.current;
            const livre = !atual.trim() || atual === nomeAutopreenchidoRef.current;
            if (nome && livre) {
              nomeAutopreenchidoRef.current = nome;
              setTitle(nome);
            } else if (!nome && atual && atual === nomeAutopreenchidoRef.current) {
              // Número novo depois de um que tinha preenchido o nome: o nome
              // era do outro cliente, sai.
              nomeAutopreenchidoRef.current = "";
              setTitle("");
            }
            setBuscaCliente(nome ? "encontrado" : "novo");
          })
          .catch(() => {
            if (!cancelado) setBuscaCliente("ocioso");
          });
      }, 350);
      return () => {
        cancelado = true;
        window.clearTimeout(espera);
      };
    }, [isOpen, phone]);

    useEffect(() => {
      if (!isOpen) return;
      let cancelled = false;
      setServicesError(false);

      getConfiguredServices()
        .then((items) => {
          if (!cancelled) setServiceOptions(items);
        })
        .catch(() => {
          if (!cancelled) {
            setServiceOptions([]);
            setServicesError(true);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [isOpen]);

    const resetForm = () => {
      setTitle("");
      setPhone("");
      setService("");
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

      // Vários serviços (2026-09-27): o texto guarda os nomes separados por
      // vírgula. Nome que já estava gravado pode continuar mesmo fora da tabela.
      const escolhidos = separarServicos(service);
      if (escolhidos.length === 0) {
        setError("Selecione pelo menos um serviço.");
        return;
      }
      const gravados = new Set(
        separarServicos(eventToEdit ? getLineValue(eventToEdit.description || "", SERVICE_LINE_RE) : ""),
      );
      if (
        escolhidos.some(
          (nome) => !gravados.has(nome) && !serviceOptions.some((option) => option.name === nome),
        )
      ) {
        setError("Selecione um serviço do catálogo.");
        return;
      }

      onSave({
        id: eventToEdit?.id,
        title: title.trim(),
        date,
        startTime,
        endTime: minsToTime(timeToMins(startTime) + (agendaConfig?.duracao_min ?? 60)),
        description: composeDescription(phone, service),
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
       Eram `border-2 border-accent-400/80`: contorno roxo de 2px, em alfa
       alto, em TODOS os campos ao mesmo tempo. É a razão nº 1 de o modal ler
       como se fosse de outro aplicativo -- em nenhuma outra tela um campo tem
       contorno colorido, e o de busca de Conversas (que o dono validou) não
       tem contorno nenhum: é superfície preenchida e ponto.
       Aqui a régua vira a mesma: superfície preenchida, fio de 1px neutro, e
       cor SÓ no foco -- que é o único momento em que o contorno carrega
       informação ("é aqui que você está digitando"). Com 8 campos na tela,
       contorno permanente não destaca nada, só faz barulho.
       `p-3` -> `px-3.5 py-3.5` leva o campo a ~52px, o mesmo do login.
       Desde 2026-09-26 a pele é a mesma do login (`ui/campo.ts`): afundada,
       sem ícone -- aqui o rótulo em cima já diz o que é cada campo. */
    const fieldClass = `${CAMPO} ${FUNDO_CAMPO_MODAL} px-3.5 py-3.5 text-base md:text-[15px]`;

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
          className="fixed inset-0 z-[110] flex h-dvh items-stretch justify-center overflow-hidden p-0 md:h-auto md:items-center md:overflow-y-auto md:py-6"
          /* Mesmo véu dos outros modais (Novo profissional, Configurar
             agenda): preto a 50% com desfoque leve. Era 72% com 8px. */
          style={{
            overscrollBehavior: 'contain',
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: isMobile ? "none" : "blur(3px)",
            WebkitBackdropFilter: isMobile ? "none" : "blur(3px)",
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
            /* No celular, o card deixa de flutuar e vira a própria tela:
               `h-dvh` acompanha a área visível quando o teclado abre, enquanto
               header e rodapé ficam fora do miolo rolável. No desktop,
               `my-auto` centraliza enquanto couber e vira topo-do-scroll
               quando não couber -- com `items-center` puro, conteúdo mais
               alto que a tela tem o topo cortado e inalcançável.
               O teto é a tela menos os 24px de respiro em cima e embaixo (era
               85vh: numa tela de 900px sobravam ~130px vazios e o miolo já
               rolava por uns poucos pixels, com barra e tudo).
               Teto + `flex-col` + `overflow-hidden`: o card virou
               moldura de altura fixa com três fatias (header, miolo rolável,
               rodapé fixo) -- Cancelar/Salvar sempre alcançáveis mesmo num
               dia cheio de campos (4.5). Só dá pra fechar em `overflow-hidden`
               porque os três dropdowns que escapavam do card viraram
               BottomSheet -- nada mais precisa vazar pra fora dele. */
            /* A receita dos outros modais do app (2026-09-26, com o dono):
               `#191919` sólido, borda branca a 10%, cantos `rounded-xl` e uma
               sombra só. Saíram a textura de foto atrás dos campos, o brilho
               radial do topo e as cinco sombras internas -- era o único modal
               com material próprio, e lia como peça de outro produto. */
            className="relative flex h-dvh max-h-dvh w-full max-w-none flex-shrink-0 flex-col overflow-hidden rounded-none border-0 bg-[#191919] text-white shadow-[0_24px_64px_rgba(0,0,0,0.5)] md:my-auto md:h-auto md:max-h-[calc(100dvh-48px)] md:max-w-md md:rounded-xl md:border md:border-white/10"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : isMobile
                  ? { opacity: 0, y: 24 }
                  : { opacity: 0, scale: 0.96, y: 10 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : isMobile
                  ? { opacity: 0, y: 16 }
                  : { opacity: 0, scale: 0.96, y: 10 }
            }
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
            {/* CONTEÚDO -- três fatias dentro do <form>: header fixo, miolo
                rolável (os campos) e rodapé fixo (Cancelar/Salvar), pra eles
                nunca saírem de alcance num dia cheio de campos (4.5). */}
            <form onSubmit={handleSubmit} className="relative z-10 flex min-h-0 flex-1 flex-col">
              {/* Header -- fora do scroll. Respiro de 32px de lateral e
                  topo, o dobro do resto do app (tudo aqui anda em 16px) de
                  propósito: é a única peça que não compete por altura com o
                  miolo rolável. */}
              <div className="flex-shrink-0 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-6">
                {/* Título alinhado à esquerda e em 22px, o padrão da casa
                    (Conversas, Agenda, Dashboard). Centralizado em 24px era a
                    única tela do app com esse tratamento -- parte do porquê
                    ele lia como peça de outro produto. */}
                <h2 id="event-modal-title" className="mb-4 text-[22px] font-bold leading-tight tracking-[-0.01em] text-white">
                  {eventToEdit ? "Editar Evento" : "Criar Evento"}
                </h2>
                <div aria-hidden="true" className="h-px w-full bg-white/[0.08]" />
              </div>

              {/* Miolo -- só ele rola. `space-y-5` -> `space-y-4`: com 8
                  campos, cada 4px a menos entre eles tira 28px da altura
                  total. */}
              <div ref={fieldsScrollRef} className={`min-h-0 flex-1 scroll-pb-28 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 pt-5 ${SCROLLBAR_CLASS}`}>
                {/* Telefone -- primeiro campo (2026-09-26): é por ele que o
                    cliente já cadastrado é reconhecido e o nome vem sozinho.
                    Na tela, só DDD + número; o 55 é colocado ao gravar. */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Telefone
                  </label>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(33) 99999-9999"
                    className={fieldClass}
                    required
                  />
                  {buscaCliente !== "ocioso" && (
                    <p aria-live="polite" className="mt-1.5 ml-1 text-xs text-white/45">
                      {buscaCliente === "buscando"
                        ? "Procurando cliente…"
                        : buscaCliente === "encontrado"
                          ? "Cliente já cadastrado"
                          : "Cliente novo: preencha o nome"}
                    </p>
                  )}
                </div>

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

                {/* Serviço -- obrigatório, escolhido do catálogo (ver o topo do
                    arquivo). Mesmo seletor de Profissional: menu colado ao
                    campo no desktop, folha que sobe do rodapé no celular. */}
                <div>
                  <label className="mb-1 ml-1 block text-sm font-medium text-white">
                    Serviço
                  </label>

                  {servicesError && serviceOptions.length === 0 ? (
                    <div className={`${fieldClass} text-white/40`}>
                      Não deu pra carregar os serviços. Feche e abra de novo.
                    </div>
                  ) : (
                    <button
                      ref={setAncoraServico}
                      type="button"
                      onClick={() => {
                        closeAllDropdowns();
                        setIsServiceOpen(true);
                      }}
                      className={"flex w-full items-center justify-between gap-2 " + fieldClass}
                    >
                      <span className={service ? "truncate" : "truncate text-white/40"}>
                        {service || "Selecionar serviços"}
                      </span>
                      <ChevronDown size={16} className="flex-shrink-0" />
                    </button>
                  )}

                  <BottomSheet
                    open={isServiceOpen}
                    onClose={() => setIsServiceOpen(false)}
                    title="Serviços"
                    anchor={ancoraServico}
                  >
                    {/* Vários serviços (2026-09-27): a folha fica aberta enquanto
                        ele marca; "Pronto" fecha. */}
                    <SeletorDeServicos
                      opcoes={serviceOptions}
                      selecionados={separarServicos(service)}
                      onChange={(nomes) => {
                        setService(juntarServicos(nomes));
                        if (error) setError("");
                      }}
                    />
                    <div className="px-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsServiceOpen(false)}
                        className="h-11 w-full rounded-xl bg-white/10 text-[14px] font-semibold text-white transition hover:bg-white/15"
                      >
                        Pronto
                      </button>
                    </div>
                  </BottomSheet>
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
                    ref={setAncoraProfissional}
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
                    anchor={ancoraProfissional}
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
                    ref={setAncoraData}
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
                  {dataPulou && (
                    <p aria-live="polite" className="mt-1.5 ml-1 text-xs text-white/45">
                      Hoje não tem horário livre: abrimos o próximo dia com vaga.
                    </p>
                  )}

                  <BottomSheet
                    open={isDateOpen}
                    onClose={() => setIsDateOpen(false)}
                    title={`${monthName} ${currentYear}`}
                    anchor={ancoraData}
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
                              dataAutomaticaRef.current = false;
                              setDataPulou(false);
                              setDate(dateValue);
                              setTimeout(() => setIsDateOpen(false), 120);
                            }}
                            className={`rounded-xl p-2.5 transition ${
                              isSelected
                                ? "bg-accent-400 text-white"
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
                        ref={setAncoraInicio}
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
                        anchor={ancoraInicio}
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

                {/* Descrição saiu (2026-09-26, com o dono). Ela não guardava
                    nada: o App.tsx só aproveita as linhas "Telefone:" e
                    "Serviço:" e a API não tem coluna para observação -- o que se
                    digitava ali sumia ao salvar. Serviço e telefone têm campo
                    próprio. Se anotar algo fizer falta, primeiro nasce a coluna
                    no banco, depois o campo volta. */}
                {error && (
                  <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>

              {/* Rodapé -- fixo, fora do scroll (4.5). Antes, num dia cheio
                  de campos, dava pra rolar a página inteira e nunca alcançar
                  Cancelar/Salvar -- o "canto mais difícil da tela". */}
              <div className="flex-shrink-0 border-t border-white/[0.08] px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 md:pb-6">
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
                      className="min-h-[44px] rounded-xl bg-accent px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]"
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
