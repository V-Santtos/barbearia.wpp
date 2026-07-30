import { describe, expect, it } from 'vitest';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { montarId } from './botoes.js';
import { rotear } from './rotear.js';

const BASE = {
  wamid: 'wamid.TESTE',
  numeroBarbearia: '922642447599728',
  de: '5533999999999',
  nome: 'Victor',
  recebidoEm: new Date('2026-07-30T12:00:00Z'),
  cru: {},
};

const texto = (texto: string): EventoRecebido => ({ ...BASE, tipo: 'texto', texto });
const botao = (botaoId: string): EventoRecebido => ({
  ...BASE,
  tipo: 'botao',
  botaoId,
  titulo: undefined,
});
const naoSuportado = (formato: string): EventoRecebido => ({ ...BASE, tipo: 'nao_suportado', formato });

describe('rotear — menu principal', () => {
  it('responde qualquer texto com o menu de 3 botoes', () => {
    const [acao] = rotear(texto('Oi'));

    expect(acao?.tipo).toBe('enviar_botoes');
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.para).toBe(BASE.de);
    expect(acao?.tipo === 'enviar_botoes' && acao.botoes).toEqual([
      { id: '1.agendar', titulo: 'Agendar' },
      { id: '1.reagendar', titulo: 'Reagendar' },
      { id: '1.cancelar', titulo: 'Cancelar' },
    ]);
  });

  it('trata texto aleatorio igual a saudacao — nao existe entrada sem resposta', () => {
    expect(rotear(texto('asdfgh'))[0]?.resposta).toBe('menu_principal');
    expect(rotear(texto('quero cortar o cabelo amanha cedo'))[0]?.resposta).toBe('menu_principal');
  });

  it('cabe no limite de 3 botoes do tipo `button` da Meta', () => {
    const acao = rotear(texto('Oi'))[0];
    expect(acao?.tipo === 'enviar_botoes' && acao.botoes.length).toBeLessThanOrEqual(3);
  });

  it('respeita o teto de 20 caracteres no titulo do botao', () => {
    const acao = rotear(texto('Oi'))[0];
    if (acao?.tipo !== 'enviar_botoes') throw new Error('esperava botoes');
    for (const item of acao.botoes) expect(item.titulo.length).toBeLessThanOrEqual(20);
  });
});

describe('rotear — botoes', () => {
  it('`agendar` segue para o inicio do agendamento', () => {
    const [acao] = rotear(botao(montarId('agendar')));
    expect(acao?.resposta).toBe('agendar_inicio');
    expect(acao?.tipo).toBe('enviar_texto');
  });

  it('`reagendar` e `cancelar` respondem que ainda nao existem — nunca silencio', () => {
    for (const nome of ['reagendar', 'cancelar']) {
      const [acao] = rotear(botao(montarId(nome)));
      expect(acao?.resposta).toBe('rota_em_construcao');
      expect(acao?.texto).toContain('agendar');
    }
  });

  it('acao desconhecida no formato certo devolve o menu, nao silencio', () => {
    const [acao] = rotear(botao('1.pagar_com_pix'));
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('Não reconheci');
  });

  it('id de versao futura avisa que o botao e de conversa antiga', () => {
    const [acao] = rotear(botao('2.agendar'));
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('conversa antiga');
  });

  it('id do fluxo n8n antigo cai no menu em vez de quebrar', () => {
    for (const antigo of ['MENU_AGENDAR', 'BARBEIRO_LUCAS_COSTA', 'DIA_2026-08-04']) {
      expect(rotear(botao(antigo))[0]?.resposta).toBe('menu_principal');
    }
  });
});

describe('rotear — formatos que o bot nao entende', () => {
  it('audio, figurinha e localizacao recebem explicacao e o menu', () => {
    for (const formato of ['audio', 'sticker', 'location', 'image']) {
      const [acao] = rotear(naoSuportado(formato));
      expect(acao?.resposta).toBe('menu_principal');
      expect(acao?.texto).toContain('texto');
    }
  });
});

describe('rotear — garantias que valem pra toda entrada', () => {
  const todos: EventoRecebido[] = [
    texto('Oi'),
    texto(''),
    botao(montarId('agendar')),
    botao(montarId('reagendar')),
    botao(montarId('cancelar')),
    botao('1.inexistente'),
    botao('9.agendar'),
    botao('MENU_AGENDAR'),
    botao(''),
    naoSuportado('audio'),
  ];

  it('nenhuma entrada fica sem resposta', () => {
    for (const evento of todos) expect(rotear(evento).length).toBeGreaterThan(0);
  });

  it('toda acao tem destinatario, nome de resposta e texto', () => {
    for (const evento of todos) {
      for (const acao of rotear(evento)) {
        expect(acao.para).toBe(BASE.de);
        expect(acao.resposta).not.toBe('');
        expect(acao.texto.length).toBeGreaterThan(0);
      }
    }
  });

  it('e pura: chamar duas vezes com a mesma entrada da o mesmo resultado', () => {
    for (const evento of todos) expect(rotear(evento)).toEqual(rotear(evento));
  });
});
