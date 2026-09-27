/**
 * As cores que um barbeiro pode escolher (2026-09-26, com o dono).
 *
 * A paleta anterior era neon — cada cor no máximo da saturação e cada uma com
 * um brilho diferente (o verde-limão e o ciano gritavam mais que o azul). Esta
 * mantém oito tons bem distintos, mas todos com a MESMA luminosidade e a mesma
 * saturação, um degrau acima do "suave": nenhuma cor vence a outra e todas
 * conversam com o fundo escuro. No app a cor do barbeiro só aparece em peça
 * pequena (fio do card, pontinho, check), e é ali que a saturação ajuda.
 *
 * Nenhum roxo perto do `--color-accent` (#5650f9): o roxo é a cor das ações, e
 * um barbeiro roxo leria como algo selecionado. O Ardósia existe para quem quer
 * uma cor discreta.
 *
 * Um lugar só: o Sidebar (desktop) e o HamburgerPanel (celular) liam, cada um,
 * a sua cópia do array.
 */
export const CORES_PROFISSIONAIS = [
  '#EB6A5C', // coral
  '#E8973A', // âmbar
  '#D8BE45', // areia
  '#5EC46C', // verde
  '#2FC1AC', // verde-água
  '#4DA0EA', // céu
  '#E574B0', // rosa
  '#9AA3B5', // ardósia
];
