import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import type { OwnerSession } from './LoginScreen';
import ProfileModal from './ProfileModal';
import MarcaHubBarber from './shell/MarcaHubBarber';
import type { Professional } from '../types';
import { SUPERFICIE_MENU } from './ui/menuFlutuante';

interface UserMenuProps {
  owner: OwnerSession;
  onLogout: () => void;
  professionals: Professional[];
  onOpenSiteSettings?: () => void;
  /** Na barra superior o avatar divide 56px com os outros botões: 36px, como eles. */
  compacto?: boolean;
}

const DEFAULT_PROFILE_AVATAR_URL =
  'https://sppexvjvnoganlduyjvs.supabase.co/storage/v1/object/public/FOTO/619886691_17855063583606334_3904812273743958652_n.jpg';

type Tema = 'escuro' | 'claro';

/**
 * O tema vive num atributo do `<html>` (`data-tema`) e no localStorage, não num
 * contexto: quem precisa saber a cor é o CSS, e ele já lê dali. Um provider só
 * para isso seria estado de aplicação para uma decisão que é de folha de estilo.
 */
function temaGuardado(): Tema {
  if (typeof window === 'undefined') return 'escuro';
  return window.localStorage.getItem('tema') === 'claro' ? 'claro' : 'escuro';
}

export default function UserMenu({ owner, onLogout, professionals, onOpenSiteSettings, compacto = false }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState<string>(owner.name);
  const [avatarUrl, setAvatarUrl] = React.useState<string>(DEFAULT_PROFILE_AVATAR_URL);
  const [tema, setTema] = React.useState<Tema>(temaGuardado);

  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setDisplayName(owner.name);
  }, [owner.name]);

  React.useEffect(() => {
    document.documentElement.dataset.tema = tema;
    window.localStorage.setItem('tema', tema);
  }, [tema]);

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

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Menu do usuário"
        /* `size-8` (32 px) na barra, e nao 36: a faixa tem 48 px de altura, e
           com 36 o avatar deixava so 6 px de folga de cada lado — encostado na
           divisoria de baixo. Com 32 a folga vira 8 px e ele para de brigar
           com a linha. */
        className={`flex ${compacto ? 'size-8' : 'size-11'} items-center justify-center overflow-hidden rounded-full border border-white/12 bg-primary font-semibold text-primary-foreground shadow-[0_0_0_2px_rgba(86,80,249,0.18)] transition hover:border-accent/55 hover:brightness-110`}
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
            onError={() => setAvatarUrl('')}
          />
        ) : (
            <MarcaHubBarber className="h-1/2 w-1/2" />
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
            className={`menu-dropdown absolute right-0 top-[52px] z-50 w-64 overflow-hidden text-sm ${SUPERFICIE_MENU}`}
          >
            <div className="flex items-center gap-3 border-b border-white/10 p-3">
              <div className="flex size-10 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-primary font-semibold text-primary-foreground shadow-[0_0_0_2px_rgba(86,80,249,0.16)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="size-full select-none object-cover"
                    loading="eager"
                    decoding="sync"
                    draggable={false}
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                    <MarcaHubBarber className="h-1/2 w-1/2" />
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
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                onClick={() => {
                  setProfileOpen(true);
                  setOpen(false);
                }}
              >
                <User size={16} />
                <span>Ver perfil</span>
              </button>

              {/* Um item, um ícone: ele mostra o destino, não o estado atual —
                  no escuro aparece o sol, que é para onde o clique leva. */}
              <button
                role="menuitem"
                type="button"
                onClick={() => setTema((atual) => (atual === 'escuro' ? 'claro' : 'escuro'))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}</span>
              </button>
              {onOpenSiteSettings && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenSiteSettings();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <Settings size={16} />
                  <span>Configurações do site</span>
                </button>
              )}
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
