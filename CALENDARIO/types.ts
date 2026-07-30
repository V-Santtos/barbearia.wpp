// -----------------------------------------
// EVENTO DO BANCO (calendar_events)
// -----------------------------------------
export interface Event {
  id: number;

  // 🔰 Campos usados na UI (Frontend)
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  professionalId: number;

  // 🔰 Campos vindos da tabela "calendar_events" (Backend)
  telefone?: string;
  cliente?: string;
  profissional?: string;   // nome do barbeiro salvo no banco
  servico?: string | null;
  dia_marcado?: string;    // 'YYYY-MM-DD'
  hora_marcada?: string;   // 'HH:MM'
  status?: string;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}

// -----------------------------------------
// PROFISSIONAL (profissionais)
// -----------------------------------------
export interface Professional {
  id: number;
  // UI
  name: string;
  color: string;

  // DB
  nome?: string;
  cor?: string;
  ativo?: boolean;
  created_at?: string;
  updated_at?: string;
}

// -----------------------------------------
// REQUISIÇÕES DO APLICATIVO DE ETAPAS
// -----------------------------------------

// TELEFONE
export interface PhoneEventsRequest {
  clientPhone: string;
}

export interface PhoneEventsResponse {
  clientPhone: string;
  hasEvents: boolean;
  events: Event[];
}

// CRIAR EVENTO
export interface CreateEventRequest {
  profissional: string;   // nome do profissional
  dia_marcado: string;    // 'YYYY-MM-DD'
  hora_marcada: string;   // 'HH:MM'

  cliente: string;
  telefone: string;
  servico?: string;
  source?: string;
}

// -----------------------------------------
// DISPONIBILIDADE POR DIA
// -----------------------------------------
export interface DayAvailability {
  date: string; // YYYY-MM-DD
  hasAvailability: boolean;
}

export interface DaysAvailabilityRequest {
  professionalId: number;
  from: string;
  to: string;
}

export interface DaysAvailabilityResponse {
  professionalId: number;
  from: string;
  to: string;
  days: DayAvailability[];
}

// -----------------------------------------
// DISPONIBILIDADE DE HORÁRIOS
// -----------------------------------------
export interface DayTimeSlotsRequest {
  professionalId: number;
  date: string;
}

export interface DayTimeSlotsResponse {
  professionalId: number;
  date: string;
  availableSlots: string[];
}

// -----------------------------------------
// OUTROS
// -----------------------------------------
export interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type CalendarView = 'day' | 'week' | 'month';
