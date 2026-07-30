import { describe, expect, it } from 'vitest';
import { saudacaoDe } from './saudacao.js';

/**
 * As datas sao escritas em UTC (`Z`) de proposito: e assim que o servidor enxerga o
 * mundo, e o que o teste prova e a conversao pro relogio de Sao Paulo (UTC-3).
 */
const emSaoPaulo = (horaUtc: string) => new Date(`2026-07-30T${horaUtc}:00Z`);

describe('saudacaoDe', () => {
  it('bom dia das 5h as 11h59', () => {
    expect(saudacaoDe(emSaoPaulo('08:00'))).toBe('Bom dia'); // 05:00 em SP
    expect(saudacaoDe(emSaoPaulo('12:00'))).toBe('Bom dia'); // 09:00
    expect(saudacaoDe(emSaoPaulo('14:59'))).toBe('Bom dia'); // 11:59
  });

  it('boa tarde das 12h as 17h59', () => {
    expect(saudacaoDe(emSaoPaulo('15:00'))).toBe('Boa tarde'); // 12:00
    expect(saudacaoDe(emSaoPaulo('20:59'))).toBe('Boa tarde'); // 17:59
  });

  it('boa noite das 18h as 4h59, incluindo a madrugada', () => {
    expect(saudacaoDe(emSaoPaulo('21:00'))).toBe('Boa noite'); // 18:00
    expect(saudacaoDe(emSaoPaulo('02:21'))).toBe('Boa noite'); // 23:21 do dia anterior
    expect(saudacaoDe(emSaoPaulo('03:00'))).toBe('Boa noite'); // 00:00 — nao pode virar 24
    expect(saudacaoDe(emSaoPaulo('07:59'))).toBe('Boa noite'); // 04:59
  });

  it('usa o fuso de Sao Paulo, nao o do servidor', () => {
    // 23:00 em Sao Paulo e 02:00 do dia seguinte em UTC. Se o codigo lesse a hora
    // UTC crua, este caso viraria "Boa noite" por acidente — entao o par abaixo e o
    // que separa de verdade: 01:00 UTC = 22:00 em SP (noite), 12:00 UTC = 09:00 (dia).
    expect(saudacaoDe(new Date('2026-07-31T01:00:00Z'))).toBe('Boa noite');
    expect(saudacaoDe(new Date('2026-07-31T12:00:00Z'))).toBe('Bom dia');
  });
});
