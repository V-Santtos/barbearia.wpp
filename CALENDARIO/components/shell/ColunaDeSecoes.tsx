/**
 * A coluna da esquerda: marca, ação primária e as seções do painel.
 *
 * Ela é UMA peça que recolhe e expande — não um rail fixo com um painel ao
 * lado. Recolhida é só ícone; aberta ganha o nome do app no topo e o rótulo de
 * cada seção. Na variante inset, a própria coluna é o plano externo: 8px de
 * respiro cercam os controles e separam a navegação da superfície de trabalho.
 *
 * O `+ Criar` mora aqui e não na gaveta porque agendamentos e lançamentos são
 * ações do produto inteiro, não acessórios de uma seção. Recolhida ela é o
 * "+"; aberta, o botão inteiro. Os dois estados abrem o mesmo menu.
 *
 * Só desktop. No celular quem faz este papel é o dock (`MobileBottomNav`), que
 * já está validado e não é tocado aqui.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Banknote, CalendarPlus, CirclePlus } from "lucide-react";
import { SECOES, type IdSecao } from "./secoes";
import MarcaHubBarber from "./MarcaHubBarber";

const LARGURA_ABERTA = 240;
/* 64px = rail de 48px + 8px de respiro em cada lado, exatamente a conta da
   variante inset da referência. O botão recolhido fica em 32px dentro dela. */
const LARGURA_RECOLHIDA = 64;
const LARGURA_MENU = 272;
const ALTURA_MENU = 108;
const RESPIRO_MENU = 8;

/* ponytail: nome fixo no código.
   Teto: com mais de uma barbearia no ar, este texto vira mentira.
   Gatilho de upgrade: a tabela de barbearias/plano, que ainda não existe. */
const NOME_DO_APP = "Barber";

interface Props {
  ativa: IdSecao;
  onSelecionar: (id: IdSecao) => void;
  expandida: boolean;
  onCriarAgendamento: () => void;
  onCriarLancamento: () => void;
}

interface PosicaoDoMenu {
  top: number;
  left: number;
  width: number;
  transformOrigin: string;
}

export default function ColunaDeSecoes({
  ativa,
  onSelecionar,
  expandida,
  onCriarAgendamento,
  onCriarLancamento,
}: Props) {
  const reduzir = useReducedMotion();
  const idMenu = useId();
  const botaoCriarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itensRef = useRef<(HTMLButtonElement | null)[]>([]);
  const focoInicialRef = useRef(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [posicaoMenu, setPosicaoMenu] = useState<PosicaoDoMenu>({
    top: 0,
    left: 0,
    width: LARGURA_MENU,
    transformOrigin: "top left",
  });
  const mola = reduzir
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 340, damping: 34 };

  /**
   * Aberta, a coluna ancora o menu logo abaixo do botão. Recolhida, ancora à
   * direita do ícone: o conteúdo não encobre a navegação e não depende da
   * largura animada da coluna. O portal evita o recorte pelo `overflow-hidden`.
   */
  const posicionarMenu = useCallback(() => {
    const botao = botaoCriarRef.current;
    if (!botao) return;

    const rect = botao.getBoundingClientRect();
    const margem = 8;
    const largura = Math.min(
      LARGURA_MENU,
      Math.max(0, window.innerWidth - margem * 2),
    );
    let top: number;
    let left: number;
    let transformOrigin: string;

    if (expandida) {
      const cabeAbaixo =
        rect.bottom + RESPIRO_MENU + ALTURA_MENU <=
        window.innerHeight - margem;
      top = cabeAbaixo
        ? rect.bottom + RESPIRO_MENU
        : Math.max(margem, rect.top - RESPIRO_MENU - ALTURA_MENU);
      left = Math.min(
        Math.max(margem, rect.left),
        window.innerWidth - largura - margem,
      );
      transformOrigin = cabeAbaixo ? "top left" : "bottom left";
    } else {
      const cabeADireita =
        rect.right + RESPIRO_MENU + largura <= window.innerWidth - margem;
      left = cabeADireita
        ? rect.right + RESPIRO_MENU
        : Math.max(margem, rect.left - RESPIRO_MENU - largura);
      top = Math.min(
        Math.max(margem, rect.top),
        window.innerHeight - ALTURA_MENU - margem,
      );
      transformOrigin = cabeADireita ? "top left" : "top right";
    }

    setPosicaoMenu({ top, left, width: largura, transformOrigin });
  }, [expandida]);

  const abrirMenu = (indiceInicial = 0) => {
    focoInicialRef.current = indiceInicial;
    posicionarMenu();
    setMenuAberto(true);
  };

  const fecharMenu = useCallback((devolverFoco = false) => {
    setMenuAberto(false);
    if (devolverFoco) {
      requestAnimationFrame(() => botaoCriarRef.current?.focus());
    }
  }, []);

  useLayoutEffect(() => {
    if (menuAberto) posicionarMenu();
  }, [menuAberto, posicionarMenu]);

  useEffect(() => {
    if (!menuAberto) return;

    const frame = requestAnimationFrame(() => {
      itensRef.current[focoInicialRef.current]?.focus();
    });
    const fecharAoClicarFora = (event: MouseEvent) => {
      const alvo = event.target as Node;
      if (
        menuRef.current?.contains(alvo) ||
        botaoCriarRef.current?.contains(alvo)
      ) {
        return;
      }
      fecharMenu();
    };
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") fecharMenu(true);
    };

    document.addEventListener("mousedown", fecharAoClicarFora);
    document.addEventListener("keydown", fecharComEscape);
    window.addEventListener("resize", posicionarMenu);
    window.addEventListener("scroll", posicionarMenu, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", fecharAoClicarFora);
      document.removeEventListener("keydown", fecharComEscape);
      window.removeEventListener("resize", posicionarMenu);
      window.removeEventListener("scroll", posicionarMenu, true);
    };
  }, [fecharMenu, menuAberto, posicionarMenu]);

  const navegarNoMenu = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const indiceAtual = itensRef.current.indexOf(
      document.activeElement as HTMLButtonElement,
    );

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direcao = event.key === "ArrowDown" ? 1 : -1;
      const proximo =
        (indiceAtual + direcao + itensRef.current.length) %
        itensRef.current.length;
      itensRef.current[proximo]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const destino = event.key === "Home" ? 0 : itensRef.current.length - 1;
      itensRef.current[destino]?.focus();
    } else if (event.key === "Tab") {
      fecharMenu();
    }
  };

  const executarAcao = (acao: () => void) => {
    setMenuAberto(false);
    acao();
  };

  return (
    <motion.nav
      aria-label="Seções"
      className="hidden md:flex flex-shrink-0 flex-col overflow-hidden
                 bg-[#141414] p-2"
      initial={false}
      animate={{ width: expandida ? LARGURA_ABERTA : LARGURA_RECOLHIDA }}
      transition={mola}
    >
      <div
        className={`mx-2 mt-2 mb-4 flex h-8 items-center gap-2 text-white/80 ${
          expandida ? "justify-start px-2" : "justify-center px-0"
        }`}
      >
        <MarcaHubBarber className="h-4 w-4 flex-shrink-0" />
        {expandida && (
          <motion.span
            initial={reduzir ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="truncate text-[15px] font-normal text-white"
            style={{ fontFamily: '"Aclonica", sans-serif' }}
          >
            {NOME_DO_APP}
          </motion.span>
        )}
      </div>

      <div className="mx-2 mb-4">
        <button
          ref={botaoCriarRef}
          type="button"
          onClick={() =>
            menuAberto ? fecharMenu() : abrirMenu(0)
          }
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              abrirMenu(event.key === "ArrowDown" ? 0 : 1);
            }
          }}
          title="Criar"
          aria-label={menuAberto ? "Fechar menu Criar" : "Abrir menu Criar"}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          aria-controls={menuAberto ? idMenu : undefined}
          /* A largura pertence ao contêiner, não ao estado da coluna. Mantendo
             `w-full` nos dois estados, o botão acompanha a mesma mola dos itens
             de seção; o recorte segura o rótulo enquanto ainda não há espaço. */
          className={`flex h-8 w-full items-center justify-center overflow-hidden
                      whitespace-nowrap rounded-md bg-white text-sm font-semibold
                      text-[#17151c] transition-colors hover:bg-white/90
                      focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-accent-400 ${
                        expandida ? "px-3" : "px-0"
                      }`}
        >
          {/* O "+" é roxo, não preto: era assim no botão original da Sidebar
              (SVG à mão com `stroke="#5650f9"`), e é o único respingo de marca
              nessa peça branca. */}
          <CirclePlus
            size={16}
            strokeWidth={2}
            className="flex-shrink-0 text-accent"
          />
          {expandida && <span className="ml-1.5">Criar</span>}
        </button>
      </div>

      {menuAberto &&
        typeof document !== "undefined" &&
        createPortal(
          <motion.div
            ref={menuRef}
            id={idMenu}
            role="menu"
            aria-label="Criar"
            onKeyDown={navegarNoMenu}
            initial={reduzir ? false : { opacity: 0, scale: 0.97, y: -3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduzir ? { duration: 0 } : { duration: 0.14 }}
            style={{
              position: "fixed",
              zIndex: 9999,
              ...posicaoMenu,
            }}
            className="flex flex-col gap-1 rounded-[10px] border border-white/[0.10]
                       bg-[#211f27] p-2 shadow-[0_18px_48px_rgba(0,0,0,0.52)]"
          >
            <button
              ref={(elemento) => {
                itensRef.current[0] = elemento;
              }}
              type="button"
              role="menuitem"
              onClick={() => executarAcao(onCriarAgendamento)}
              className="group flex h-11 w-full items-center gap-3 whitespace-nowrap
                         rounded-[8px] px-3 text-left text-sm font-medium text-white/75
                         transition-colors hover:bg-white/[0.07] hover:text-white
                         focus-visible:bg-white/[0.09]
                         focus-visible:text-white focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              <CalendarPlus
                size={16}
                strokeWidth={2}
                className="flex-shrink-0 text-white/50 transition-colors group-hover:text-white/80"
              />
              <span>Novo agendamento</span>
            </button>
            <button
              ref={(elemento) => {
                itensRef.current[1] = elemento;
              }}
              type="button"
              role="menuitem"
              onClick={() => executarAcao(onCriarLancamento)}
              className="group flex h-11 w-full items-center gap-3 whitespace-nowrap
                         rounded-[8px] px-3 text-left text-sm font-medium text-white/75
                         transition-colors hover:bg-white/[0.07] hover:text-white
                         focus-visible:bg-white/[0.09]
                         focus-visible:text-white focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              <Banknote
                size={16}
                strokeWidth={2}
                className="flex-shrink-0 text-white/50 transition-colors group-hover:text-white/80"
              />
              <span>Novo lançamento financeiro</span>
            </button>
          </motion.div>,
          document.body,
        )}

      <div className="flex flex-col gap-1 px-2">
        {SECOES.map(({ id, rotulo, Icone }) => {
          const eAtiva = id === ativa;
          return (
            <button
              key={id}
              onClick={() => onSelecionar(id)}
              title={rotulo}
              aria-current={eAtiva ? "page" : undefined}
              className={`group relative flex h-8 items-center gap-2 rounded-md
                          transition-colors hover:bg-white/[0.035]
                          focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-white/25 ${
                            expandida
                              ? "justify-start px-2"
                              : "justify-center px-0"
                          }`}
            >
              {/* A superfície ativa viaja entre os itens em vez de trocar de lugar —
                  mesma gramática do dock (`layoutId`), para o desktop não
                  inventar um segundo idioma de movimento. */}
              {eAtiva && (
                <motion.span
                  layoutId="coluna-secao-ativa"
                  className="absolute inset-0 rounded-md bg-white/[0.07]"
                  transition={mola}
                />
              )}
              {/* 16px e traço 2 são os números da sidebar de referência
                  (`[&_svg]:size-4` + o padrão do lucide). O peso ativo/inativo
                  agora vive só na cor: engrossar o traço era o que dava o ar
                  pesado que o minimalismo dali não tem. */}
              <Icone
                size={16}
                strokeWidth={2}
                className={`relative flex-shrink-0 transition-colors ${
                  eAtiva
                    ? "text-white"
                    : "text-white/55 group-hover:text-white/80"
                }`}
              />
              {expandida && (
                <span
                  className={`relative truncate text-sm ${
                    eAtiva
                      ? "font-medium text-white"
                      : "text-white/60 group-hover:text-white/80"
                  }`}
                >
                  {rotulo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
