import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Save, Clock } from 'lucide-react';
import type { Professional } from '../types';
import { AgendaSettingsSkeleton } from './ui/Skeleton';
import TimeSelect from './ui/TimeSelect';
import { DateField } from './ui/DateField';
import { JANELA_MIN_DIAS, JANELA_MAX_DIAS } from '../lib/utils';
import {
  getAgendaConfig,
  updateAgendaConfig,
  getBlockedDays,
  addBlockedDay,
  removeBlockedDay,
  type AgendaConfig,
  type DiaBloqueado,
} from '../services/calendarApi';

interface Props {
  professional: Professional | null;
  onClose: () => void;
}

const DURACOES = [15, 20, 30, 45, 60];
const INTERVALOS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
];
const WORK_DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];

const DEFAULT_CONFIG: Omit<AgendaConfig, 'profissional_id' | 'atualizado_em'> = {
  dias_semana: [1, 2, 3, 4, 5, 6],
  hora_inicio: '08:00',
  hora_fim: '19:00',
  duracao_min: 60,
  intervalo_inicio: null,
  intervalo_duracao_min: null,
  janela_agendamento_dias: 10,
};

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number) {
  const total = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildPreviewSlots(config: typeof DEFAULT_CONFIG) {
  const slots: string[] = [];
  const start = timeToMinutes(config.hora_inicio);
  const end = timeToMinutes(config.hora_fim);
  const breakStart = config.intervalo_inicio ? timeToMinutes(config.intervalo_inicio) : null;
  const breakEnd =
    breakStart !== null && config.intervalo_duracao_min
      ? breakStart + config.intervalo_duracao_min
      : null;

  let cur = start;
  while (cur + config.duracao_min <= end) {
    const overlapsBreak =
      breakStart !== null &&
      breakEnd !== null &&
      cur < breakEnd &&
      cur + config.duracao_min > breakStart;

    if (!overlapsBreak) slots.push(minutesToTime(cur));
    cur += config.duracao_min;
  }
  return slots;
}

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SCROLLBAR_CLASS =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.14] hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.24]';

export default function AgendaSettingsModal({ professional, onClose }: Props) {
  const [tab, setTab] = useState<'horarios' | 'bloqueados'>('horarios');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [blocked, setBlocked] = useState<DiaBloqueado[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newMotivo, setNewMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!professional) return;
    setLoading(true);
    setFeedback(null);
    Promise.all([
      getAgendaConfig(professional.id),
      getBlockedDays(professional.id),
    ])
      .then(([cfg, blk]) => {
        setConfig({
          dias_semana: cfg.dias_semana.filter((d) => d !== 0),
          hora_inicio: cfg.hora_inicio,
          hora_fim: cfg.hora_fim,
          duracao_min: cfg.duracao_min,
          intervalo_inicio: cfg.intervalo_inicio,
          intervalo_duracao_min: cfg.intervalo_duracao_min,
          janela_agendamento_dias: cfg.janela_agendamento_dias ?? 10,
        });
        setBlocked(blk.filter((item) => item.periodos === null));
      })
      .catch(() => setFeedback('Erro ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, [professional?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!professional) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [professional?.id]);

  useEffect(() => {
    if (!professional) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = window.setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SEL);
      firstFocusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [professional?.id]);

  const toggleDia = (d: number) => {
    setConfig((prev) => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(d)
        ? prev.dias_semana.filter((x) => x !== d)
        : [...prev.dias_semana, d].sort((a, b) => a - b),
    }));
  };

  const handleSaveConfig = async () => {
    if (!professional) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (config.intervalo_inicio && config.intervalo_duracao_min) {
        const breakStart = timeToMinutes(config.intervalo_inicio);
        const breakEnd = breakStart + config.intervalo_duracao_min;
        if (breakStart < timeToMinutes(config.hora_inicio) || breakEnd > timeToMinutes(config.hora_fim)) {
          setFeedback('Descanso fora do expediente.');
          setSaving(false);
          return;
        }
      }

      await updateAgendaConfig(professional.id, {
        ...config,
        dias_semana: config.dias_semana.filter((d) => d !== 0),
      });
      setFeedback('Configuração salva!');
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlocked = async () => {
    if (!professional || !newDate) return;
    try {
      const item = await addBlockedDay(professional.id, newDate, newMotivo || undefined);
      setBlocked((prev) =>
        [...prev.filter((b) => b.data !== item.data), item].sort((a, b) =>
          a.data.localeCompare(b.data)
        )
      );
      setNewDate('');
      setNewMotivo('');
    } catch (err: any) {
      setFeedback(err.message ?? 'Erro ao bloquear dia.');
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleRemoveBlocked = async (data: string) => {
    if (!professional) return;
    try {
      await removeBlockedDay(professional.id, data);
      setBlocked((prev) => prev.filter((b) => b.data !== data));
    } catch {
      setFeedback('Erro ao desbloquear dia.');
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  if (!professional) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex h-dvh items-stretch justify-center overflow-hidden bg-black/70 md:h-auto md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-modal-title"
        className="relative flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0
                   bg-[#191919] shadow-[0_24px_64px_rgba(0,0,0,0.46)]
                   md:mx-0 md:h-auto md:max-h-[88vh] md:max-w-lg md:rounded-[16px]
                   md:border md:border-white/[0.09]"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key !== 'Tab') return;
          const focusable = Array.from(
            modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SEL) ?? []
          );
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
        {/* Header */}
        <div className="flex min-h-14 items-center justify-between border-b border-white/[0.07]
                        px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: professional.color }} />
            <span id="agenda-modal-title" className="text-sm font-semibold text-white">
              {professional.name}
            </span>
            <span className="truncate text-xs text-white/45">Configurações de agenda</span>
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="ml-3 flex h-11 w-11 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] px-4" role="tablist" aria-label="Seções de configuração">
          {(['horarios', 'bloqueados'] as const).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`tab-panel-${t}`}
              onClick={() => setTab(t)}
              className={`relative flex-1 py-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400/60 ${
                tab === t
                  ? 'text-white after:bg-accent-400'
                  : 'text-white/45 after:bg-transparent hover:text-white/75'
              }`}
            >
              {t === 'horarios' ? 'Horários de trabalho' : 'Dias bloqueados'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          role="tabpanel"
          id={`tab-panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className={`min-h-0 flex-1 overflow-y-auto p-5 ${SCROLLBAR_CLASS}`}
        >
          {loading ? (
            <AgendaSettingsSkeleton />
          ) : tab === 'horarios' ? (
            <div className="space-y-6">
              {/* Dias da semana */}
              <div>
                <p className="mb-2 text-xs font-medium text-white/60">Dias de trabalho</p>
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((dia) => (
                    <button
                      key={dia.value}
                      onClick={() => toggleDia(dia.value)}
                      aria-pressed={config.dias_semana.includes(dia.value)}
                      className={`min-w-12 rounded-lg border px-3 py-2 text-xs font-medium transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60
                        ${config.dias_semana.includes(dia.value)
                          ? 'border-accent-400/70 bg-white/[0.07] text-white shadow-[inset_0_-2px_0_rgba(119,114,251,0.8)]'
                          : 'border-white/[0.08] bg-[#1c1c1c] text-white/50 hover:border-white/[0.16] hover:text-white/75'}`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horários */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="mb-2 text-xs font-medium text-white/60">Início</p>
                  <div className="[&_button]:rounded-lg [&_button]:border-white/[0.09] [&_button]:bg-[#1c1c1c]">
                    <TimeSelect
                      label="Horário de início do expediente"
                      value={config.hora_inicio}
                      onChange={(v) => setConfig((p) => ({ ...p, hora_inicio: v }))}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="mb-2 text-xs font-medium text-white/60">Fim</p>
                  <div className="[&_button]:rounded-lg [&_button]:border-white/[0.09] [&_button]:bg-[#1c1c1c]">
                    <TimeSelect
                      label="Horário de término do expediente"
                      value={config.hora_fim}
                      onChange={(v) => setConfig((p) => ({ ...p, hora_fim: v }))}
                    />
                  </div>
                </div>
              </div>

              {/* Descanso */}
              <div className="space-y-4 border-y border-white/[0.07] py-4">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="intervalo-descanso"
                    checked={Boolean(config.intervalo_inicio && config.intervalo_duracao_min)}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setConfig((p) => ({
                        ...p,
                        intervalo_inicio: enabled ? p.intervalo_inicio ?? '12:00' : null,
                        intervalo_duracao_min: enabled ? p.intervalo_duracao_min ?? 60 : null,
                      }));
                    }}
                    className="sr-only peer"
                  />
                  <div className="relative h-5 w-9 flex-shrink-0 rounded-full border border-white/10 bg-white/[0.07] transition-colors
                    peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400/60 peer-checked:border-accent-400/70 peer-checked:bg-accent-400/70
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5
                    after:h-4 after:w-4 after:rounded-full after:transition-all after:duration-200
                    after:bg-white/45 peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  <span className="text-sm text-white/85">Intervalo de descanso</span>
                </label>

                {config.intervalo_inicio && config.intervalo_duracao_min && (
                  <>
                    <div className="space-y-4 pl-0 sm:pl-11">
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">Início</p>
                        <div className="[&_button]:rounded-lg [&_button]:border-white/[0.09] [&_button]:bg-[#1c1c1c]">
                          <TimeSelect
                            label="Início do intervalo de descanso"
                            value={config.intervalo_inicio ?? '12:00'}
                            onChange={(v) => setConfig((p) => ({ ...p, intervalo_inicio: v }))}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">Duração</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {INTERVALOS.map((intervalo) => (
                            <button
                              key={intervalo.value}
                              onClick={() =>
                                setConfig((p) => ({ ...p, intervalo_duracao_min: intervalo.value }))
                              }
                              aria-pressed={config.intervalo_duracao_min === intervalo.value}
                              className={`rounded-lg border py-2 text-xs font-medium transition-colors
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60
                                ${config.intervalo_duracao_min === intervalo.value
                                  ? 'border-accent-400/70 bg-white/[0.07] text-white shadow-[inset_0_-2px_0_rgba(119,114,251,0.8)]'
                                  : 'border-white/[0.08] bg-[#1c1c1c] text-white/50 hover:border-white/[0.16] hover:text-white/75'}`}
                            >
                              {intervalo.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="pl-0 text-xs text-white/45 sm:pl-11">
                      Descanso: {config.intervalo_inicio} até{' '}
                      {minutesToTime(
                        timeToMinutes(config.intervalo_inicio) + config.intervalo_duracao_min
                      )}
                    </p>
                  </>
                )}
              </div>

              {/* Duração */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/60">
                  <Clock size={12} />
                  Duração por atendimento
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURACOES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setConfig((p) => ({ ...p, duracao_min: d }))}
                      aria-pressed={config.duracao_min === d}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60
                        ${config.duracao_min === d
                          ? 'border-accent-400/70 bg-white/[0.07] text-white shadow-[inset_0_-2px_0_rgba(119,114,251,0.8)]'
                          : 'border-white/[0.08] bg-[#1c1c1c] text-white/50 hover:border-white/[0.16] hover:text-white/75'}`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Abertura da agenda */}
              <div className="border-t border-white/[0.07] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-white/60">Agenda aberta por</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {config.janela_agendamento_dias} dias
                    </p>
                  </div>
                  <span className="text-xs font-medium text-accent-200">
                    {config.janela_agendamento_dias === JANELA_MIN_DIAS
                      ? 'Mínimo'
                      : config.janela_agendamento_dias === JANELA_MAX_DIAS
                        ? 'Máximo'
                        : 'Personalizado'}
                  </span>
                </div>
                <input
                  type="range"
                  min={JANELA_MIN_DIAS}
                  max={JANELA_MAX_DIAS}
                  step={1}
                  value={config.janela_agendamento_dias}
                  aria-label="Dias de abertura da agenda"
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, janela_agendamento_dias: Number(e.target.value) }))
                  }
                  className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent-400
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919]
                             [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent-400
                             [&::-webkit-slider-thumb]:bg-[#191919]
                             [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                             [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent-400 [&::-moz-range-thumb]:bg-[#191919]"
                  style={{
                    background: `linear-gradient(to right, #7772fb 0%, #7772fb ${
                      ((config.janela_agendamento_dias - JANELA_MIN_DIAS) /
                        (JANELA_MAX_DIAS - JANELA_MIN_DIAS)) *
                      100
                    }%, rgba(255,255,255,0.1) ${
                      ((config.janela_agendamento_dias - JANELA_MIN_DIAS) /
                        (JANELA_MAX_DIAS - JANELA_MIN_DIAS)) *
                      100
                    }%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <div className="relative mt-2 h-4 text-[10px] font-medium text-white/35">
                  <span className="absolute left-0 top-0">{JANELA_MIN_DIAS} dias</span>
                  <span className="absolute top-0 -translate-x-1/2" style={{ left: '50%' }}>
                    7 dias
                  </span>
                  <span className="absolute right-0 top-0">{JANELA_MAX_DIAS} dias</span>
                </div>
              </div>

              {/* Preview de slots */}
              <div className="border-t border-white/[0.07] pt-4">
                <p className="mb-2 text-xs font-medium text-white/60">Slots gerados</p>
                <div className="flex flex-wrap gap-2">
                  {buildPreviewSlots(config).map((s) => (
                    <span key={s} className="rounded-md border border-white/[0.08] px-2 py-1 text-xs text-white/60">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Add new */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_40px]">
                <DateField
                  id="agenda-data-bloqueada"
                  name="data-bloqueada"
                  value={newDate}
                  onChange={setNewDate}
                />
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={newMotivo}
                  onChange={(e) => setNewMotivo(e.target.value)}
                  aria-label="Motivo do bloqueio"
                  className="min-w-0 rounded-lg border border-white/[0.09] bg-[#1c1c1c] px-3 py-2
                             text-base text-white placeholder:text-white/35 md:text-sm
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70"
                />
                <button
                  aria-label="Adicionar dia bloqueado"
                  onClick={handleAddBlocked}
                  disabled={!newDate}
                  className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919]
                             disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* List */}
              {blocked.length === 0 ? (
                <p className="py-8 text-center text-xs text-white/40">Nenhum dia bloqueado</p>
              ) : (
                <ul className={`max-h-48 divide-y divide-white/[0.07] overflow-y-auto ${SCROLLBAR_CLASS}`}>
                  {blocked.map((b) => (
                    <li
                      key={b.data}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-white">
                          {new Date(b.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {b.motivo && (
                          <span className="ml-2 text-xs text-white/45">{b.motivo}</span>
                        )}
                      </div>
                      <button
                        aria-label="Remover dia bloqueado"
                        onClick={() => handleRemoveBlocked(b.data)}
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex min-h-14 items-center justify-between border-t border-white/[0.07]
                        px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 md:py-3">
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`text-xs transition ${feedback ? 'text-[#07FF99]' : 'opacity-0'}`}
          >
            {feedback ?? '.'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 md:min-h-0"
            >
              Fechar
            </button>
            {tab === 'horarios' && (
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm
                           font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919] disabled:opacity-60 md:min-h-0"
              >
                <Save size={14} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
