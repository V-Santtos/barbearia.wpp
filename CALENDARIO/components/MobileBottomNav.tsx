import { CalendarDays, BarChart2, MessageCircle } from 'lucide-react';
import './dashboard/css/index.css';

export type MobileTab = 'calendar' | 'dashboard' | 'conversations';

interface Props {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
  conversationCount?: number;
}

const tabs = [
  { id: 'calendar' as MobileTab, label: 'Agenda', icon: CalendarDays },
  { id: 'conversations' as MobileTab, label: 'Conversas', icon: MessageCircle },
  { id: 'dashboard' as MobileTab, label: 'Dashboard', icon: BarChart2 },
];

/**
 * Dock flutuante: pílula solta do rodapé, vidro fosco, o conteúdo passando por
 * baixo. Substituiu a barra chapada de ponta a ponta em 2026-08-04.
 *
 * Duas coisas da referência ficaram de fora, de propósito:
 *
 * - O rótulo por tooltip, que depende de hover e não existe em tela de toque.
 *   Quem diz onde você está é a cor mais o ponto sob o ícone. Se um dia o ícone
 *   pelado parecer mudo demais, o conserto barato é a aba ativa expandir e
 *   mostrar o rótulo dela — só ela.
 * - A flutuação em laço e o `rotateX` de perspectiva, que são graça de dock de
 *   vitrine. Isto aqui é a navegação do app: fica parada.
 *
 * O respiro de 104px no fim de cada tela rolável existe por causa daqui: o dock
 * flutua POR CIMA da rolagem, e sem chão o último painel morre embaixo dele.
 */
export default function MobileBottomNav({ tab, onChange, conversationCount = 0 }: Props) {
  return (
    <div className="dash-root md:hidden">
      <nav className="mb-dock" aria-label="Navegação">
        {tabs.map(({ id, label, icon: Icon }) => {
          const ativo = tab === id;
          return (
            <button
              key={id}
              className={`mb-dock__item${ativo ? ' is-active' : ''}`}
              onClick={() => onChange(id)}
              aria-current={ativo ? 'page' : undefined}
              aria-label={label}
            >
              <Icon size={24} strokeWidth={ativo ? 2.3 : 1.8} />
              {/* Sempre no DOM: aparecer e sumir não pode empurrar o ícone. */}
              <span className="mb-dock__dot" />
              {id === 'conversations' && conversationCount > 0 && (
                <span className="mb-dock__badge">{conversationCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
