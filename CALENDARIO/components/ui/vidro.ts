import type { CSSProperties } from 'react';

/* ===========================================================================
   Vidro líquido -- material compartilhado do app inteiro, não só de um botão.

   Nasceu no "Criar agendamento" da gaveta (clone do Figma "Liquid Glass
   Button / Amber Glow", nó 1:13 -- números do arquivo, não estimativa) e
   passou a valer como o idioma padrão que substitui o roxo estrutural em
   qualquer superfície do app (dock, pílulas, chips do dia). Ver
   ANEXO-PLANO-LAPIDACAO, seção 0 e Frente 1: "extrair pra ui/vidro.ts antes
   de copiar de novo" -- copiar os valores pra um terceiro lugar era o começo
   da divergência.

   A anatomia completa (casca + pílula + dois brilhos + texto duplicado) tem
   QUATRO camadas -- tirar qualquer uma derruba a leitura de vidro. Peças
   pequenas e empilhadas (como os chips do dia) usam só a casca + rampa: os
   dois brilhos borrados, em 48px, viram uma faixa branca lisa em vez de
   espessura de vidro -- ver Frente 1, "cromática".
   ======================================================================== */

/* Parada em 125.82%, como no arquivo: o gradiente continua depois da borda de
   baixo, então o preto puro nunca chega a aparecer inteiro -- o que se vê é a
   descida até ~#0C0C0C. Cortar em 100% deixa a base chapada. */
export const RAMPA =
  '#5A5A5A 0%, #3E3E3E 15.098%, #2A2A2A 27.68%, #0C0C0C 75.492%, #000000 125.82%';
export const RAMPA_CASCA =
  'rgba(90,90,90,0.2) 0%, rgba(62,62,62,0.2) 15.098%, rgba(42,42,42,0.2) 27.68%, rgba(24,24,24,0.2) 75.492%, rgba(15,15,15,0.2) 125.82%';

export const CASCA_BORDER = '1px solid rgba(255,255,255,0.22)';
export const CASCA_BACKGROUND = `linear-gradient(180deg, ${RAMPA_CASCA})`;
export const PILULA_BACKGROUND = `linear-gradient(180deg, ${RAMPA})`;

/* Os dois brilhos são elipses brancas puras com desfoque gaussiano (no arquivo:
   rx 111.5 / ry 3.5 / sigma 6.5 em cima, rx 126.5 / ry 2.5 / sigma 7.5 embaixo).
   Isso é geometria, não desenho -- então vira CSS exato em vez de dois SVGs
   exportados, que além de pesarem mais expiram do servidor do Figma em 7 dias.
   Largura em % da casca, não em px, pra sobreviver a mudança na largura do
   painel: o de cima cobre ~53% (mais curto que a pílula, some antes de chegar
   nas quinas) e o de baixo ~60%. Só fazem sentido em peças grandes o
   suficiente (>=60px) pra ter onde respirar -- ver nota no topo do arquivo. */
const BRILHO_BASE: CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  borderRadius: '50%',
  background: '#fff',
  pointerEvents: 'none',
};
export const BRILHO_TOPO: CSSProperties = {
  ...BRILHO_BASE,
  top: 13,
  width: '53%',
  height: 3,
  filter: 'blur(4px)',
};
export const BRILHO_BASE_INFERIOR: CSSProperties = {
  ...BRILHO_BASE,
  bottom: 2,
  width: '60%',
  height: 2,
  filter: 'blur(4px)',
  opacity: 0.75,
};

/* Peça de menu/banner (68px) -- usada como está no "Criar agendamento" da
   gaveta. Peça menor e empilhada (chip do dia) não usa este objeto pronto:
   compõe CASCA_BACKGROUND/CASCA_BORDER com sua própria altura/raio. */
export const CASCA: CSSProperties = {
  height: 68,
  borderRadius: 24,
  border: CASCA_BORDER,
  backgroundImage: CASCA_BACKGROUND,
  /* Sombra deslocada pra direita e pra baixo (era 10/20/13 no arquivo): a luz
     vem de cima-esquerda, e é isso que dá volume de peça, não de adesivo.
     O brilho interno é o que faz a borda da casca acender. */
  boxShadow: '4px 8px 9px rgba(0,0,0,0.45), inset 0 0 7px rgba(255,255,255,0.38)',
};

export const PILULA: CSSProperties = {
  borderRadius: 15,
  border: CASCA_BORDER,
  backgroundImage: PILULA_BACKGROUND,
  /* A sombra interna de baixo escurece a barriga da pílula e empurra o olho
     pro brilho de cima. Sem ela o preto fica uniforme e morto. */
  boxShadow: '0 0 4px rgba(0,0,0,0.4), inset 0 -5px 2px rgba(0,0,0,0.35)',
};
