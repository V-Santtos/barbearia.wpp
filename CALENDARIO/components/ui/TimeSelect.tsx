import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

export default function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>(Array(TIME_OPTIONS.length).fill(null));

  const closeDropdown = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropStyle({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const selectedIdx = TIME_OPTIONS.indexOf(value);
    const idx = selectedIdx >= 0 ? selectedIdx : 0;
    const timer = setTimeout(() => {
      optionRefs.current[idx]?.focus();
      optionRefs.current[idx]?.scrollIntoView({ block: 'nearest' });
    }, 0);
    const onMouseDown = (e: MouseEvent) => {
      if (
        listRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, value]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown();
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const currentIdx = optionRefs.current.indexOf(document.activeElement as HTMLLIElement);
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, TIME_OPTIONS.length - 1);
        optionRefs.current[next]?.focus();
        optionRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = Math.max(currentIdx - 1, 0);
        optionRefs.current[prev]?.focus();
        optionRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Home': {
        e.preventDefault();
        optionRefs.current[0]?.focus();
        optionRefs.current[0]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'End': {
        e.preventDefault();
        const last = TIME_OPTIONS.length - 1;
        optionRefs.current[last]?.focus();
        optionRefs.current[last]?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (currentIdx >= 0) {
          onChange(TIME_OPTIONS[currentIdx]);
          closeDropdown();
        }
        break;
      }
      case 'Escape':
      case 'Tab': {
        e.preventDefault();
        closeDropdown();
        break;
      }
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2
                   text-sm text-left text-white cursor-pointer
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]"
      >
        {value}
      </button>
      <ChevronDown
        size={14}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none transition-transform duration-150 ${
          open ? 'rotate-180' : ''
        }`}
      />
      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-label={label}
            onKeyDown={handleListKeyDown}
            style={{ position: 'fixed', zIndex: 9999, ...dropStyle }}
            className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1b20] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]
                       [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            {TIME_OPTIONS.map((t, idx) => (
              <li
                key={t}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                role="option"
                aria-selected={t === value}
                data-selected={t === value ? '' : undefined}
                tabIndex={-1}
                onClick={() => {
                  onChange(t);
                  closeDropdown();
                }}
                className={`cursor-pointer select-none px-3 py-[7px] text-sm transition-colors focus:outline-none focus:bg-white/10 ${
                  t === value
                    ? 'bg-[#6B3EFF]/25 text-white font-medium'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
