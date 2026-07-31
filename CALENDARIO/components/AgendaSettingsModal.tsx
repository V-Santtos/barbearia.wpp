import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Save, Clock } from 'lucide-react';
import type { Professional } from '../types';
import { AgendaSettingsSkeleton } from './ui/Skeleton';
import TimeSelect from './ui/TimeSelect';
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
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#101014] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6B3EFF]/45 hover:[&::-webkit-scrollbar-thumb]:bg-[#6B3EFF]/65';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-modal-title"
        className="relative w-full max-w-lg mx-4 sm:mx-0 rounded-2xl bg-[#1e1f24] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: professional.color }} />
            <span id="agenda-modal-title" className="text-sm font-semibold text-white">
              {professional.name}
            </span>
            <span className="text-xs text-white/40">— Configurações de agenda</span>
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10" role="tablist" aria-label="Seções de configuração">
          {(['horarios', 'bloqueados'] as const).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`tab-panel-${t}`}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition ${
                tab === t ? 'text-white border-b-2 border-[#6B3EFF]' : 'text-white/40 hover:text-white/70'
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
          className="p-5 overflow-y-auto flex-1"
        >
          {loading ? (
            <AgendaSettingsSkeleton />
          ) : tab === 'horarios' ? (
            <div className="space-y-5">
              {/* Dias da semana */}
              <div>
                <p className="text-xs text-white/60 mb-2">Dias de trabalho</p>
                <div className="flex gap-1.5 flex-wrap">
                  {WORK_DAYS.map((dia) => (
                    <button
                      key={dia.value}
                      onClick={() => toggleDia(dia.value)}
                      aria-pressed={config.dias_semana.includes(dia.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                        ${config.dias_semana.includes(dia.value)
                          ? 'bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
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
                    value={config.hora_inicio}
                    onChange={(v) => setConfig((p) => ({ ...p, hora_inicio: v }))}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/60 mb-2">Fim</p>
                  <TimeSelect
                    label="Horário de término do expediente"
                    value={config.hora_fim}
                    onChange={(v) => setConfig((p) => ({ ...p, hora_fim: v }))}
                  />
                </div>
              </div>

              {/* Descanso */}
              <div className={`space-y-3 rounded-xl border p-3 transition-colors ${
                Boolean(config.intervalo_inicio && config.intervalo_duracao_min)
                  ? 'border-[#6B3EFF]/30 bg-[#6B3EFF]/[0.04]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}>
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
                  <div className="relative w-9 h-5 flex-shrink-0 rounded-full transition-colors
                    bg-white/10 peer-checked:bg-[#6B3EFF]/70
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5
                    after:h-4 after:w-4 after:rounded-full after:transition-all after:duration-200
                    after:bg-white/40 peer-checked:after:translate-x-4 peer-checked:after:bg-white" />
                  <span className="text-sm text-white/85">Intervalo de descanso</span>
                </label>

                {config.intervalo_inicio && config.intervalo_duracao_min && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-white/60 mb-2">Início</p>
                        <TimeSelect
                          label="Início do intervalo de descanso"
                          value={config.intervalo_inicio ?? '12:00'}
                          onChange={(v) => setConfig((p) => ({ ...p, intervalo_inicio: v }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-2">Duração</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {INTERVALOS.map((intervalo) => (
                            <button
                              key={intervalo.value}
                              onClick={() =>
                                setConfig((p) => ({ ...p, intervalo_duracao_min: intervalo.value }))
                              }
                              aria-pressed={config.intervalo_duracao_min === intervalo.value}
                              className={`py-2 rounded-xl text-xs font-medium transition
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                                ${config.intervalo_duracao_min === intervalo.value
                                  ? 'bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]'
                                  : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                            >
                              {intervalo.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-white/40">
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
                <p className="text-xs text-white/50 mb-2 flex items-center gap-1">
                  <Clock size={12} />
                  Duração por atendimento
                </p>
                <div className="flex gap-1.5">
                  {DURACOES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setConfig((p) => ({ ...p, duracao_min: d }))}
                      aria-pressed={config.duracao_min === d}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/60
                        ${config.duracao_min === d
                          ? 'bg-[#6B3EFF] text-white shadow-[0_0_10px_#6B3EFF55]'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
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
                    <p className="text-xs text-white/50">Agenda aberta por</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {config.janela_agendamento_dias} dias
                    </p>
                  </div>
                  <span className="rounded-full bg-[#6B3EFF]/20 px-2.5 py-1 text-xs font-semibold text-[#c9b8ff]">
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
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#6B3EFF]
                             [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(107,62,255,0.35),0_0_18px_rgba(107,62,255,0.55)]
                             [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
                             [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
                  style={{
                    background: `linear-gradient(to right, #6B3EFF 0%, #6B3EFF ${
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
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-white/55 mb-1.5">Slots gerados</p>
                <div className="flex flex-wrap gap-1.5">
                  {buildPreviewSlots(config).map((s) => (
                    <span key={s} className="text-xs text-white/65 bg-white/[0.08] px-2 py-0.5 rounded-lg">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add new */}
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2
                             text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]"
                />
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={newMotivo}
                  onChange={(e) => setNewMotivo(e.target.value)}
                  className="flex-[2] rounded-xl bg-white/5 border border-white/10 px-3 py-2
                             text-sm text-white placeholder:text-white/30
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]"
                />
                <button
                  aria-label="Adicionar dia bloqueado"
                  onClick={handleAddBlocked}
                  disabled={!newDate}
                  className="rounded-xl bg-[#6B3EFF] px-3 py-2 text-white hover:bg-[#825CFF]
                             disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* List */}
              {blocked.length === 0 ? (
                <p className="text-center text-xs text-white/30 py-8">Nenhum dia bloqueado</p>
              ) : (
                <ul className={`space-y-1.5 max-h-48 overflow-y-auto ${SCROLLBAR_CLASS}`}>
                  {blocked.map((b) => (
                    <li
                      key={b.data}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm text-white">
                          {new Date(b.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {b.motivo && (
                          <span className="ml-2 text-xs text-white/40">{b.motivo}</span>
                        )}
                      </div>
                      <button
                        aria-label="Remover dia bloqueado"
                        onClick={() => handleRemoveBlocked(b.data)}
                        className="rounded-xl p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition"
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
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
              className="rounded-xl px-4 py-2 text-sm text-white/50 hover:bg-white/5 transition"
            >
              Fechar
            </button>
            {tab === 'horarios' && (
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#6B3EFF] px-4 py-2 text-sm
                           font-semibold text-white hover:bg-[#825CFF] disabled:opacity-60 transition"
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
