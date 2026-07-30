import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gem, LogOut, Settings, User } from 'lucide-react';
import type { OwnerSession } from './LoginScreen';
import ProfileModal from './ProfileModal';
import type { Professional } from '../types';

interface UserMenuProps {
  owner: OwnerSession;
  onLogout: () => void;
  professionals: Professional[];
}

const DEFAULT_PROFILE_AVATAR_URL =
  'https://sppexvjvnoganlduyjvs.supabase.co/storage/v1/object/public/FOTO/619886691_17855063583606334_3904812273743958652_n.jpg';

function getInitials(name?: string) {
  if (!name) return 'PR';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'PR';
}

export default function UserMenu({ owner, onLogout, professionals }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState<string>(owner.name);
  const [avatarUrl, setAvatarUrl] = React.useState<string>(DEFAULT_PROFILE_AVATAR_URL);

  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setDisplayName(owner.name);
  }, [owner.name]);

  React.useEffect(() => {
    const handleDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popRef.current || !btnRef.current) return;
      if (popRef.current.contains(target) || btnRef.current.contains(target)) return;
      setOpen(false);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const initials = getInitials(displayName);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Menu do usuário"
        className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-primary font-semibold text-primary-foreground shadow-[0_0_0_2px_rgba(107,62,255,0.18)] transition hover:border-[#6B3EFF]/55 hover:brightness-110"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="size-full select-none object-cover"
            loading="eager"
            decoding="sync"
            draggable={false}
          />
        ) : (
          initials
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popRef}
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="menu-dropdown absolute right-0 top-[52px] z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#2a2a2a]/70 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
            <div className="flex items-center gap-3 border-b border-white/10 p-3">
              <div className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-primary font-semibold text-primary-foreground shadow-[0_0_0_2px_rgba(107,62,255,0.16)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="size-full select-none object-cover"
                    loading="eager"
                    decoding="sync"
                    draggable={false}
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-gray-300/90">{owner.email}</p>
              </div>
            </div>

            <div className="flex flex-col py-1">
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/50"
                onClick={() => {
                  setProfileOpen(true);
                  setOpen(false);
                }}
              >
                <User size={16} />
                <span>Ver perfil</span>
              </button>

              <button
                role="menuitem"
                type="button"
                disabled
                aria-disabled="true"
                className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-white/40 transition hover:bg-white/[0.04] focus-visible:outline-none"
              >
                <Gem size={16} className="text-[#c4a5ff]/70" />
                <span>Dashboard</span>
                <span className="ml-auto rounded-full border border-[#6B3EFF]/25 bg-[#6B3EFF]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c4a5ff]/70">
                  Premium
                </span>
              </button>

              <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3EFF]/50">
                <Settings size={16} />
                <span>Configurações</span>
              </button>
            </div>

            <div className="border-t border-white/10 p-2">
              <button
                type="button"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 text-sm font-medium text-white/45 transition-all duration-200 hover:border-red-500/55 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        professionals={professionals}
        initial={{ display_name: displayName, avatar_url: avatarUrl }}
        onSave={(payload) => {
          if (typeof payload.display_name === 'string' && payload.display_name.trim()) {
            setDisplayName(payload.display_name.trim());
          }
          setAvatarUrl(payload.avatar_data_url ?? DEFAULT_PROFILE_AVATAR_URL);
          setProfileOpen(false);
        }}
      />
    </div>
  );
}
