import { describe, expect, it } from 'vitest';
import { resumirEvento, type EnvelopeWebhook } from './eventos.js';

describe('resumirEvento', () => {
  it('extrai campo, waba e wamid de uma mensagem recebida', () => {
    const envelope: EnvelopeWebhook = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '102290129340398',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                messages: [{ id: 'wamid.ABC123', from: '5533845949688', type: 'text' }],
              },
            },
          ],
        },
      ],
    };

    expect(resumirEvento(envelope)).toEqual([
      { campo: 'messages', wabaId: '102290129340398', wamids: ['wamid.ABC123'] },
    ]);
  });

  it('reconhece o campo de coexistencia smb_message_echoes', () => {
    const envelope: EnvelopeWebhook = {
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'smb_message_echoes',
              value: { message_echoes: [{ id: 'wamid.ECO1' }, { id: 'wamid.ECO2' }] },
            },
          ],
        },
      ],
    };

    const [resumo] = resumirEvento(envelope);
    expect(resumo?.campo).toBe('smb_message_echoes');
    // message_echoes ainda nao esta na lista de extracao: o eco vem no campo
    // `message_echoes` de dentro do value, e a gente pega ele.
    expect(resumo?.wamids).toEqual(['wamid.ECO1', 'wamid.ECO2']);
  });

  it('junta statuses e mensagens da mesma mudanca', () => {
    const envelope: EnvelopeWebhook = {
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [{ id: 'wamid.M1' }],
                statuses: [{ id: 'wamid.S1' }, { id: 'wamid.S2' }],
              },
            },
          ],
        },
      ],
    };

    expect(resumirEvento(envelope)[0]?.wamids).toEqual(['wamid.M1', 'wamid.S1', 'wamid.S2']);
  });

  it('lida com envelope vazio ou malformado sem estourar', () => {
    expect(resumirEvento({})).toEqual([]);
    expect(resumirEvento({ entry: [] })).toEqual([]);
    expect(resumirEvento({ entry: [{ id: 'x' }] })).toEqual([]);
    expect(resumirEvento({ entry: [{ id: 'x', changes: [{}] }] })).toEqual([
      { campo: 'desconhecido', wabaId: 'x', wamids: [] },
    ]);
  });

  it('ignora itens sem id em vez de inventar entrada', () => {
    const envelope: EnvelopeWebhook = {
      entry: [{ id: 'W', changes: [{ field: 'messages', value: { messages: [{}, { id: 'ok' }] } }] }],
    };
    expect(resumirEvento(envelope)[0]?.wamids).toEqual(['ok']);
  });
});
