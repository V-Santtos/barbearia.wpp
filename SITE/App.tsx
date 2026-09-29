import { caminhoDaLoja } from "./lib/barbearia";
import { useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";

import StepName from "./components/StepName";
import StepPhone from "./components/StepPhone";
import StepPro from "./components/StepPro";
import StepCalendar from "./components/StepCalendar";
import StepTime from "./components/StepTime";
import StepReview from "./components/StepReview";
import StepSuccess from "./components/StepSuccess";
import { StepDots } from "./components/StepDots";

import { useCalendar } from "./hooks/useCalendar";
import { useBooking } from "./hooks/useBooking";
import { useServices } from "./hooks/useServices";
import type { Service } from "./services";

import { normalizeDisableDays } from "./Regras/regraDisponibilidade";
import { WORK_SLOTS } from "./Regras/regraHorarios";

export default function App() {
  const [step, setStep] = useState(1);
  const [displayStep, setDisplayStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const pendingStepRef = useRef(1);
  const directionRef = useRef(1);            // 1 = avançando, -1 = voltando
  const navigationActiveRef = useRef(false); // true só quando uma navegação está em andamento
  const transitionTypeRef = useRef<"slide" | "fade">("fade");

  const next = () => { directionRef.current = 1;  setStep((s) => s + 1); };
  const back = () => { directionRef.current = -1; setStep((s) => s - 1); };

  // ====== DADOS DO FORM ======
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState(() => sessionStorage.getItem("booking_name") ?? "");
  const [phone, setPhone] = useState(() => sessionStorage.getItem("booking_phone") ?? "");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const { services, loading: servicesLoading } = useServices();
  const routeService = useMemo(() => {
    const state = location.state as { servico?: string; serviceSlug?: string; service?: Service } | null;
    if (state?.service) return state.service;
    if (state?.servico && state?.serviceSlug) {
      return {
        id: -1,
        slug: state.serviceSlug,
        name: state.servico,
        desc: "",
        price: "",
        category: "",
      } satisfies Service;
    }
    return null;
  }, [location.state]);
  const selectedService = useMemo(() => {
    if (routeService) return routeService;
    const state = location.state as { servico?: string; serviceSlug?: string } | null;
    const params = new URLSearchParams(window.location.search);
    const serviceSlug = state?.serviceSlug ?? params.get("servico");
    const serviceName = state?.servico ?? params.get("servico");
    const slugService = services.find((item) => item.slug === serviceSlug);
    if (slugService) return slugService;
    return services.find((item) => item.name === serviceName) ?? null;
  }, [location.state, location.search, routeService, services]);
  const service = selectedService?.name ?? "";
  const hasService = !!selectedService;

  // ====== HOOKS ======
  const calendar = useCalendar({ professionalId, setStep });

  const booking = useBooking({
    name,
    phone,
    professionalName,
    professionalId,
    service,
    selectedDate: calendar.selectedDate,
    selectedTime: calendar.selectedTime,
    selectedTimeSelectedAt: calendar.selectedTimeSelectedAt,
    onSlotUnavailable: (message) => {
      void calendar.refreshSelectedDateSlots(message);
      setStep(5);
      setDisplayStep(5);
    },
  });

  // Persiste nome e telefone para restaurar após reload acidental
  useEffect(() => {
    if (name) sessionStorage.setItem("booking_name", name);
    else sessionStorage.removeItem("booking_name");
  }, [name]);

  useEffect(() => {
    if (phone) sessionStorage.setItem("booking_phone", phone);
    else sessionStorage.removeItem("booking_phone");
  }, [phone]);

  // ====== TRANSIÇÃO PARA A TELA DE SUCESSO ======
  useEffect(() => {
    if (!booking.bookingDone) return;
    sessionStorage.removeItem("booking_name");
    sessionStorage.removeItem("booking_phone");
    const el = stepContainerRef.current;
    if (el) {
      gsap.to(el, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => window.setTimeout(() => setShowSuccess(true), 150),
      });
    } else {
      setShowSuccess(true);
    }
  }, [booking.bookingDone]);

  const handleSuccessBack = () => {
    booking.resetBooking();
    setName("");
    setPhone("");
    setProfessionalId(null);
    setProfessionalName("");
    setShowSuccess(false);
    navigate(caminhoDaLoja("/"));
  };

  // ====== EXPIRAÇÃO DO SLOT SELECIONADO ======
  // Se o usuário ficar mais de 5 min sem confirmar após escolher o horário,
  // volta silenciosamente ao step 1 — nome e telefone permanecem preenchidos.
  useEffect(() => {
    const selectedAt = calendar.selectedTimeSelectedAt;
    if (!selectedAt || showSuccess) return;

    const EXPIRATION_MS = 5 * 60 * 1000;
    const remaining = EXPIRATION_MS - (Date.now() - selectedAt);
    if (remaining <= 0) return;

    const timer = setTimeout(() => {
      booking.resetBooking();
      setProfessionalId(null);
      setProfessionalName("");
      setStep(1);
      setDisplayStep(1);
    }, remaining);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar.selectedTimeSelectedAt, showSuccess]);

  // ====== GSAP TRANSITIONS — slide direcional (só 1↔2) + fade ======
  useEffect(() => {
    pendingStepRef.current = step;
    if (step === displayStep) return;

    const el = stepContainerRef.current;
    if (!el) { setDisplayStep(step); return; }

    const isSlide = (displayStep === 1 && step === 2) || (displayStep === 2 && step === 1);
    transitionTypeRef.current = isSlide ? "slide" : "fade";
    navigationActiveRef.current = true;

    gsap.to(el, {
      opacity: 0,
      x: isSlide ? directionRef.current * -28 : 0,
      duration: 0.35,
      ease: "sine.in",
      overwrite: true,
      onComplete: () => setDisplayStep(pendingStepRef.current),
    });
  }, [step]);

  useLayoutEffect(() => {
    if (!navigationActiveRef.current) return;
    navigationActiveRef.current = false;

    const el = stepContainerRef.current;
    if (!el) return;

    const isSlide = transitionTypeRef.current === "slide";
    gsap.fromTo(
      el,
      { opacity: 0, x: isSlide ? directionRef.current * 28 : 0 },
      { opacity: 1, x: 0, duration: 0.35, ease: "sine.out", overwrite: true },
    );
  }, [displayStep]);

  // ====== RENDER ======
  if (!routeService && servicesLoading) return null;

  if (!hasService) {
    return <Navigate to={caminhoDaLoja("/")} replace />;
  }

  return (
    <div className={`overlay${displayStep === 4 ? " overlay--calendar" : ""}${displayStep === 6 && !showSuccess ? " overlay--review" : ""}`}>
      <div className={`form${displayStep === 4 ? " form--wide" : ""}`}>
        {showSuccess ? (
          <StepSuccess name={name} onBack={handleSuccessBack} />
        ) : (
        <>
        {displayStep < 6 && <StepDots total={6} page={displayStep - 1} />}
        <div ref={stepContainerRef}>

          {displayStep === 1 && (
            <StepPhone
              phone={phone}
              setPhone={setPhone}
              next={next}
            />
          )}

          {displayStep === 2 && (
            <StepName
              name={name}
              setName={setName}
              back={back}
              next={next}
            />
          )}

          {displayStep === 3 && (
            <StepPro
              selectedPro={professionalName || null}
              setSelectedPro={(payload) => {
                if (!payload) {
                  setProfessionalId(null);
                  setProfessionalName("");
                  calendar.setDisableDays([]);
                  return;
                }

                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.id) setProfessionalId(String(parsed.id));
                  if (parsed.name) setProfessionalName(parsed.name);

                  const incoming =
                    parsed.DisableDays ??
                    parsed.disableDays ??
                    parsed.disable_days ??
                    parsed.disabledDays ??
                    [];

                  calendar.setDisableDays(normalizeDisableDays(incoming));
                } catch {
                  setProfessionalId(String(payload));
                  calendar.setDisableDays([]);
                }
              }}
              back={back}
              next={next}
            />
          )}

          {displayStep === 4 && (
            <StepCalendar
              monthTitle={calendar.monthTitle}
              week={calendar.weekdays}
              days={calendar.days}
              back={() => setStep(3)}
              onPrevMonth={calendar.onPrevMonth}
              onNextMonth={calendar.onNextMonth}
              onSelectDay={calendar.onSelectDay}
              disabledDates={calendar.disableDays}
              availableDays={calendar.availableDays}
              availableDaysLoading={calendar.availableDaysLoading}
              availableDaysMessage={calendar.availableDaysMessage}
              availableDaysError={calendar.availableDaysError}
              workSlots={WORK_SLOTS}
            />
          )}

          {displayStep === 5 && (
            <StepTime
              slots={calendar.availableSlots}
              loading={calendar.slotsLoading}
              message={calendar.availabilityMessage}
              back={() => setStep(4)}
              onSelectTime={calendar.onSelectTime}
            />
          )}

          {displayStep === 6 && (
            <StepReview
              name={name}
              phone={phone}
              professional={professionalName}
              service={service}
              date={calendar.selectedDate}
              time={calendar.selectedTime}
              back={() => setStep(1)}
              onConfirm={booking.onConfirm}
              bookingStatus={booking.bookingStatus}
              bookingInProgress={booking.bookingInProgress}
              bookingDone={booking.bookingDone}
            />
          )}

        </div>
        </>
      )}
      </div>
    </div>
  );
}
