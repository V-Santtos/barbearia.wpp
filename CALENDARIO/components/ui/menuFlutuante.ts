/**
 * A superfície de todo menu suspenso do app (2026-09-26, com o dono).
 *
 * Havia cinco receitas para a mesma peça: o menu do avatar em cinza claro
 * translúcido com desfoque, o "…" do profissional e a lista de horários em
 * quase preto arroxeado, o "Criar" em cinza arroxeado, as opções de conversas
 * em vidro de 28px e o seletor de cor do celular em cinza translúcido. Lado a
 * lado, pareciam de apps diferentes.
 *
 * Agora é uma só: sólida, no mesmo `#1c1c1c` dos popovers (detalhe do
 * agendamento, agendamentos do dia), borda branca a 10%, cantos `rounded-xl`
 * (16px -- o `index.css` redefine a escala de raios) e a
 * mesma sombra. Sem desfoque: com o fundo sólido ele não aparece, e eram
 * justamente os translúcidos que destoavam. Modais (janelas centrais) seguem
 * outra receita, `#191919` com a tela escurecida atrás.
 *
 * Só a pele: posição, largura, padding e rolagem continuam em cada menu.
 */
export const SUPERFICIE_MENU =
  'rounded-xl border border-white/10 bg-[#1c1c1c] shadow-[0_16px_40px_rgba(0,0,0,0.48)]';
