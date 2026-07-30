ALTER TABLE public.agenda_profissional
ADD COLUMN IF NOT EXISTS janela_agendamento_dias integer NOT NULL DEFAULT 10;

ALTER TABLE public.agenda_profissional
DROP CONSTRAINT IF EXISTS agenda_profissional_janela_agendamento_dias_check;

ALTER TABLE public.agenda_profissional
ADD CONSTRAINT agenda_profissional_janela_agendamento_dias_check
CHECK (janela_agendamento_dias BETWEEN 7 AND 15);
