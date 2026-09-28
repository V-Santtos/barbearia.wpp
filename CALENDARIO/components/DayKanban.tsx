import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { Event, Professional } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { Scissors, Sun, Sunset, Moon, ChevronRight, Pencil, Check, UserCheck } from 'lucide-react';
import { NeonCheckbox } from './ui/NeonCheckbox';
import { MODO_DEMONSTRACAO } from '../lib/modoDemonstracao';
import { CASCA_BACKGROUND, CASCA_BORDER } from './ui/vidro';
import { useMediaQuery } from '../hooks/useMediaQuery';
import FecharAtendimentoModal from './FecharAtendimentoModal';
import type { ConcluirAtendimentoPayload } from '../services/calendarApi';

interface DayKanbanProps {
  currentDate: Date;
  events: Event[];
  professionals: Professional[];
  onEventClick: (event: Event) => void;
  /** Grava o fechamento. Rejeitar mostra o erro dentro do resumo. */
  onConcluirAtendimento: (evento: Event, payload: ConcluirAtendimentoPayload) => Promise<void>;
  selectedProfessionals?: Set<number>;
  onProfessionalToggle?: (id: number) => void;
}

type Period = 'morning' | 'afternoon' | 'night';

const periodConfig = {
  morning:   { label: 'Manhã', Icon: Sun,    accent: 'rgba(251,191,36,0.22)' },
  afternoon: { label: 'Tarde', Icon: Sunset, accent: 'rgba(255,255,255,0.10)' },
  night:     { label: 'Noite', Icon: Moon,   accent: 'rgba(99,102,241,0.28)' },
} as const;

const PERIOD_ORDER: Period[] = ['morning', 'afternoon', 'night'];

function currentPeriod(): Period {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'night';
}

const DayKanban: React.FC<DayKanbanProps> = ({
  currentDate,
  events,
  professionals,
  onEventClick,
  onConcluirAtendimento,
  selectedProfessionals,
  onProfessionalToggle,
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [completingIds, setCompletingIds] = useState<Set<number>>(() => new Set());
  const [liveMessage, setLiveMessage] = useState('');
  /* Card cujo "Marcar como feito" abriu o resumo (2026-09-27). */
  const [emFechamento, setEmFechamento] = useState<Event | null>(null);
  const [activePeriod, setActivePeriod] = useState<Period>(currentPeriod);
  /* Acordeão exclusivo (decidido com o dono): só um chip aberto por vez em
     todo o dia, não por coluna -- é o que garante que nenhuma coluna volta a
     crescer pros ~445px que a Frente 1 existe pra resolver. */
  const [openId, setOpenId] = useState<number | null>(null);
  /* Exemplos "marcados como feitos": somem só na tela, até recarregar. */
  const [exemplosFeitos, setExemplosFeitos] = useState<Set<number>>(() => new Set());
  const toggleOpen = (id: number) =>
    setOpenId((prev) => (prev === id ? null : id));

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);

  const activePros = selectedProfessionals || new Set(professionals.map(p => p.id));

  const filteredEvents = events.filter(
    (e) =>
      activePros.has(e.professionalId) &&
      e.date === currentDate.toLocaleDateString('en-CA')
  );

  const getPeriod = (time: string): Period => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'night';
  };

  /* Dois cards de exemplo na coluna da Noite, no lugar do "Noite livre" --
     pedido do dono em 2026-08-04, mesmo idioma dos placeholders da tela de
     Conversas: só aparecem quando NÃO há dado real, e somem sozinhos assim
     que o primeiro agendamento de verdade cair no período.

     São um de cada tipo, porque as duas anatomias de card são diferentes e
     ele quer ver as duas lado a lado:
       - `presencial`: como se tivesse acabado de sair do FAB -- fundo tingido
         com a cor do barbeiro, borda esquerda tracejada, tag "presencial",
         card não clicável.
       - agendado: o card normal do bot, com serviço e horário.

     `id` NEGATIVO de propósito: é o que `isPlaceholder` usa lá embaixo para
     desligar clique e conclusão. O banco só emite id positivo, então não há
     como um evento real cair nessa peneira. */
  const nightPlaceholders: Event[] = React.useMemo(() => {
    const hoje = currentDate.toLocaleDateString('en-CA');
    const primeiro = professionals[0];
    const segundo = professionals[1] ?? professionals[0];
    // Só no modo de teste (28/09/2026). Contra o banco real, o dono veria um card
    // falso na agenda da noite dele — com nome de cliente e horário.
    if (!MODO_DEMONSTRACAO || !primeiro) return [];
    return [
      {
        id: -101,
        title: 'Cliente presencial',
        date: hoje,
        startTime: '19:00',
        endTime: '19:40',
        professionalId: primeiro.id,
        servico: null,
        source: 'presencial',
      },
      {
        id: -102,
        title: 'João Pereira (exemplo)',
        date: hoje,
        startTime: '20:00',
        endTime: '20:40',
        professionalId: segundo.id,
        servico: 'Corte + barba',
        source: 'bot',
      },
    ].filter((exemplo) => !exemplosFeitos.has(exemplo.id));
  }, [currentDate, professionals, exemplosFeitos]);

  const eventosDaNoite = filteredEvents.filter((e) => getPeriod(e.startTime) === 'night');

  /* Contagem que os rótulos mostram: só o que é real. Card de exemplo desenha
     mas não conta -- "Noite 2" com dois exemplos seria número inventado. */
  const contarReais = (lista: Event[]) => lista.filter((e) => e.id > 0).length;

  const byPeriod: Record<Period, Event[]> = {
    morning:   filteredEvents.filter((e) => getPeriod(e.startTime) === 'morning'),
    afternoon: filteredEvents.filter((e) => getPeriod(e.startTime) === 'afternoon'),
    night:     eventosDaNoite.length > 0 ? eventosDaNoite : nightPlaceholders,
  };

  // Scroll to activePeriod on mount (mobile only)
  useEffect(() => {
    if (!isMobile || !scrollRef.current) return;
    const idx = PERIOD_ORDER.indexOf(activePeriod);
    scrollRef.current.scrollLeft = idx * scrollRef.current.clientWidth;
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToPeriod = useCallback((period: Period) => {
    if (!scrollRef.current) return;
    const idx = PERIOD_ORDER.indexOf(period);
    scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' });
    setActivePeriod(period);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || scrolling.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    const p = PERIOD_ORDER[Math.max(0, Math.min(idx, 2))];
    if (p !== activePeriod) setActivePeriod(p);
  }, [activePeriod]);

  /* Só depois do fechamento gravado o card desliza para fora. O real some
     quando o App troca o status (ele espera a animação); o exemplo não existe
     no banco e sai só da tela, sem chamar a API. */
  const concluirFechamento = async (event: Event, payload: ConcluirAtendimentoPayload) => {
    if (event.id > 0) await onConcluirAtendimento(event, payload);
    setEmFechamento(null);
    setCompletingIds((prev) => new Set(prev).add(event.id));
    setLiveMessage(`${event.source === 'presencial' ? 'Presencial' : event.title} marcado como feito`);
    setTimeout(() => {
      if (event.id < 0) setExemplosFeitos((prev) => new Set(prev).add(event.id));
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      setTimeout(() => setLiveMessage(''), 1500);
    }, 220);
  };

  const renderCard = (event: Event) => {
    const professional = professionals.find(p => p.id === event.professionalId);
    const profColor = professional?.color || '#5650f9';
    const isCompleting = completingIds.has(event.id);
    const isPresencial = event.source === 'presencial';
    /* Card de exemplo (id negativo): ações iguais às de um card real, para o
       dono testar o fluxo (2026-09-27). O lápis abre o modal, que não grava;
       "Marcar como feito" tira o card só da tela. Nada chega à API. */
    const isPlaceholder = event.id < 0;
    const isOpen = openId === event.id;
    /* Presencial é um BLOQUEIO, não um cliente: nasce da tesoura, quando o
       barbeiro avisa que está atendendo alguém sem hora marcada. Por isso ele
       é levemente diferente dos outros -- listras diagonais (o sinal de
       "horário ocupado" nos calendários) e o intervalo com um pontinho vivo no
       lugar só do início, porque num bloqueio a pergunta é "quando ele libera?".
       Título branco como os outros; antes era colorido e com fio tracejado,
       que liam como link e borda quebrada (2026-09-26). O rótulo é fixo: o
       `title` do banco vem como "Atendimento Presencial", em caixa de título, e
       "Atendimento presencial" inteiro não cabe ao lado do intervalo em 375px. */
    const agoraHHMM = new Date().toTimeString().slice(0, 5);
    const acontecendoAgora =
      isPresencial &&
      event.date === new Date().toLocaleDateString('en-CA') &&
      event.startTime <= agoraHHMM &&
      agoraHHMM < event.endTime;

    return (
      <div
        key={event.id}
        className={`overflow-hidden rounded-xl transition-[opacity,transform] duration-300
                   ease-[cubic-bezier(0.25,0.1,0.25,1)]
                   ${isCompleting ? 'translate-y-2 opacity-0' : isPlaceholder ? 'opacity-70' : 'opacity-100'}`}
        style={{
          backgroundImage: isPresencial
            ? `repeating-linear-gradient(135deg, transparent 0 7px, rgba(255,255,255,0.025) 7px 14px), ${CASCA_BACKGROUND}`
            : CASCA_BACKGROUND,
          border: CASCA_BORDER,
          borderLeftColor: profColor,
          borderLeftWidth: '3px',
          borderLeftStyle: 'solid',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
        }}
      >
        {/* Fechado (~48px): fio de cor + chevron + nome + horário de início.
            A cor do barbeiro entra só aqui, no dot de baixo e no focus-ring --
            fundo tingido e sombra colorida saíram (Frente 1, "cromática"). */}
        <button
          type="button"
          onClick={() => toggleOpen(event.id)}
          aria-expanded={isOpen}
          className="flex h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left
                     focus-visible:outline-none focus-visible:ring-2"
          style={{ '--tw-ring-color': profColor } as CSSProperties}
        >
          <ChevronRight
            size={16}
            className={`flex-shrink-0 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          {/* O nome do cliente é a resposta da única pergunta que o dono faz
              ao abrir o app ("quem é o próximo") -- 16px, o mesmo da linha de
              Conversas que ele validou. */}
          {isPresencial ? (
            /* Pessoinha antes do rótulo: diz "cliente presente" antes da
               palavra e ancora o card entre os outros. Cinza, para o destaque
               continuar sendo o título. */
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <UserCheck size={16} aria-hidden="true" className="flex-shrink-0 text-white/55" />
              <span className="min-w-0 truncate text-[16px] font-semibold leading-tight text-white">
                Presencial
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight text-white">
              {event.title}
            </span>
          )}
          {isPresencial ? (
            <span className="flex flex-shrink-0 items-center gap-1.5 text-[14px] tabular-nums text-white/50">
              <span className="relative flex h-1.5 w-1.5">
                {acontecendoAgora && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping"
                    style={{ backgroundColor: profColor }}
                  />
                )}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: profColor }} />
              </span>
              {event.startTime}–{event.endTime}
            </span>
          ) : (
            <span className="flex-shrink-0 text-[14px] tabular-nums text-white/50">
              {event.startTime}
            </span>
          )}
        </button>

        {/* Aberto: o mesmo chip cresce, sem trocar de peça -- serviço,
            profissional, horário completo, tag presencial e as duas ações. */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 },
                opacity: { duration: 0.15 },
              }}
              className="overflow-hidden"
            >
              <div className="space-y-2 px-3 pb-3 pt-0.5">
                {/* Presencial não repete aqui o que o título já diz. */}
                {!isPresencial && (
                  <div className="flex items-center gap-1.5 text-[14px] text-white/60">
                    <Scissors size={14} className="flex-shrink-0 text-white/35" />
                    <span className="truncate">{event.servico || 'Sem serviço informado'}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[14px] text-white/60">
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: profColor }}
                  />
                  <span className="truncate">{professional?.name ?? 'Profissional'}</span>
                </div>

                <p className="text-[14px] tabular-nums text-white/50">
                  {event.startTime} → {event.endTime}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  {/* Lápis -- a porta de editar depois que o toque no chip
                      passou a abrir/fechar em vez de abrir o EventModal
                      direto (Frente 1, decidido com o dono). Mesmo gate de
                      antes: presencial e placeholder continuam sem edição. */}
                  {!isPresencial && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      aria-label={`Editar ${event.title}`}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl
                                 text-white/50 transition-colors hover:bg-white/10 hover:text-white
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <Pencil size={16} />
                    </button>
                  )}

                  <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmFechamento(event);
                      }}
                      disabled={isCompleting}
                      /* Ação operacional, não CTA global: largura pelo conteúdo,
                         superfície neutra e cor do profissional somente no check.
                         h-11 preserva o alvo de toque de 44px no celular. */
                      className="ml-auto inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg
                                 border border-white/[0.10] bg-white/[0.035] px-3 text-[13px]
                                 font-medium text-white/70 transition-colors
                                 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white
                                 active:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <Check aria-hidden="true" size={15} strokeWidth={2.25} style={{ color: profColor }} />
                      {isCompleting ? 'Marcando...' : 'Marcar como feito'}
                    </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderPeriodColumn = (periodKey: Period, full?: boolean) => {
    const { label, Icon, accent } = periodConfig[periodKey];
    const periodEvents = byPeriod[periodKey];
    return (
      <div
        /* `full` é o celular, e lá a coluna não é caixa (2026-09-26): os cards
           ficam soltos direto na moldura. O cabeçalho "NOITE 1" repetia a aba
           "Noite 1" logo acima, e a caixa em volta era a terceira borda
           empilhada (moldura > período > card) -- comia ~40px de largura e era
           por isso que o card do cliente ficava apertado. No desktop as três
           colunas continuam caixas: lá não há aba, o cabeçalho é o rótulo. */
        className={full ? 'flex h-full w-full min-h-0 flex-col' : 'flex flex-1 min-h-0 flex-col rounded-2xl border border-[#2a2a2a] p-4'}
        style={full ? undefined : {
          backgroundColor: '#181818',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          boxShadow: `inset 0 2px 0 ${accent}`,
        }}
      >
        {!full && (
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-3 flex-shrink-0">
            <Icon size={12} className="opacity-60" />
            {label}
            {contarReais(periodEvents) > 0 && (
              <span className="ml-auto normal-case tracking-normal font-medium text-white/30">{contarReais(periodEvents)}</span>
            )}
          </h3>
        )}

        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5
                     [&::-webkit-scrollbar]:w-1
                     [&::-webkit-scrollbar-thumb]:rounded-full
                     [&::-webkit-scrollbar-thumb]:bg-white/10
                     [&::-webkit-scrollbar-track]:transparent"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            /* O chão de 104px das telas roláveis (ver MobileBottomNav): a lista
               passa por baixo do dock, mas o último card ainda sobe acima dele. */
            ...(full && { paddingBottom: 'calc(104px + env(safe-area-inset-bottom))' }),
          }}
        >
          {periodEvents.length > 0 ? (
            periodEvents.map(renderCard)
          ) : (
            <div className="flex flex-col items-center gap-2 pt-8">
              <Icon size={22} className="text-white/10" />
              <p className="text-[14px] text-white/40 text-center">{label} livre</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    /* No celular a moldura não fecha embaixo: desce até o fim da tela e o dock
       flutua por cima do conteúdo, como no iOS (2026-09-26). Antes ela e o
       card do período terminavam exatamente atrás da pílula, e as duas bordas
       cruzando por trás do dock liam como peça encavalada. */
    /* Régua de 16px no celular: a moldura a 16px da borda da tela (era 8px,
       enquanto o cabeçalho e a linha do tempo do Dia já usavam 16) e o
       conteúdo a 16px da moldura. */
    <div
      className="flex flex-col h-full mx-4 md:mx-0 bg-[#141314]
                 border border-white/[0.08] border-b-0 rounded-t-[28px]
                 md:border-b md:rounded-[28px]
                 overflow-hidden px-4 pt-4 pb-0 md:px-5 md:pt-5 md:pb-5"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">{liveMessage}</div>

      <FecharAtendimentoModal
        evento={emFechamento}
        profissional={professionals.find((p) => p.id === emFechamento?.professionalId)}
        onFechar={() => setEmFechamento(null)}
        onConcluir={concluirFechamento}
      />

      {/* Barra de filtros */}
      <div className="flex items-center gap-5 mb-4 flex-shrink-0">
        {professionals.map((p) => (
          <NeonCheckbox
            key={p.id}
            checked={activePros.has(p.id)}
            onChange={() => onProfessionalToggle?.(p.id)}
            color={p.color}
            size={20}
            label={
              /* No celular, só o primeiro nome e sem quebra: três nomes completos
                 não cabem em 375px e cada um virava duas linhas, desmontando a
                 barra. Mesmo critério do selo "Em atendimento" do CalendarHeader. */
              <span
                title={p.name}
                className={`whitespace-nowrap text-[14px] font-medium transition-colors duration-200 ${
                  activePros.has(p.id) ? 'text-white/80' : 'text-white/35'
                }`}
              >
                <span className="md:hidden">{p.name.trim().split(' ')[0]}</span>
                <span className="hidden md:inline">{p.name}</span>
              </span>
            }
          />
        ))}
      </div>

      {isMobile ? (
        <>
          {/* Tabs de período — mobile */}
          <div className="flex gap-2 mb-3 flex-shrink-0">
            {PERIOD_ORDER.map((p) => {
              const { label, Icon } = periodConfig[p];
              const isActive = activePeriod === p;
              const count = contarReais(byPeriod[p]);
              return (
                /* Selecionado deixou de ser ROXO em 2026-08-04 (pedido do
                   dono, terceira peça a sair do roxo depois do dock e do
                   Dia/Semana/Mês da gaveta). Pegou emprestado o idioma do
                   DOCK -- pílula cinza/vidro -- e não o da gaveta (pílula
                   branca), porque os dois controles fazem a MESMA coisa:
                   trocar a fatia do conteúdo que continua na tela, sem
                   comprometer nada. A pílula branca é o maior contraste que
                   o app consegue pintar e marca destino escolhido (a gaveta
                   fecha depois de clicar); gastá-la num filtro que ele estala
                   o dia inteiro faria do FILTRO a coisa mais gritante da tela
                   de Agenda, no lugar dos agendamentos. Os dois controles
                   ainda são fileiras de três pílulas na mesma tela: dois
                   idiomas de "ativo" em peças gêmeas era a inconsistência.
                   Os valores são os literais do dock (`10-mobile.css:322` e
                   `:336`), não aproximações.
                   Inativo subiu de `white/35` (3,32:1 -- reprova AA) para
                   `white/45`, e a altura de 30px para 44 (alvo de toque). */
                <button
                  key={p}
                  onClick={() => scrollToPeriod(p)}
                  className={`flex-1 flex min-h-[44px] items-center justify-center gap-1.5 py-2.5 rounded-xl text-[14px] font-semibold transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                    ${isActive
                      /* Escolha feita = contorno roxo, fundo neutro (regra do site público). */
                      ? 'bg-white/[0.12] text-white border border-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                      : 'bg-white/[0.04] text-white/45 border border-transparent'
                    }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.3 : 1.8} />
                  {label}
                  {count > 0 && (
                    <span className={`text-[12px] font-bold ${isActive ? 'text-white/70' : 'text-white/40'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Carrossel horizontal com snap */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {PERIOD_ORDER.map((p) => (
              <div key={p} className="flex-shrink-0 w-full snap-start h-full">
                {renderPeriodColumn(p, true)}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Desktop — 3 colunas */
        <div className="flex flex-1 min-h-0 gap-4">
          {PERIOD_ORDER.map((p) => renderPeriodColumn(p))}
        </div>
      )}
    </div>
  );
};

export default DayKanban;
