import { useState } from "react";
import { createBooking, getAvailableSlots } from "../api";
import { extractAvailableSlots } from "../Regras/regraDisponibilidade";
import { sanitizePhone } from "../Regras/regraTelefone";

interface UseBookingOptions {
  name: string;
  phone: string;
  professionalName: string;
  professionalId: string | null;
  service: string;
  selectedDate: string;
  selectedTime: string;
  selectedTimeSelectedAt: number | null;
  onSlotUnavailable?: (message: string) => void;
}

export function useBooking({
  name,
  phone,
  professionalName,
  professionalId,
  service,
  selectedDate,
  selectedTime,
  selectedTimeSelectedAt,
  onSlotUnavailable,
}: UseBookingOptions) {
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  async function onConfirm() {
    if (bookingInProgress) return;

    if (!name || !phone || !professionalName || !professionalId || !service || !selectedDate || !selectedTime) {
      setBookingStatus("Preencha todos os dados antes de agendar.");
      return;
    }

    const SLOT_EXPIRATION_MS = 5 * 60 * 1000;
    const selectedAt = selectedTimeSelectedAt ?? 0;
    if (!selectedAt || Date.now() - selectedAt > SLOT_EXPIRATION_MS) {
      const message = "Esse horário ficou aberto por muito tempo. Escolha um horário novamente.";
      setBookingStatus(message);
      onSlotUnavailable?.(message);
      return;
    }

    const TIMEOUT_MS = 10000;
    const MIN_WAIT_MS = 650;
    const startedAt = Date.now();

    setBookingDone(false);
    setBookingStatus(null);
    setBookingInProgress(true);

    try {
      const availabilityResp = await getAvailableSlots(professionalId, selectedDate, { timeoutMs: 6000 });

      const freshSlots = extractAvailableSlots(availabilityResp);
      const selectedHHMM = selectedTime.slice(0, 5);
      if (!freshSlots.includes(selectedHHMM)) {
        const message = "Esse horário acabou de ficar indisponível. Escolha outro horário.";
        setBookingStatus(message);
        setBookingInProgress(false);
        onSlotUnavailable?.(message);
        return;
      }

      const payload = {
        telefone: sanitizePhone(phone),
        cliente: name,
        profissional: professionalName,
        servico: service,
        dia_marcado: selectedDate,
        hora_marcada: selectedTime,
        status: "agendado",
        source: "app-etapas",
      };

      const resp = (await Promise.race([
        createBooking(payload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
        ),
      ])) as any;

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_WAIT_MS) {
        await new Promise((r) => setTimeout(r, MIN_WAIT_MS - elapsed));
      }

      const normalized = Array.isArray(resp) ? resp[0] : resp;
      const status = String(normalized?.status ?? "").toLowerCase();
      const mensagem =
        normalized?.mensagem ??
        normalized?.message ??
        "Agendamento criado com sucesso! ✅";

      if (status === "ok" || status === "success" || normalized?.event) {
        setBookingDone(true);
        setBookingStatus(mensagem);
      } else {
        setBookingDone(false);
        setBookingStatus("Não foi possível criar o agendamento.");
      }
    } catch (err: any) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_WAIT_MS) {
        await new Promise((r) => setTimeout(r, MIN_WAIT_MS - elapsed));
      }

      if (String(err?.message || "").toLowerCase().includes("timeout")) {
        setBookingStatus(
          "Demorou mais que o normal. Toque em Agendar novamente.",
        );
      } else {
        setBookingStatus("Erro ao criar o agendamento. Tente novamente.");
      }
      setBookingDone(false);
    } finally {
      setBookingInProgress(false);
    }
  }

  function resetBooking() {
    setBookingStatus(null);
    setBookingInProgress(false);
    setBookingDone(false);
  }

  return { bookingStatus, bookingInProgress, bookingDone, onConfirm, resetBooking };
}
