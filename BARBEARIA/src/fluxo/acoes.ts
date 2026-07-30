/**
 * O que o roteador devolve. Sao INTENCOES, nao efeitos: `rotear()` monta esta
 * lista e nao manda nada. Quem executa e outro pedaco.
 *
 * E isso que torna o fluxo testavel de verdade — o teste compara a lista de
 * acoes esperada, sem subir servidor, sem simular a API da Meta, em
 * milissegundos.
 */

export type Botao = {
  id: string;
  /** Teto da Meta: 20 caracteres. */
  titulo: string;
};

type Base = {
  /** `wa_id` do destinatario. */
  para: string;
  /**
   * Nome curto da resposta (ex.: `menu_principal`). Vai pro banco e alimenta a
   * trava anti-repeticao: e por ele que o executor sabe que acabou de mandar
   * isso pra esse contato.
   */
  resposta: string;
  texto: string;
};

export type Acao =
  | (Base & { tipo: 'enviar_texto' })
  | (Base & { tipo: 'enviar_botoes'; botoes: Botao[] });
