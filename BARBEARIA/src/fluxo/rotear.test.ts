import { describe, expect, it } from 'vitest';
import type { ContextoFluxo } from './acoes.js';
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

const NOVO: ContextoFluxo = { clienteNovo: true, ultimaResposta: undefined, degrau: 0 };
const CONHECIDO: ContextoFluxo = { clienteNovo: false, ultimaResposta: undefined, degrau: 0 };

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
    const [acao] = rotear(texto('Oi'), NOVO);

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
    expect(rotear(texto('asdfgh'), NOVO)[0]?.resposta).toBe('menu_principal');
    expect(rotear(texto('quero cortar o cabelo amanha cedo'), CONHECIDO)[0]?.resposta).toBe(
      'menu_principal',
    );
  });

  it('cabe no limite de 3 botoes do tipo `button` da Meta', () => {
    const acao = rotear(texto('Oi'), NOVO)[0];
    expect(acao?.tipo === 'enviar_botoes' && acao.botoes.length).toBeLessThanOrEqual(3);
  });

  it('respeita o teto de 20 caracteres no titulo do botao', () => {
    const acao = rotear(texto('Oi'), NOVO)[0];
    if (acao?.tipo !== 'enviar_botoes') throw new Error('esperava botoes');
    for (const item of acao.botoes) expect(item.titulo.length).toBeLessThanOrEqual(20);
  });
});

describe('rotear — cliente novo x conhecido', () => {
  it('muda a saudacao conforme o cliente ja tenha falado antes', () => {
    const paraNovo = rotear(texto('Oi'), NOVO)[0]?.texto ?? '';
    const paraConhecido = rotear(texto('Oi'), CONHECIDO)[0]?.texto ?? '';

    expect(paraNovo).not.toBe(paraConhecido);
    expect(paraNovo).toContain('Sou o atendimento');
    expect(paraConhecido).toContain('de novo');
  });

  it('muda so a frase: os botoes sao exatamente os mesmos', () => {
    const novo = rotear(texto('Oi'), NOVO)[0];
    const conhecido = rotear(texto('Oi'), CONHECIDO)[0];

    if (novo?.tipo !== 'enviar_botoes' || conhecido?.tipo !== 'enviar_botoes') {
      throw new Error('esperava botoes nos dois');
    }
    expect(novo.botoes).toEqual(conhecido.botoes);
  });

  it('as duas saudacoes tem o MESMO nome de resposta', () => {
    // Se tivessem nomes diferentes, o cliente novo que mandasse duas mensagens em
    // rajada receberia dois menus: o primeiro como novo, o segundo como
    // conhecido, e a trava anti-repeticao nao veria relacao entre eles.
    expect(rotear(texto('Oi'), NOVO)[0]?.resposta).toBe(rotear(texto('Oi'), CONHECIDO)[0]?.resposta);
  });

  it('so a saudacao depende disso — as demais respostas sao iguais nos dois casos', () => {
    for (const evento of [botao(montarId('agendar')), botao('1.inexistente'), naoSuportado('audio')]) {
      expect(rotear(evento, NOVO)).toEqual(rotear(evento, CONHECIDO));
    }
  });
});

describe('rotear — botoes', () => {
  it('`agendar` segue para o inicio do agendamento', () => {
    const [acao] = rotear(botao(montarId('agendar')), CONHECIDO);
    expect(acao?.resposta).toBe('agendar_inicio');
    expect(acao?.tipo).toBe('enviar_texto');
  });

  it('`reagendar` e `cancelar` respondem que ainda nao existem — nunca silencio', () => {
    for (const nome of ['reagendar', 'cancelar']) {
      const [acao] = rotear(botao(montarId(nome)), CONHECIDO);
      expect(acao?.resposta).toBe('rota_em_construcao');
      expect(acao?.texto).toContain('agendar');
    }
  });

  it('acao desconhecida no formato certo devolve o menu, nao silencio', () => {
    const [acao] = rotear(botao('1.pagar_com_pix'), CONHECIDO);
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('Não reconheci');
  });

  it('id de versao futura avisa que o botao e de conversa antiga', () => {
    const [acao] = rotear(botao('2.agendar'), CONHECIDO);
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('conversa antiga');
  });

  it('id do fluxo n8n antigo cai no menu em vez de quebrar', () => {
    for (const antigo of ['MENU_AGENDAR', 'BARBEIRO_LUCAS_COSTA', 'DIA_2026-08-04']) {
      expect(rotear(botao(antigo), CONHECIDO)[0]?.resposta).toBe('menu_principal');
    }
  });
});

describe('rotear — formatos que o bot nao entende', () => {
  it('audio, figurinha e localizacao recebem explicacao e o menu', () => {
    for (const formato of ['audio', 'sticker', 'location', 'image']) {
      const [acao] = rotear(naoSuportado(formato), CONHECIDO);
      expect(acao?.resposta).toBe('menu_principal');
      expect(acao?.texto).toContain('texto');
    }
  });
});

describe('rotear — escada de feedback', () => {
  it('degrau 0: texto depois do menu recebe dica curta, nao o menu de novo', () => {
    const [acao] = rotear(texto('e aí, tem horário?'), {
      ...CONHECIDO,
      ultimaResposta: 'menu_principal',
      degrau: 0,
    });

    expect(acao?.resposta).toBe('feedback');
    expect(acao?.tipo).toBe('enviar_texto');
    expect(acao?.texto).toContain('botões');
  });

  it('degrau 0: a dica mira no que o bot pediu por ultimo', () => {
    const noMenu = rotear(texto('oi'), { ...CONHECIDO, ultimaResposta: 'menu_principal', degrau: 0 });
    const noAgendamento = rotear(texto('oi'), {
      ...CONHECIDO,
      ultimaResposta: 'agendar_inicio',
      degrau: 0,
    });

    expect(noMenu[0]?.texto).not.toBe(noAgendamento[0]?.texto);
    expect(noAgendamento[0]?.texto).toContain('agendamento');
  });

  it('degrau 1: insistiu, entao reenvia o menu inteiro', () => {
    const [acao] = rotear(texto('alô???'), {
      ...CONHECIDO,
      ultimaResposta: 'feedback',
      degrau: 1,
    });

    expect(acao?.resposta).toBe('menu_reforcado');
    expect(acao?.tipo).toBe('enviar_botoes');
  });

  it('degrau 2: silencio — a tela dele ja tem tudo', () => {
    const acoes = rotear(texto('???'), { ...CONHECIDO, ultimaResposta: 'menu_reforcado', degrau: 2 });
    expect(acoes).toEqual([]);
  });

  it('botao NUNCA e travado, nem no degrau 2', () => {
    const travado = { ...CONHECIDO, ultimaResposta: 'menu_reforcado' as const, degrau: 2 as const };

    expect(rotear(botao(montarId('agendar')), travado)[0]?.resposta).toBe('agendar_inicio');
    expect(rotear(botao(montarId('cancelar')), travado)[0]?.resposta).toBe('rota_em_construcao');
    expect(rotear(botao('MENU_AGENDAR'), travado)[0]?.resposta).toBe('menu_principal');
  });

  it('sem resposta registrada hoje, volta pro menu — e o reset da meia-noite', () => {
    const [acao] = rotear(texto('bom dia'), { ...CONHECIDO, ultimaResposta: undefined, degrau: 0 });
    expect(acao?.resposta).toBe('menu_principal');
  });

  it('audio no meio do fluxo sobe a escada igual a texto', () => {
    const [acao] = rotear(naoSuportado('audio'), {
      ...CONHECIDO,
      ultimaResposta: 'agendar_inicio',
      degrau: 0,
    });
    expect(acao?.resposta).toBe('feedback');
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

  it('nenhuma entrada fica sem resposta, com cliente novo ou conhecido', () => {
    for (const evento of todos) {
      expect(rotear(evento, NOVO).length).toBeGreaterThan(0);
      expect(rotear(evento, CONHECIDO).length).toBeGreaterThan(0);
    }
  });

  it('toda acao tem destinatario, nome de resposta e texto', () => {
    for (const evento of todos) {
      for (const acao of rotear(evento, NOVO)) {
        expect(acao.para).toBe(BASE.de);
        expect(acao.resposta).not.toBe('');
        expect(acao.texto.length).toBeGreaterThan(0);
      }
    }
  });

  it('e pura: chamar duas vezes com a mesma entrada da o mesmo resultado', () => {
    for (const evento of todos) expect(rotear(evento, NOVO)).toEqual(rotear(evento, NOVO));
  });
});
