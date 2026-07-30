/**
 * O que o roteador devolve. Sao INTENCOES, nao efeitos: `rotear()` monta esta
 * lista e nao manda nada. Quem executa e outro pedaco.
 *
 * E isso que torna o fluxo testavel de verdade — o teste compara a lista de
 * acoes esperada, sem subir servidor, sem simular a API da Meta, em
 * milissegundos.
 */

/**
 * Todo nome de resposta que o bot sabe dar. Nao e enfeite: e o que faz o
 * compilador cobrar o feedback correspondente em `rotear.ts`. Estado novo sem a
 * frase de "voce precisa tocar no botao tal" **nao compila** — que e a unica
 * forma de garantir que a escada de feedback nunca vire silencio por esquecimento.
 */
export const NOMES_RESPOSTA = [
  'menu_principal',
  'agendar_inicio',
  'rota_em_construcao',
  'feedback',
  'menu_reforcado',
] as const;

export type NomeResposta = (typeof NOMES_RESPOSTA)[number];

export type Botao = {
  id: string;
  /** Teto da Meta: 20 caracteres. */
  titulo: string;
};

type Base = {
  /** `wa_id` do destinatario. */
  para: string;
  /**
   * Qual resposta e esta. Vai pro banco e sustenta duas regras: a trava
   * anti-repeticao e a escada de feedback, que precisa saber a ultima coisa que o
   * bot falou pra mirar a dica certa.
   */
  resposta: NomeResposta;
  texto: string;
};

export type Acao =
  | (Base & { tipo: 'enviar_texto' })
  | (Base & { tipo: 'enviar_botoes'; botoes: Botao[] });

/**
 * O que o roteador precisa saber alem do evento. Entra como parametro justamente
 * pra funcao continuar pura: quem consulta o banco e o chamador.
 *
 * Tudo aqui e escopado ao **dia corrente em Sao Paulo** e ao que aconteceu
 * **depois do ultimo toque em botao** — e por isso que o reset diario e o reset
 * por interacao saem de graca, sem job de limpeza e sem campo de controle.
 */
export type ContextoFluxo = {
  /** `true` quando esta foi a primeira mensagem que esse numero mandou. */
  clienteNovo: boolean;
  /** A ultima resposta que o bot deu hoje, depois do ultimo botao tocado. */
  ultimaResposta: NomeResposta | undefined;
  /**
   * Degrau da escada de feedback nesta sequencia de mensagens de texto:
   * 0 = ainda nao avisei, 1 = ja avisei uma vez, 2 = ja reforcei o menu (travado).
   */
  degrau: 0 | 1 | 2;
};
