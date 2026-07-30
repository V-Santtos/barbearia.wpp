import { CalendarDays, BarChart2, MessageCircle } from 'lucide-react';

export type MobileTab = 'calendar' | 'dashboard' | 'conversations';

interface Props {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
  conversationCount?: number;
}

const tabs = [
  { id: 'calendar' as MobileTab, label: 'Agenda', icon: CalendarDays, placeholder: false },
  { id: 'conversations' as MobileTab, label: 'Conversas', icon: MessageCircle, placeholder: false },
  { id: 'dashboard' as MobileTab, label: 'Dashboard', icon: BarChart2, placeholder: true },
];

export default function MobileBottomNav({ tab, onChange, conversationCount = 0 }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#1c1c1c] border-t border-white/10 flex items-center justify-around"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map(({ id, label, icon: Icon, placeholder }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => !placeholder && onChange(id)}
            className="relative flex flex-col items-center gap-1 pt-3 px-6 min-w-[72px]"
            aria-label={placeholder ? `${label} — em breve` : label}
          >
            <Icon
              size={22}
              className={
                active
                  ? 'text-[#6B3EFF]'
                  : placeholder
                  ? 'text-white/20'
                  : 'text-white/40'
              }
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span
              className={`text-[10px] font-medium ${
                active
                  ? 'text-[#6B3EFF]'
                  : placeholder
                  ? 'text-white/20'
                  : 'text-white/40'
              }`}
            >
              {label}
            </span>
            {id === 'conversations' && conversationCount > 0 && (
              <span className="absolute top-2.5 right-3.5 min-w-4 h-4 rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white flex items-center justify-center">
                {conversationCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
