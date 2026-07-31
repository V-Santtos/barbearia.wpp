import { pedir, type Resultado } from './http.js';

/**
 * O que o bot sabe perguntar a API do calendario (`CALENDARIO/server.js`, porta 3334).
 *
 * Por que HTTP e nao SQL direto: a regra de disponibilidade nao esta no banco. Sao
 * funcoes JavaScript la, com sutilezas que o bot nao tem como adivinhar — o slot tem
 * o tamanho da `duracao_min` DAQUELE profissional, o intervalo de descanso parte o
 * dia, dias bloqueados tem periodo, e ha antecedencia minima de 15 minutos. Reescrever
 * isso aqui criaria duas implementacoes da mesma regra, e o dia em que divergissem o
 * sintoma seria o pior tipo: painel mostrando um horario livre e bot oferecendo outro,
 * sem erro e sem log.
 *
 * Qualquer falha vira `{ ok: false }` — inclusive o 404 de profissional inativo. O
 * roteador ja tem defesa melhor pra esse caso: ele so aceita um `b` que bata com a
 * lista de ativos lida do banco, e ai devolve a pergunta do barbeiro em vez de uma
 * mensagem de erro.
 */

/** Um dia com pelo menos uma vaga, do jeito que `openDays` chega. */
export type DiaDisponivel = {
  /** `YYYY-MM-DD`, ja no fuso de Sao Paulo (o `server.js` fixa o TZ do processo). */
  data: string;
};

export type Consulta<T> = Resultado<T>;

/**
 * Os dias com vaga na janela do proprio barbeiro.
 *
 * **`days=` nao e enviado de proposito.** Sem o parametro, a rota usa
 * `agenda_profissional.janela_agendamento_dias` — o que o dono configurou na barra do
 * painel. Mandar um numero daqui recriaria o defeito do fluxo n8n, onde tres tetos
 * diferentes brigavam (15 pedido a API, 7 no codigo, 10 no payload) e o menor vencia
 * em silencio. Uma regua so, e ela e do dono.
 */
export async function buscarDias(
  base: string,
  profissionalId: number,
): Promise<Consulta<DiaDisponivel[]>> {
  const parametros = new URLSearchParams({ professionalId: String(profissionalId) });

  return pedir({ url: `${base}/agendamentos/dias-disponiveis?${parametros}` }, (corpo) => {
    const dias = (corpo as { openDays?: { date?: unknown }[] }).openDays;
    if (!Array.isArray(dias)) return undefined;

    return dias
      .map((dia) => dia?.date)
      .filter((data): data is string => typeof data === 'string')
      .map((data) => ({ data }));
  });
}

/** Os horarios livres de UM dia, em `HH:MM`. */
export async function buscarHorarios(
  base: string,
  profissionalId: number,
  data: string,
): Promise<Consulta<string[]>> {
  const parametros = new URLSearchParams({
    professionalId: String(profissionalId),
    date: data,
  });

  return pedir({ url: `${base}/agendamentos/horarios-disponiveis?${parametros}` }, (corpo) => {
    const horarios = (corpo as { availableSlots?: unknown }).availableSlots;
    if (!Array.isArray(horarios)) return undefined;

    return horarios.filter((hora): hora is string => typeof hora === 'string');
  });
}
