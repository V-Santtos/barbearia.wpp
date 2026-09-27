/**
 * A pele de todo campo de preenchimento do app (2026-09-26, com o dono).
 *
 * Nasceu no login e passou a valer também no modal de agendamento: campo
 * AFUNDADO -- sombra interna leve, fio cinza de 1px, cantos
 * `rounded-2xl` e cor só no foco, que é o único momento em que o contorno
 * carrega informação ("é aqui que você está digitando"). Afundado diz "aqui se
 * digita" melhor que o retângulo claro que o modal usava.
 *
 * Só a pele: padding, tamanho de letra e espaço para ícone ficam em quem usa,
 * porque o login tem ícone e o modal tem rótulo em cima.
 *
 * A COR DE FUNDO também fica em quem usa (2026-09-26, a pedido do dono): o
 * login mantém o cinza translúcido original (`FUNDO_CAMPO_LOGIN`), que sobre o
 * fundo quase preto da entrada lê como campo; sobre o `#191919` do modal esse
 * mesmo cinza fica da cor do card e o campo some, então lá o fundo é afundado
 * (`FUNDO_CAMPO_MODAL`).
 */
export const CAMPO =
  'w-full rounded-2xl border border-[rgba(100,100,100,0.4)] text-white placeholder:text-white/40 ' +
  'shadow-[inset_0_1px_4px_rgba(255,255,255,0.05),inset_0_-1px_4px_rgba(0,0,0,0.6)] ' +
  'transition-all duration-200 focus:outline-none focus:border-accent';

export const FUNDO_CAMPO_LOGIN = 'bg-[rgba(25,25,25,0.6)]';
export const FUNDO_CAMPO_MODAL = 'bg-black/25';
