/**
 * "Bom dia / Boa tarde / Boa noite" — a primeira linha que o cliente le.
 *
 * Mora fora do roteador porque o roteador e uma funcao pura: ele recebe a saudacao
 * pronta no contexto em vez de olhar o relogio. E isso que deixa o teste do fluxo
 * fixar "boa noite" sem congelar o tempo do processo inteiro.
 *
 * O fuso e de Sao Paulo, nao o do servidor. Na Vercel o processo roda em UTC: sem
 * converter, o cliente das 22h receberia "bom dia" (ja e 1h em UTC) e o das 4h
 * receberia "boa noite" com o sol nascendo. E o mesmo motivo do corte da meia-noite
 * na escada de feedback, e o mesmo fuso.
 */

const FUSO = 'America/Sao_Paulo';

export const SAUDACOES = ['Bom dia', 'Boa tarde', 'Boa noite'] as const;

export type Saudacao = (typeof SAUDACOES)[number];

/**
 * Faixas: 05:00–11:59 bom dia, 12:00–17:59 boa tarde, 18:00–04:59 boa noite.
 *
 * A madrugada e "boa noite" de proposito: quem manda mensagem as 3h esta na noite
 * dele, nao na manha seguinte.
 */
export function saudacaoDe(momento: Date): Saudacao {
  const hora = horaEmSaoPaulo(momento);

  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * A hora do relogio de Sao Paulo, inteira.
 *
 * `formatToParts` em vez de `format` porque o texto formatado varia por locale
 * (`23`, `23 h`, `11 PM`) e so a parte `hour` e estavel. `hourCycle: 'h23'` evita o
 * outro tropeco: sem ele, meia-noite sai como `24` em varios locales.
 */
function horaEmSaoPaulo(momento: Date): number {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(momento);

  return Number(partes.find((parte) => parte.type === 'hour')?.value ?? '0');
}
