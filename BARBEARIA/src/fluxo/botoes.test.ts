import { describe, expect, it } from 'vitest';
import { lerId, montarId, VERSAO_ID } from './botoes.js';

describe('montarId', () => {
  it('monta id sem parametro', () => {
    expect(montarId('agendar')).toBe('1.agendar');
  });

  it('monta id com parametros em querystring', () => {
    expect(montarId('hora', { b: '1', d: '2026-08-04', h: '13:00' })).toBe(
      '1.hora?b=1&d=2026-08-04&h=13%3A00',
    );
  });

  it('estoura quando passa do limite da Meta em vez de deixar a mensagem ser recusada', () => {
    expect(() => montarId('hora', { x: 'a'.repeat(300) })).toThrow(/acima do limite/);
  });
});

describe('lerId', () => {
  it('faz a ida e volta preservando os parametros', () => {
    const id = montarId('hora', { b: '1', d: '2026-08-04', h: '13:00' });
    const lido = lerId(id);

    expect(lido?.acao).toBe('hora');
    expect(lido?.versao).toBe(VERSAO_ID);
    expect(lido?.params.get('b')).toBe('1');
    expect(lido?.params.get('d')).toBe('2026-08-04');
    // O `:` volta decodificado — e por isso que se usa URLSearchParams e nao
    // um formato inventado.
    expect(lido?.params.get('h')).toBe('13:00');
  });

  it('reconhece versao diferente da atual sem tratar como lixo', () => {
    expect(lerId('2.agendar')?.versao).toBe('2');
  });

  it('devolve undefined para os ids do fluxo n8n antigo, que nao sao herdados', () => {
    expect(lerId('MENU_AGENDAR')).toBeUndefined();
    expect(lerId('BARBEIRO_LUCAS_COSTA')).toBeUndefined();
    expect(lerId('CONFIRMAR_NOME_Victor|ts=1753900000')).toBeUndefined();
  });

  it('devolve undefined para lixo e string vazia', () => {
    expect(lerId('')).toBeUndefined();
    expect(lerId('1.')).toBeUndefined();
    expect(lerId('agendar')).toBeUndefined();
    expect(lerId('1.Agendar')).toBeUndefined();
  });

  it('ignora espaco em volta', () => {
    expect(lerId('  1.agendar  ')?.acao).toBe('agendar');
  });
});
