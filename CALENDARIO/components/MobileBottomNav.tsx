import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, BarChart2, MessageCircleMore } from 'lucide-react';
import './dashboard/css/index.css';

export type MobileTab = 'calendar' | 'dashboard' | 'conversations';

interface Props {
  tab: MobileTab;
  onChange: (tab: MobileTab) => void;
  conversationCount?: number;
}

const tabs = [
  { id: 'calendar' as MobileTab, label: 'Agenda', icon: CalendarDays },
  { id: 'conversations' as MobileTab, label: 'Conversas', icon: MessageCircleMore },
  { id: 'dashboard' as MobileTab, label: 'Dashboard', icon: BarChart2 },
];

/**
 * Dock flutuante: pílula solta do rodapé, vidro fosco, o conteúdo passando por
 * baixo. Substituiu a barra chapada de ponta a ponta em 2026-08-04.
 *
 * Duas coisas da referência ficaram de fora, de propósito:
 *
 * - O rótulo por tooltip, que depende de hover e não existe em tela de toque.
 *   Quem diz onde você está é o brilho (branco puro no ativo, apagado no
 *   resto), o traço mais grosso do ícone e a pílula de vidro que desliza
 *   atrás da aba ativa (`layoutId`, sem lib nova — o framer-motion já era
 *   dependência). Referência: a barra do WhatsApp tem esse mesmo indicador,
 *   cinza/vidro, nunca colorido — o roxo que existia aqui foi tirado a
 *   pedido do dono em 2026-08-04. Se um dia o ícone pelado parecer mudo
 *   demais, o conserto barato é a aba ativa expandir e mostrar o rótulo
 *   dela — só ela.
 * - A flutuação em laço e o `rotateX` de perspectiva, que são graça de dock de
 *   vitrine. Isto aqui é a navegação do app: fica parada.
 *
 * O respiro de 104px no fim de cada tela rolável existe por causa daqui: o dock
 * flutua POR CIMA da rolagem, e sem chão o último painel morre embaixo dele.
 */

/* Como a pílula viaja entre as abas. Era `tween`/0.28s, que desliza mas chega
 * seca -- o movimento de uma peça rígida. Mola com pouco amortecimento passa
 * um fio do alvo e volta, que é como uma gota de vidro assenta.
 * `mass` alto de propósito: dá peso, senão vira elástico de brinquedo. */
const MOLA_VIAGEM = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;

/* O esticão líquido: a pílula chega alongada no eixo da viagem e achatada no
 * outro (volume constante, como líquido de verdade), e desincha na chegada.
 * Mais solta que a de viagem -- é ela que faz o efeito ler como "líquido" e
 * não como "retângulo que se moveu". */
const MOLA_ESTICAO = { type: 'spring', stiffness: 320, damping: 22, mass: 0.7 } as const;

export default function MobileBottomNav({ tab, onChange, conversationCount = 0 }: Props) {
  const semMovimento = useReducedMotion();

  return (
    <div className="dash-root md:hidden">
      <nav className="mb-dock" aria-label="Navegação">
        {tabs.map(({ id, label, icon: Icon }) => {
          const ativo = tab === id;
          return (
            <motion.button
              key={id}
              className={`mb-dock__item${ativo ? ' is-active' : ''}`}
              onClick={() => onChange(id)}
              aria-current={ativo ? 'page' : undefined}
              aria-label={label}
              /* O toque é ouvido no botão inteiro (a área de 50px, não só o
                 ícone), mas o crescer acontece no wrapper do ícone lá embaixo,
                 via propagação de variante. Se o `scale` fosse aplicado aqui,
                 ele escalaria também a pílula do `layoutId` -- e o framer mede
                 a posição dela no instante do clique, com o dedo ainda
                 apertando. Medida tirada de dentro de um pai deformado sai
                 errada, e a pílula chega torta na aba nova. */
              whileTap={semMovimento ? undefined : 'pressionado'}
            >
              {ativo && (
                <motion.div
                  layoutId="mb-dock-highlight"
                  className="mb-dock__highlight"
                  transition={semMovimento ? { duration: 0 } : MOLA_VIAGEM}
                >
                  <motion.span
                    className="mb-dock__highlight-skin"
                    initial={semMovimento ? false : { scaleX: 1.32, scaleY: 0.84 }}
                    animate={{ scaleX: 1, scaleY: 1 }}
                    transition={semMovimento ? { duration: 0 } : MOLA_ESTICAO}
                  />
                </motion.div>
              )}
              {/* Sem este wrapper com z-index proprio, o icone (nao-posicionado)
                  pintaria ATRAS da pilula: em CSS, elemento posicionado com
                  z-index:auto sempre pinta por cima de conteudo inline
                  nao-posicionado, nao importa a ordem no DOM. */}
              <motion.span
                className="mb-dock__item-content"
                /* Incha, não encolhe. Encolher no toque é o idioma do
                   Material/Android; vidro responde ao dedo crescendo e
                   acendendo (o acender é o `::after` no CSS). O retorno é
                   mola, não curva -- é a parte que se sente. */
                variants={{ pressionado: { scale: 1.18 } }}
                transition={{ type: 'spring', stiffness: 700, damping: 18, mass: 0.4 }}
              >
                <Icon size={24} strokeWidth={ativo ? 2.3 : 1.8} />
              </motion.span>
              {/* Fora do wrapper, de propósito: o wrapper encolhe pro tamanho
                  do ícone (24px), e o badge precisa do quadrado 50px inteiro
                  de `.mb-dock__item` como referência pra `top`/`right`
                  baterem no canto certo. */}
              {id === 'conversations' && conversationCount > 0 && (
                <span className="mb-dock__badge">{conversationCount}</span>
              )}
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}
