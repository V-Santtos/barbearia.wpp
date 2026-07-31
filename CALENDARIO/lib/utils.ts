export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Faixa da agenda aberta, em dias. Mora aqui porque a mesma barra existe em duas
 * telas (`AgendaSettingsModal` e o painel de agenda do `Sidebar`) — com os numeros
 * escritos a mao nas duas, mudar a regra numa so deixaria a outra oferecendo um
 * valor que o servidor recusa, sem que ninguem percebesse ate um dono reclamar.
 *
 * O teto de 10 nao e estetico: e o limite de linhas de uma lista do WhatsApp. O bot
 * mostra ao cliente exatamente esta janela, entao acima de 10 haveria dia com vaga
 * que ninguem consegue ver. Espelha o CHECK da tabela `agenda_profissional` e o
 * `normalizeBookingWindowDays` do `server.js` — os tres mudam juntos.
 */
export const JANELA_MIN_DIAS = 4;
export const JANELA_MAX_DIAS = 10;
