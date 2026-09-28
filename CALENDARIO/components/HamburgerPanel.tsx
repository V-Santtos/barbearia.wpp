import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, CirclePlus, Calendar, CalendarDays, CalendarRange, Settings, PaintBucket, Trash2 } from 'lucide-react';
import type { CalendarView, Professional } from '../types';
import { NeonCheckbox } from './ui/NeonCheckbox';
import { CORES_PROFISSIONAIS } from '../lib/coresProfissionais';
import { SUPERFICIE_MENU } from './ui/menuFlutuante';

/* O "Criar agendamento" é a mesma peça do "Criar" da coluna do desktop
   (`shell/ColunaDeSecoes.tsx`): pílula branca, texto escuro, "+" roxo como único
   respingo de marca. Só a altura muda (44px), porque aqui é alvo de toque. Era o
   botão de vidro de `ui/vidro.ts`, que continua servindo os chips do dia. */

interface Props {
  open: boolean;
  onClose: () => void;
  onAddEvent: () => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  professionals: Professional[];
  selectedProfessionals: Set<number>;
  onProfessionalToggle: (id: number) => void;
  onAddProfessionalRequest: () => void;
  onDeleteProfessional: (id: number) => void;
  onChangeProfessionalColor: (id: number, color: string) => void;
  onOpenSettings: (id: number) => void;
}

const VIEW_OPTIONS = [
  { key: 'day' as CalendarView, label: 'Dia', Icon: Calendar },
  { key: 'week' as CalendarView, label: 'Semana', Icon: CalendarRange },
  { key: 'month' as CalendarView, label: 'Mês', Icon: CalendarDays },
];

export default function HamburgerPanel({
  open,
  onClose,
  onAddEvent,
  view,
  onViewChange,
  professionals,
  selectedProfessionals,
  onProfessionalToggle,
  onAddProfessionalRequest,
  onDeleteProfessional,
  onChangeProfessionalColor,
  onOpenSettings,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[60] bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.aside
            key="panel"
            /* Era `w-72` (288px) fixo. Em % o painel acompanha o aparelho e
               sobra largura pro texto crescer sem truncar; o teto existe pra
               não virar tela cheia em celular grande.
               Os dois números caíram 10% em 2026-08-04 (82%/320 -> 74%/288):
               no aparelho do dono quem manda é o teto, e a gaveta estava
               comendo tela demais. Quem governa a largura é ELE, não a % --
               mexer só na % não muda nada num celular de 390px. */
            className="fixed inset-y-0 left-0 z-[70] w-[74%] max-w-[288px] bg-[#161616] border-r border-white/[0.08] flex flex-col md:hidden"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          >
            {/* Header do painel */}
            {/* "Menu" era 19px -- a mesma escala dos itens da lista logo
                abaixo, e por isso não lia como título, lia como mais uma
                linha. Em 27px ele volta a ser o topo da hierarquia da gaveta.
                O `tracking` negativo não é enfeite: peso bold em corpo grande
                abre espaço demais entre as letras, e sem apertar a palavra
                fica frouxa. O X subiu junto (21 -> 23) porque um ícone que
                não cresce com o título ao lado vira miudeza. */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-white/[0.06]">
              {/* 19 -> 27 -> 24. Os 27 passaram do ponto: viraram o maior
                  texto de chrome do app, maior que o título de Conversas
                  (22px), que é o padrão da casa. A gaveta é superfície
                  secundária -- o título dela não pode gritar mais alto que o
                  título da tela que está atrás. 24 é o teto: ainda lê como
                  título de verdade, sem passar por cima do padrão. */}
              <span className="text-[24px] font-bold tracking-[-0.02em] text-white leading-[1.1]">
                Menu
              </span>
              <button
                onClick={onClose}
                className="p-2.5 -mr-2 rounded-full hover:bg-white/[0.08] transition-colors"
                aria-label="Fechar menu"
              >
                <X size={23} className="text-white/60" />
              </button>
            </div>

            {/* Botão Criar -- ver o topo do arquivo. */}
            <div className="px-5 pt-5">
              <button
                type="button"
                onClick={() => { onAddEvent(); onClose(); }}
                className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap
                           rounded-lg bg-white text-[15px] font-semibold text-[#17151c]
                           transition-colors hover:bg-white/90 active:bg-white/85
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <CirclePlus size={18} strokeWidth={2} className="flex-shrink-0 text-accent" />
                Criar agendamento
              </button>
            </div>

            {/* Modos de visualização */}
            <div className="px-5 pt-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45 mb-2.5">
                Visualização
              </p>
              <div className="flex flex-col gap-1">
                {VIEW_OPTIONS.map(({ key, label, Icon }) => {
                  const active = view === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { onViewChange(key); onClose(); }}
                      /* Selecionado é BRANCO, não roxo -- pedido do dono em
                         2026-08-04 ("muita firula", o painel devia ser mais
                         minimalista). Inverter o contraste marca o item ativo
                         com mais força do que um fundo colorido de 15% de alfa
                         conseguia, e de quebra tira a última cor do painel:
                         o que sobra de colorido agora é só o quadrado de cada
                         profissional, que é dado, não enfeite. */
                      className={[
                        'flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] transition-colors text-left',
                        active
                          ? 'bg-white text-[#161616] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.35)]'
                          : 'text-white/60 font-medium hover:bg-white/[0.05] hover:text-white/85',
                      ].join(' ')}
                    >
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.4 : 1.9}
                        className={active ? 'text-[#161616]' : 'text-white/40'}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Profissionais */}
            <div className="px-5 pt-7 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                  Profissionais
                </p>
                <button
                  onClick={() => { onAddProfessionalRequest(); onClose(); }}
                  aria-label="Adicionar profissional"
                  className="rounded-xl p-1.5 -mr-1.5 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <Plus size={19} strokeWidth={2} />
                </button>
              </div>

              {/* Cada profissional ganhou altura de linha de lista (py-2) em
                  vez de linha de texto solta: no celular isso é área de toque,
                  não só respiro.

                  A caixa de marcar era um `<input type="checkbox">` cru de
                  19px com `accentColor`. Virou o mesmo `NeonCheckbox` da barra
                  de filtros da Agenda (2026-08-04): é literalmente o mesmo
                  controle, sobre os mesmos profissionais, e ter duas caixas
                  diferentes pra mesma decisão era a inconsistência mais
                  visível da gaveta. Vem de brinde a animação do check e o
                  alvo de toque de 22px + o rótulo inteiro clicável. */}
              <ul className="space-y-0.5">
                {professionals.map((prof) => (
                  <li key={prof.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <NeonCheckbox
                        id={`hb-prof-${prof.id}`}
                        checked={selectedProfessionals.has(prof.id)}
                        onChange={() => onProfessionalToggle(prof.id)}
                        color={prof.color}
                        size={22}
                        className="min-w-0 flex-1"
                        label={
                          <span
                            className={`text-[16px] truncate transition-colors duration-200 ${
                              selectedProfessionals.has(prof.id)
                                ? 'text-white/85'
                                : 'text-white/40'
                            }`}
                          >
                            {prof.name}
                          </span>
                        }
                      />
                    </div>

                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === prof.id ? null : prof.id)}
                        aria-label={`Opções de ${prof.name}`}
                        className="p-2 -mr-1 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {openMenuId === prof.id && (
                          <motion.div
                            className={`absolute right-0 top-full mt-1 w-52 z-20 overflow-hidden ${SUPERFICIE_MENU}`}
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15 }}
                          >
                            <button
                              onClick={() => { onOpenSettings(prof.id); setOpenMenuId(null); onClose(); }}
                              className="flex w-full items-center gap-3 px-3.5 py-3 text-[15px] text-left text-gray-200 hover:bg-white/10 transition-colors"
                            >
                              <Settings size={17} />
                              Configurar agenda
                            </button>
                            <button
                              onClick={() => { setShowColorPicker(prof.id); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-3 px-3.5 py-3 text-[15px] text-left text-gray-200 hover:bg-white/10 transition-colors"
                            >
                              <PaintBucket size={17} />
                              Alterar cor
                            </button>
                            <button
                              onClick={() => { onDeleteProfessional(prof.id); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-3 px-3.5 py-3 text-[15px] text-left text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={17} />
                              Excluir profissional
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Color Picker (portal dentro do painel) */}
            {showColorPicker !== null && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50"
                onClick={() => setShowColorPicker(null)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Escolher cor do profissional"
                  className="w-full rounded-t-2xl border-t border-white/10 bg-[#28292d]
                             px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-4 text-sm font-semibold text-white">Cor do profissional</p>
                  <div className="grid grid-cols-4 justify-center gap-3">
                    {CORES_PROFISSIONAIS.map((color) => (
                      <button
                        key={color}
                        onClick={() => { onChangeProfessionalColor(showColorPicker, color); setShowColorPicker(null); }}
                        aria-label={`Escolher cor ${color}`}
                        className="h-11 w-11 rounded-full transition-transform active:scale-95"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>,
              document.body,
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
