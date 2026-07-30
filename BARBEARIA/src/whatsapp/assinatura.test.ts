import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verificarAssinatura } from './assinatura.js';

const SEGREDO = 'segredo-do-app-de-teste';

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex')}`;
}

describe('verificarAssinatura', () => {
  const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  it('aceita uma assinatura gerada com o app secret correto', () => {
    expect(verificarAssinatura(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });

  it('aceita corpo com acentuacao (o payload da Meta vem em UTF-8)', () => {
    // Se o HMAC for calculado sobre latin1 em vez de utf8, isto quebra. E o
    // nosso dominio e todo em portugues: "Joao", "Barbearia do Ze", "cabelo e barba".
    const comAcento = JSON.stringify({ nome: 'João', servico: 'cabelo e barba — R$ 45' });
    expect(verificarAssinatura(comAcento, assinar(comAcento), SEGREDO)).toBe(true);
  });

  it('rejeita quando o corpo foi alterado em um unico byte', () => {
    const assinatura = assinar(corpo);
    const adulterado = corpo.replace('whatsapp_business_account', 'whatsapp_business_accounX');
    expect(verificarAssinatura(adulterado, assinatura, SEGREDO)).toBe(false);
  });

  it('rejeita assinatura gerada com outro app secret', () => {
    expect(verificarAssinatura(corpo, assinar(corpo, 'segredo-errado'), SEGREDO)).toBe(false);
  });

  it('rejeita quando o cabecalho esta ausente', () => {
    expect(verificarAssinatura(corpo, undefined, SEGREDO)).toBe(false);
  });

  it('rejeita quando falta o prefixo sha256=', () => {
    const semPrefixo = assinar(corpo).slice('sha256='.length);
    expect(verificarAssinatura(corpo, semPrefixo, SEGREDO)).toBe(false);
  });

  it('rejeita cabecalho com hex invalido em vez de estourar excecao', () => {
    // Buffer.from(..., 'hex') trunca silenciosamente em entrada invalida,
    // entao o guard de comprimento e o que segura este caso.
    expect(verificarAssinatura(corpo, 'sha256=nao-e-hexadecimal', SEGREDO)).toBe(false);
  });

  it('rejeita cabecalho vazio', () => {
    expect(verificarAssinatura(corpo, '', SEGREDO)).toBe(false);
    expect(verificarAssinatura(corpo, 'sha256=', SEGREDO)).toBe(false);
  });

  it('rejeita assinatura truncada de tamanho diferente', () => {
    const truncada = assinar(corpo).slice(0, 20);
    expect(verificarAssinatura(corpo, truncada, SEGREDO)).toBe(false);
  });

  it('nao aceita corpo vazio assinado para um corpo real', () => {
    expect(verificarAssinatura(corpo, assinar(''), SEGREDO)).toBe(false);
  });
});
