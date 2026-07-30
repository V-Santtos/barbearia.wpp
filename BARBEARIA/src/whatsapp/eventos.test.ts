import { describe, expect, it } from 'vitest';
import { traduzirEnvelope, type EnvelopeWebhook } from './eventos.js';

function envelope(valor: Record<string, unknown>, field = 'messages'): EnvelopeWebhook {
  return { object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field, value: valor }] }] };
}

const METADATA = { display_phone_number: '+55 33 8459-4968', phone_number_id: '922642447599728' };
const CONTATOS = [{ profile: { name: 'Victor' }, wa_id: '5533999999999' }];

describe('traduzirEnvelope — mensagem de texto', () => {
  it('extrai o que o resto do codigo precisa e nada mais', () => {
    const { eventos } = traduzirEnvelope(
      envelope({
        metadata: METADATA,
        contacts: CONTATOS,
        messages: [
          {
            id: 'wamid.ABC',
            from: '5533999999999',
            timestamp: '1785585600',
            type: 'text',
            text: { body: 'Oi' },
          },
        ],
      }),
    );

    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tipo: 'texto',
      texto: 'Oi',
      wamid: 'wamid.ABC',
      de: '5533999999999',
      numeroBarbearia: '922642447599728',
      nome: 'Victor',
    });
    // A Meta manda unix em SEGUNDOS, como string — 1785585600 e 01/08 ao meio-dia
    // UTC. Tratar como milissegundos jogaria a data pra 1970.
    expect(eventos[0]?.recebidoEm.toISOString()).toBe('2026-08-01T12:00:00.000Z');
  });

  it('deixa o nome indefinido quando a Meta nao manda contacts', () => {
    const { eventos } = traduzirEnvelope(
      envelope({ metadata: METADATA, messages: [{ id: 'w', from: '55', type: 'text', text: { body: 'oi' } }] }),
    );
    expect(eventos[0]?.nome).toBeUndefined();
  });
});

describe('traduzirEnvelope — toque em botao', () => {
  it('normaliza button_reply', () => {
    const { eventos } = traduzirEnvelope(
      envelope({
        metadata: METADATA,
        messages: [
          {
            id: 'wamid.B',
            from: '5533999999999',
            type: 'interactive',
            interactive: { type: 'button_reply', button_reply: { id: '1.agendar', title: 'Agendar' } },
          },
        ],
      }),
    );

    expect(eventos[0]).toMatchObject({ tipo: 'botao', botaoId: '1.agendar', titulo: 'Agendar' });
  });

  it('normaliza list_reply no mesmo campo — o resto do codigo nao precisa saber a diferenca', () => {
    const { eventos } = traduzirEnvelope(
      envelope({
        metadata: METADATA,
        messages: [
          {
            id: 'wamid.L',
            from: '5533999999999',
            type: 'interactive',
            interactive: { type: 'list_reply', list_reply: { id: '1.cancelar', title: 'Cancelar' } },
          },
        ],
      }),
    );

    expect(eventos[0]).toMatchObject({ tipo: 'botao', botaoId: '1.cancelar' });
  });
});

describe('traduzirEnvelope — o que nao vira evento', () => {
  it('recibo de entrega e ignorado, nao roteado', () => {
    const { eventos, ignorados } = traduzirEnvelope(
      envelope({
        metadata: METADATA,
        statuses: [
          { id: 'wamid.X', status: 'delivered', recipient_id: '55' },
          { id: 'wamid.X', status: 'read', recipient_id: '55' },
        ],
      }),
    );

    expect(eventos).toEqual([]);
    expect(ignorados).toEqual(['status:delivered', 'status:read']);
  });

  it('campos de coexistencia sao reconhecidos e nao roteados', () => {
    for (const campo of ['smb_message_echoes', 'history', 'smb_app_state_sync']) {
      const { eventos, ignorados } = traduzirEnvelope(envelope({ message_echoes: [{ id: 'e' }] }, campo));
      expect(eventos).toEqual([]);
      expect(ignorados).toEqual([`campo:${campo}`]);
    }
  });

  it('mensagem sem wamid, sem remetente ou sem numero da barbearia e descartada', () => {
    const semId = traduzirEnvelope(envelope({ metadata: METADATA, messages: [{ from: '55', type: 'text' }] }));
    const semDe = traduzirEnvelope(envelope({ metadata: METADATA, messages: [{ id: 'w', type: 'text' }] }));
    const semNumero = traduzirEnvelope(envelope({ messages: [{ id: 'w', from: '55', type: 'text' }] }));

    expect(semId.eventos).toEqual([]);
    expect(semDe.eventos).toEqual([]);
    expect(semNumero.eventos).toEqual([]);
    expect(semId.ignorados).toEqual(['mensagem:incompleta']);
  });
});

describe('traduzirEnvelope — formatos sem suporte', () => {
  it('audio, figurinha e localizacao viram um tipo unico com o formato preservado', () => {
    for (const formato of ['audio', 'sticker', 'location', 'document']) {
      const { eventos } = traduzirEnvelope(
        envelope({ metadata: METADATA, messages: [{ id: 'w', from: '55', type: formato }] }),
      );
      expect(eventos[0]).toMatchObject({ tipo: 'nao_suportado', formato });
    }
  });

  it('texto sem corpo cai em nao suportado em vez de virar mensagem vazia', () => {
    const { eventos } = traduzirEnvelope(
      envelope({ metadata: METADATA, messages: [{ id: 'w', from: '55', type: 'text', text: {} }] }),
    );
    expect(eventos[0]?.tipo).toBe('nao_suportado');
  });
});

describe('traduzirEnvelope — robustez', () => {
  it('processa TODAS as mensagens do envelope, nao so a primeira', () => {
    const { eventos } = traduzirEnvelope(
      envelope({
        metadata: METADATA,
        contacts: CONTATOS,
        messages: [
          { id: 'w1', from: '5533999999999', type: 'text', text: { body: 'Oi' } },
          { id: 'w2', from: '5533999999999', type: 'text', text: { body: 'bom dia' } },
          { id: 'w3', from: '5533999999999', type: 'text', text: { body: 'queria cortar' } },
        ],
      }),
    );

    expect(eventos.map((evento) => evento.wamid)).toEqual(['w1', 'w2', 'w3']);
  });

  it('nao estoura com envelope vazio ou malformado', () => {
    expect(traduzirEnvelope({}).eventos).toEqual([]);
    expect(traduzirEnvelope({ entry: [] }).eventos).toEqual([]);
    expect(traduzirEnvelope({ entry: [{ id: 'x' }] }).eventos).toEqual([]);
    expect(traduzirEnvelope({ entry: [{ id: 'x', changes: [{}] }] }).ignorados).toEqual([
      'campo:desconhecido',
    ]);
  });
});
