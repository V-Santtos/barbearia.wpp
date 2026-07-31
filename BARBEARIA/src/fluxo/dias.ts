/**
 * Como um dia aparece pro cliente: `Hoje`, `Amanha`, ou `Qua 06/08`.
 *
 * Mora fora do roteador pelo mesmo motivo da saudacao: o roteador e puro. O "hoje"
 * chega pronto no contexto em vez de sair de `new Date()` aqui dentro — e o que
 * deixa o teste fixar uma data sem congelar o relogio do processo.
 *
 * O n8n tinha uma terceira faixa ("nome do dia da semana se for a mesma semana,
 * comecando na segunda"). Fica de fora: com a janela em no maximo 10 dias, `Qui` e
 * `Qui 06/08` podem cair na mesma lista, e o cliente teria que descobrir sozinho que
 * o primeiro e desta semana. Data explicita nao tem ambiguidade.
 */

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const;

/**
 * `data` e `hoje` sao `YYYY-MM-DD` no fuso de Sao Paulo — os dois vem de quem ja
 * resolveu fuso: a data, da API do calendario; o hoje, de `hojeEmSaoPaulo()`.
 *
 * A conta usa `Date.UTC` a partir dos numeros da string, nunca `new Date(texto)`.
 * `new Date('2026-08-04')` e interpretado como meia-noite UTC e, lido no fuso local
 * de uma maquina a oeste, volta como dia 3 — o escorregao de um dia que o fluxo
 * antigo contornava ancorando tudo em `T12:00:00-03:00`. Aqui nao ha fuso envolvido:
 * sao tres numeros virando um dia do calendario.
 */
export function rotularDia(data: string, hoje: string): string {
  const dia = emDias(data);
  const referencia = emDias(hoje);

  if (dia === undefined || referencia === undefined) return data;

  if (dia === referencia) return 'Hoje';
  if (dia === referencia + 1) return 'Amanhã';

  const [, mes, diaDoMes] = partes(data) ?? [];
  if (mes === undefined || diaDoMes === undefined) return data;

  const nome = DIAS_DA_SEMANA[new Date(dia * UM_DIA).getUTCDay()];

  return `${nome} ${String(diaDoMes).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

const UM_DIA = 86_400_000;

/** Dias inteiros desde a epoca, tratando a data como dia de calendario puro. */
function emDias(data: string): number | undefined {
  const numeros = partes(data);
  if (!numeros) return undefined;

  const [ano, mes, dia] = numeros;
  return Date.UTC(ano, mes - 1, dia) / UM_DIA;
}

function partes(data: string): [number, number, number] | undefined {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!encontrado) return undefined;

  const [, ano, mes, dia] = encontrado;
  return [Number(ano), Number(mes), Number(dia)];
}

/**
 * O dia de hoje no relogio de Sao Paulo, em `YYYY-MM-DD`.
 *
 * `en-CA` porque e o locale cujo formato numerico curto ja e ISO — evita montar a
 * string a mao a partir de `formatToParts`. O fuso e o mesmo da saudacao e do corte
 * da meia-noite da escada de feedback, e pelo mesmo motivo: na Vercel o processo roda
 * em UTC, e o cliente das 22h estaria vendo o "hoje" de amanha.
 */
export function hojeEmSaoPaulo(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(momento);
}
