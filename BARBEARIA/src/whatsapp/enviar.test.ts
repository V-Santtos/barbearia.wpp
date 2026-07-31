import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { Acao } from '../fluxo/acoes.js';
import { criarEmissor } from './enviar.js';

const env = {
  WHATSAPP_TOKEN: 'token-de-teste',
  WHATSAPP_PHONE_NUMBER_ID: '922642447599728',
} as Env;

const OPCAO = (n: number) => ({ id: `1.hora?h=0${n}:00`, titulo: `0${n}:00` });

const lista = (quantas: number, compacta: boolean): Acao => ({
  tipo: 'enviar_lista',
  para: '553384246770',
  resposta: 'escolher_horario',
  cabecalho: 'Agendamento 📅',
  texto: 'Qual horário fica melhor?',
  rodape: 'Selecione uma opção',
  abrir: 'Ver horários',
  secao: 'Horários livres',
  compacta,
  opcoes: Array.from({ length: quantas }, (_, i) => OPCAO(i + 1)),
});

/** Captura o corpo que o emissor manda pra Graph API, sem sair da maquina. */
async function corpoDe(acao: Acao) {
  let enviado: Record<string, any> = {};

  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    enviado = JSON.parse(String(init.body));
    return new Response('{}', { status: 200 });
  });

  await criarEmissor(env)(acao);
  return enviado;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formato da mensagem de opcoes', () => {
  it('ate 3 opcoes marcadas como compactas viram botoes de resposta rapida', async () => {
    const corpo = await corpoDe(lista(3, true));

    expect(corpo.interactive.type).toBe('button');
    expect(corpo.interactive.action.buttons).toHaveLength(3);
    expect(corpo.interactive.action.buttons[0]).toEqual({
      type: 'reply',
      reply: { id: '1.hora?h=01:00', titulo: undefined, title: '01:00' },
    });
  });

  it('o formato botao MANTEM header e rodape', async () => {
    // O fluxo n8n assumia que `button` nao aceita os dois, e essa premissa errada foi
    // o que justificou padronizar tudo em lista. A Meta aceita.
    const corpo = await corpoDe(lista(2, true));

    expect(corpo.interactive.header).toEqual({ type: 'text', text: 'Agendamento 📅' });
    expect(corpo.interactive.footer).toEqual({ text: 'Selecione uma opção' });
    expect(corpo.interactive.body).toEqual({ text: 'Qual horário fica melhor?' });
  });

  it('acima de 3, volta a ser lista — botao nao aceita a quarta', async () => {
    const corpo = await corpoDe(lista(4, true));

    expect(corpo.interactive.type).toBe('list');
    expect(corpo.interactive.action.button).toBe('Ver horários');
    expect(corpo.interactive.action.sections[0].rows).toHaveLength(4);
  });

  it('sem `compacta`, 3 opcoes continuam lista — o menu principal depende disso', async () => {
    const corpo = await corpoDe(lista(3, false));

    expect(corpo.interactive.type).toBe('list');
  });

  it('header ausente nao vira chave vazia — a Meta rejeita a chave presente sem valor', async () => {
    const corpo = await corpoDe({ ...lista(2, true), cabecalho: undefined } as Acao);

    expect('header' in corpo.interactive).toBe(false);
  });

  it('texto puro continua saindo como text, sem preview de link', async () => {
    const corpo = await corpoDe({
      tipo: 'enviar_texto',
      para: '553384246770',
      resposta: 'dia_escolhido',
      texto: 'Show, *Ter 04/08*.',
    });

    expect(corpo.type).toBe('text');
    expect(corpo.text).toEqual({ preview_url: false, body: 'Show, *Ter 04/08*.' });
  });
});
