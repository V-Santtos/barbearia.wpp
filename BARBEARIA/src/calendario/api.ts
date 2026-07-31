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

/** O que o bot precisa saber depois de tentar marcar. */
export type Marcacao =
  | { tipo: 'marcado' }
  /** Alguem pegou o horario no meio do caminho, ou o cliente tocou duas vezes. */
  | { tipo: 'ocupado' }
  | { tipo: 'falhou' };

/**
 * Marca o agendamento — a mesma rota que o painel do dono usa, entao o horario
 * aparece na agenda dele sem nenhum caminho paralelo.
 *
 * **`profissional` e texto sem FK**, e a trava de double-booking do banco depende do
 * nome bater exatamente. Por isso o nome vem da tabela `profissionais`, lida pelo
 * proprio bot, e nunca de algo digitado.
 *
 * O `409` e um estado de primeira classe e nao um erro qualquer: e o unico caso em
 * que a resposta certa ao cliente fala de agenda ("esse horario acabou de ser
 * pego") em vez de falar do sistema.
 */
export async function marcar(
  base: string,
  dados: {
    barbeiro: string;
    cliente: string;
    telefone: string;
    data: string;
    hora: string;
  },
): Promise<Marcacao> {
  const consulta = await pedir(
    {
      url: `${base}/agendamentos`,
      metodo: 'POST',
      corpo: {
        telefone: dados.telefone,
        cliente: dados.cliente,
        profissional: dados.barbeiro,
        dia_marcado: dados.data,
        hora_marcada: dados.hora,
        // O painel usa `app-etapas`. Marcar de onde veio separa, na agenda do dono,
        // o que o bot fechou do que ele mesmo lancou a mao.
        source: 'bot-whatsapp',
      },
    },
    (corpo) => corpo ?? {},
  );

  if (consulta.ok) return { tipo: 'marcado' };

  return consulta.status === 409 ? { tipo: 'ocupado' } : { tipo: 'falhou' };
}
