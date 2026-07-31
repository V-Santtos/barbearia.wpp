import { describe, expect, it } from 'vitest';
import { hojeEmSaoPaulo, rotularDia } from './dias.js';

describe('rotularDia', () => {
  const hoje = '2026-07-30'; // uma quinta-feira

  it('chama hoje de Hoje e amanha de Amanha', () => {
    expect(rotularDia('2026-07-30', hoje)).toBe('Hoje');
    expect(rotularDia('2026-07-31', hoje)).toBe('Amanhã');
  });

  it('do terceiro dia em diante, dia da semana + data', () => {
    expect(rotularDia('2026-08-01', hoje)).toBe('Sab 01/08');
    expect(rotularDia('2026-08-03', hoje)).toBe('Seg 03/08');
    expect(rotularDia('2026-08-08', hoje)).toBe('Sab 08/08');
  });

  it('cabe no teto de 20 caracteres do titulo de botao', () => {
    for (const dia of ['2026-07-30', '2026-07-31', '2026-12-25', '2026-11-11']) {
      expect(rotularDia(dia, hoje).length).toBeLessThanOrEqual(20);
    }
  });

  it('atravessa a virada do mes e do ano sem escorregar de dia', () => {
    expect(rotularDia('2026-07-31', '2026-07-31')).toBe('Hoje');
    expect(rotularDia('2026-08-01', '2026-07-31')).toBe('Amanhã');
    expect(rotularDia('2027-01-01', '2026-12-31')).toBe('Amanhã');
    expect(rotularDia('2026-03-02', '2026-03-01')).toBe('Amanhã');
  });

  it('nao escorrega de dia por fuso — a data e dia de calendario, nao instante', () => {
    // `new Date('2026-08-04')` e meia-noite UTC; lido numa maquina a oeste, volta
    // como dia 3. Era o motivo do truque `T12:00:00-03:00` do fluxo antigo.
    expect(rotularDia('2026-08-04', '2026-08-04')).toBe('Hoje');
    expect(rotularDia('2026-08-04', '2026-08-03')).toBe('Amanhã');
  });

  it('data em formato inesperado volta como veio, sem quebrar a lista', () => {
    expect(rotularDia('', hoje)).toBe('');
    expect(rotularDia('04/08/2026', hoje)).toBe('04/08/2026');
  });
});

describe('hojeEmSaoPaulo', () => {
  it('usa o relogio de Sao Paulo, nao o do processo', () => {
    // 02:00 UTC de dia 31 ainda e dia 30 em Sao Paulo (UTC-3). Um servidor em UTC
    // — a Vercel — chamaria isso de dia 31 e ofereceria "Hoje" pro dia errado.
    expect(hojeEmSaoPaulo(new Date('2026-07-31T02:00:00Z'))).toBe('2026-07-30');
    expect(hojeEmSaoPaulo(new Date('2026-07-31T03:00:00Z'))).toBe('2026-07-31');
  });

  it('devolve sempre YYYY-MM-DD, com zero a esquerda', () => {
    expect(hojeEmSaoPaulo(new Date('2026-03-05T15:00:00Z'))).toBe('2026-03-05');
  });
});
