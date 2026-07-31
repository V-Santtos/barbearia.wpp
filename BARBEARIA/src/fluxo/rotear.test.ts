import { describe, expect, it } from 'vitest';
import type { ContextoFluxo } from './acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { montarId } from './botoes.js';
import { rotear } from './rotear.js';

const BASE = {
  wamid: 'wamid.TESTE',
  numeroBarbearia: '922642447599728',
  de: '5533999999999',
  // O nome do PERFIL do WhatsApp. Chega em toda mensagem e o roteador nao usa:
  // o nome que vale e o do cadastro, no contexto.
  nome: 'Vitinho 🔥',
  recebidoEm: new Date('2026-07-30T12:00:00Z'),
  cru: {},
};

/** Os dois barbeiros cadastrados hoje — vem do banco, nao do codigo. */
const DOIS = [
  { id: 1, nome: 'Lucas Costa' },
  { id: 2, nome: 'Lucas Eloi' },
];

/** Quem nunca fechou um agendamento: sem nome no cadastro. */
const SEM_NOME: ContextoFluxo = {
  nome: undefined,
  saudacao: 'Boa noite',
  hoje: '2026-07-30',
  barbeiros: DOIS,
  agenda: undefined,
  ultimaResposta: undefined,
  degrau: 0,
};

/** Quem ja fechou: o nome foi dito por ele, na etapa de nome do agendamento. */
const COM_NOME: ContextoFluxo = { ...SEM_NOME, nome: 'Victor' };

/** O que a API do calendario devolveu — `hoje` do contexto e 2026-07-30. */
const DIAS: ContextoFluxo['agenda'] = {
  tipo: 'dias',
  dias: ['2026-07-30', '2026-07-31', '2026-08-03', '2026-08-04'],
};

const HORARIOS = (horarios: string[], data = '2026-08-04'): ContextoFluxo['agenda'] => ({
  tipo: 'horarios',
  data,
  horarios,
});

const texto = (texto: string): EventoRecebido => ({ ...BASE, tipo: 'texto', texto });
const botao = (botaoId: string): EventoRecebido => ({
  ...BASE,
  tipo: 'botao',
  botaoId,
  titulo: undefined,
});
const naoSuportado = (formato: string): EventoRecebido => ({ ...BASE, tipo: 'nao_suportado', formato });

describe('rotear — abertura', () => {
  it('responde qualquer texto com saudacao picada e o menu em lista', () => {
    const acoes = rotear(texto('Oi'), SEM_NOME);

    expect(acoes).toHaveLength(2);
    expect(acoes[0]?.tipo).toBe('enviar_texto');
    expect(acoes[0]?.resposta).toBe('saudacao');
    expect(acoes[1]?.tipo).toBe('enviar_lista');
    expect(acoes[1]?.resposta).toBe('menu_principal');
    expect(acoes.every((acao) => acao.para === BASE.de)).toBe(true);
  });

  it('o menu traz as 3 opcoes, o rodape e o rotulo de abertura', () => {
    const menu = rotear(texto('Oi'), SEM_NOME)[1];
    if (menu?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    expect(menu.opcoes).toEqual([
      { id: '1.agendar', titulo: '🗓️ Agendar horário' },
      { id: '1.reagendar', titulo: '🔄 Reagendar horário' },
      { id: '1.cancelar', titulo: '❌ Cancelar horário' },
    ]);
    expect(menu.abrir).toBe('Ver opções');
    expect(menu.rodape).toContain('Atendimento rápido');
  });

  it('trata texto aleatorio igual a saudacao — nao existe entrada sem resposta', () => {
    expect(rotear(texto('asdfgh'), SEM_NOME)[1]?.resposta).toBe('menu_principal');
    expect(rotear(texto('quero cortar o cabelo amanha cedo'), COM_NOME)[1]?.resposta).toBe(
      'menu_principal',
    );
  });

  it('respeita os tetos da Meta: 24 no titulo da linha, 20 no rotulo, 60 no header e no rodape', () => {
    for (const contexto of [SEM_NOME, COM_NOME]) {
      const menu = rotear(texto('Oi'), contexto)[1];
      if (menu?.tipo !== 'enviar_lista') throw new Error('esperava lista');

      for (const opcao of menu.opcoes) expect(opcao.titulo.length).toBeLessThanOrEqual(24);
      expect(menu.abrir.length).toBeLessThanOrEqual(20);
      expect(menu.secao.length).toBeLessThanOrEqual(24);
      expect(menu.rodape.length).toBeLessThanOrEqual(60);
      expect(menu.cabecalho?.length ?? 0).toBeLessThanOrEqual(60);
    }
  });
});

describe('rotear — saudacao por horario', () => {
  it('usa a saudacao que veio no contexto, sem olhar relogio', () => {
    for (const saudacao of ['Bom dia', 'Boa tarde', 'Boa noite'] as const) {
      expect(rotear(texto('Oi'), { ...SEM_NOME, saudacao })[0]?.texto).toBe(`${saudacao}! 👋`);
    }
  });
});

describe('rotear — com nome x sem nome', () => {
  it('so quem tem nome no cadastro e chamado pelo nome', () => {
    expect(rotear(texto('Oi'), SEM_NOME)[0]?.texto).toBe('Boa noite! 👋');
    expect(rotear(texto('Oi'), COM_NOME)[0]?.texto).toBe('Boa noite, Victor. 👋');
  });

  it('NUNCA usa o nome do perfil do WhatsApp que veio no evento', () => {
    // BASE.nome e 'Vitinho 🔥' — apelido que a pessoa pos no proprio aparelho.
    for (const acao of rotear(texto('Oi'), SEM_NOME)) {
      expect(acao.texto).not.toContain('Vitinho');
    }
  });

  it('muda tambem o cabecalho do menu, e so ele', () => {
    const semNome = rotear(texto('Oi'), SEM_NOME)[1];
    const comNome = rotear(texto('Oi'), COM_NOME)[1];

    if (semNome?.tipo !== 'enviar_lista' || comNome?.tipo !== 'enviar_lista') {
      throw new Error('esperava lista nos dois');
    }

    expect(semNome.cabecalho).toBe('Bem-vindo à Barbearia.');
    expect(comNome.cabecalho).toBe('Bom de ver novamente!');
    expect(semNome.texto).toBe(comNome.texto);
    expect(semNome.opcoes).toEqual(comNome.opcoes);
  });

  it('as duas aberturas tem os MESMOS nomes de resposta', () => {
    // Se tivessem nomes diferentes, o cliente que mandasse duas mensagens em rajada
    // receberia duas aberturas e a trava anti-repeticao nao veria relacao entre elas.
    expect(rotear(texto('Oi'), SEM_NOME).map((acao) => acao.resposta)).toEqual(
      rotear(texto('Oi'), COM_NOME).map((acao) => acao.resposta),
    );
  });

  it('so a abertura depende disso — as demais respostas sao iguais nos dois casos', () => {
    for (const evento of [botao(montarId('agendar')), naoSuportado('audio')]) {
      const meioDoFluxo = { ultimaResposta: 'menu_principal' as const, degrau: 0 as const };
      expect(rotear(evento, { ...SEM_NOME, ...meioDoFluxo })).toEqual(
        rotear(evento, { ...COM_NOME, ...meioDoFluxo }),
      );
    }
  });
});

describe('rotear — escolha do barbeiro', () => {
  const comBarbeiros = (barbeiros: ContextoFluxo['barbeiros']) => ({ ...SEM_NOME, barbeiros });

  it('com 2 barbeiros, `agendar` pergunta com quem', () => {
    const [acao] = rotear(botao(montarId('agendar')), SEM_NOME);

    expect(acao?.resposta).toBe('escolher_barbeiro');
    if (acao?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    expect(acao.cabecalho).toBe('Show!');
    expect(acao.texto).toBe('Com qual profissional você deseja agendar seu horário?');
    expect(acao.rodape).toBe('Selecione uma opção');
    expect(acao.opcoes).toEqual([
      { id: '1.barbeiro?b=1', titulo: 'Lucas Costa' },
      { id: '1.barbeiro?b=2', titulo: 'Lucas Eloi' },
    ]);
  });

  it('com 1 barbeiro, a pergunta NAO e feita — vai direto pros dias', () => {
    const contexto = { ...comBarbeiros([DOIS[0]!]), agenda: DIAS };
    const acoes = rotear(botao(montarId('agendar')), contexto);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['barbeiro_escolhido', 'escolher_dia']);
    expect(acoes[0]?.texto).toContain('Lucas Costa');
  });

  it('sem barbeiro ativo, avisa que a agenda esta fechada — nunca silencio', () => {
    const [acao] = rotear(botao(montarId('agendar')), comBarbeiros([]));
    expect(acao?.resposta).toBe('agenda_indisponivel');
  });

  it('escolher um barbeiro valido segue com o nome dele', () => {
    const [acao] = rotear(botao(montarId('barbeiro', { b: '2' })), { ...SEM_NOME, agenda: DIAS });

    expect(acao?.resposta).toBe('barbeiro_escolhido');
    expect(acao?.texto).toContain('Lucas Eloi');
    expect(acao?.texto).not.toContain('Lucas Costa');
  });

  it('id de barbeiro que nao esta ativo volta a pergunta, nao escolhe por ele', () => {
    // O cliente tocou num item de ontem e o barbeiro 2 foi desativado no meio.
    const [acao] = rotear(botao(montarId('barbeiro', { b: '2' })), comBarbeiros([DOIS[0]!]));

    expect(acao?.resposta).toBe('escolher_barbeiro');
    expect(acao?.texto).toContain('Não encontrei');
    expect(acao?.tipo === 'enviar_lista' && acao.opcoes).toHaveLength(1);
    // "Show!" e comemoracao: nao cabe em cima de uma correcao de rota.
    expect(acao?.tipo === 'enviar_lista' && acao.cabecalho).toBeUndefined();
  });

  it('`b` fora do formato nao vira barbeiro nenhum', () => {
    for (const b of ['', 'abc', '99', '1; drop table', ' 1']) {
      const [acao] = rotear(botao(`1.barbeiro?b=${b}`), SEM_NOME);
      expect(acao?.resposta).toBe('escolher_barbeiro');
    }
  });

  it('`barbeiro` sem parametro nenhum pergunta de novo em vez de quebrar', () => {
    expect(rotear(botao('1.barbeiro'), SEM_NOME)[0]?.resposta).toBe('escolher_barbeiro');
  });

  it('nome grande e cortado no teto de 24 da Meta', () => {
    const acao = rotear(
      botao(montarId('agendar')),
      comBarbeiros([
        { id: 1, nome: 'Lucas Costa Ferreira de Albuquerque' },
        { id: 2, nome: 'Lucas Eloi' },
      ]),
    )[0];

    if (acao?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    for (const opcao of acao.opcoes) expect(opcao.titulo.length).toBeLessThanOrEqual(24);
    expect(acao.opcoes[0]?.titulo).toContain('Lucas Costa');
  });

  it('a escada mira o passo do barbeiro quando foi ele o ultimo', () => {
    const [acao] = rotear(texto('o costa'), {
      ...SEM_NOME,
      ultimaResposta: 'escolher_barbeiro',
      degrau: 0,
    });

    expect(acao?.resposta).toBe('feedback');
    expect(acao?.texto).toContain('Ver barbeiros');
  });
});

describe('rotear — opcoes do menu', () => {
  it('`agendar` entra no agendamento', () => {
    const [acao] = rotear(botao(montarId('agendar')), SEM_NOME);
    expect(acao?.resposta).toBe('escolher_barbeiro');
  });

  it('`reagendar` e `cancelar` respondem que ainda nao existem — nunca silencio', () => {
    for (const nome of ['reagendar', 'cancelar']) {
      const [acao] = rotear(botao(montarId(nome)), SEM_NOME);
      expect(acao?.resposta).toBe('rota_em_construcao');
      expect(acao?.texto).toContain('agendar');
    }
  });

  it('acao desconhecida no formato certo devolve o menu, nao silencio', () => {
    const [acao] = rotear(botao('1.pagar_com_pix'), SEM_NOME);
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('Não reconheci');
  });

  it('id de versao futura avisa que a opcao e de conversa antiga', () => {
    const [acao] = rotear(botao('2.agendar'), SEM_NOME);
    expect(acao?.resposta).toBe('menu_principal');
    expect(acao?.texto).toContain('conversa antiga');
  });

  it('id do fluxo n8n antigo cai na abertura em vez de quebrar', () => {
    for (const antigo of ['MENU_AGENDAR', 'BARBEIRO_LUCAS_COSTA', 'DIA_2026-08-04']) {
      expect(rotear(botao(antigo), SEM_NOME).map((acao) => acao.resposta)).toEqual([
        'saudacao',
        'menu_principal',
      ]);
    }
  });
});

describe('rotear — formatos que o bot nao entende', () => {
  it('audio, figurinha e localizacao recebem explicacao e o menu', () => {
    for (const formato of ['audio', 'sticker', 'location', 'image']) {
      const acoes = rotear(naoSuportado(formato), SEM_NOME);
      expect(acoes[1]?.resposta).toBe('menu_principal');
      expect(acoes[1]?.texto).toContain('texto');
    }
  });
});

describe('rotear — escada de feedback', () => {
  it('degrau 0: texto depois do menu recebe dica curta, nao o menu de novo', () => {
    const [acao] = rotear(texto('e aí, tem horário?'), {
      ...SEM_NOME,
      ultimaResposta: 'menu_principal',
      degrau: 0,
    });

    expect(acao?.resposta).toBe('feedback');
    expect(acao?.tipo).toBe('enviar_texto');
    expect(acao?.texto).toContain('Ver opções');
  });

  it('degrau 0: a dica mira no que o bot pediu por ultimo', () => {
    const noMenu = rotear(texto('oi'), { ...SEM_NOME, ultimaResposta: 'menu_principal', degrau: 0 });
    const noAgendamento = rotear(texto('oi'), {
      ...SEM_NOME,
      ultimaResposta: 'escolher_dia',
      degrau: 0,
    });

    expect(noMenu[0]?.texto).not.toBe(noAgendamento[0]?.texto);
    expect(noAgendamento[0]?.texto).toContain('dias');
  });

  it('degrau 1: insistiu, entao reenvia o menu — sem repetir a saudacao', () => {
    const acoes = rotear(texto('alô???'), {
      ...SEM_NOME,
      ultimaResposta: 'feedback',
      degrau: 1,
    });

    expect(acoes).toHaveLength(1);
    expect(acoes[0]?.resposta).toBe('menu_reforcado');
    expect(acoes[0]?.tipo).toBe('enviar_lista');
    expect(acoes[0]?.tipo === 'enviar_lista' && acoes[0].cabecalho).toBeUndefined();
  });

  it('degrau 2: silencio — a tela dele ja tem tudo', () => {
    const acoes = rotear(texto('???'), { ...SEM_NOME, ultimaResposta: 'menu_reforcado', degrau: 2 });
    expect(acoes).toEqual([]);
  });

  it('opcao do menu NUNCA e travada, nem no degrau 2', () => {
    const travado = { ...SEM_NOME, ultimaResposta: 'menu_reforcado' as const, degrau: 2 as const };

    expect(rotear(botao(montarId('agendar')), travado)[0]?.resposta).toBe('escolher_barbeiro');
    expect(rotear(botao(montarId('cancelar')), travado)[0]?.resposta).toBe('rota_em_construcao');
    expect(rotear(botao('MENU_AGENDAR'), travado)[0]?.resposta).toBe('saudacao');
  });

  it('sem resposta registrada hoje, volta pra abertura — e o reset da meia-noite', () => {
    const acoes = rotear(texto('bom dia'), { ...SEM_NOME, ultimaResposta: undefined, degrau: 0 });
    expect(acoes.map((acao) => acao.resposta)).toEqual(['saudacao', 'menu_principal']);
  });

  it('audio no meio do fluxo sobe a escada igual a texto', () => {
    const [acao] = rotear(naoSuportado('audio'), {
      ...SEM_NOME,
      ultimaResposta: 'escolher_dia',
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

  it('nenhuma entrada fica sem resposta, com nome no cadastro ou sem', () => {
    for (const evento of todos) {
      expect(rotear(evento, SEM_NOME).length).toBeGreaterThan(0);
      expect(rotear(evento, COM_NOME).length).toBeGreaterThan(0);
    }
  });

  it('toda acao tem destinatario, nome de resposta e texto', () => {
    for (const evento of todos) {
      for (const acao of rotear(evento, SEM_NOME)) {
        expect(acao.para).toBe(BASE.de);
        expect(acao.resposta).not.toBe('');
        expect(acao.texto.length).toBeGreaterThan(0);
      }
    }
  });

  it('e pura: chamar duas vezes com a mesma entrada da o mesmo resultado', () => {
    for (const evento of todos) expect(rotear(evento, SEM_NOME)).toEqual(rotear(evento, SEM_NOME));
  });
});

describe('rotear — escolha do dia', () => {
  const tocaBarbeiro = (agenda: ContextoFluxo['agenda']) =>
    rotear(botao(montarId('barbeiro', { b: '1' })), { ...SEM_NOME, agenda });

  it('manda a intersecao ANTES da lista — nessa ordem, sempre', () => {
    const acoes = tocaBarbeiro(DIAS);

    expect(acoes.map((acao) => acao.tipo)).toEqual(['enviar_texto', 'enviar_lista']);
    expect(acoes.map((acao) => acao.resposta)).toEqual(['barbeiro_escolhido', 'escolher_dia']);
  });

  it('rotula hoje, amanha e o resto com dia da semana e data', () => {
    const lista = tocaBarbeiro(DIAS)[1];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    expect(lista.opcoes).toEqual([
      { id: '1.dia?b=1&d=2026-07-30', titulo: 'Hoje' },
      { id: '1.dia?b=1&d=2026-07-31', titulo: 'Amanhã' },
      { id: '1.dia?b=1&d=2026-08-03', titulo: 'Seg 03/08' },
      { id: '1.dia?b=1&d=2026-08-04', titulo: 'Ter 04/08' },
    ]);
  });

  it('o contexto viaja no id: o dia carrega o barbeiro junto', () => {
    const lista = tocaBarbeiro(DIAS)[1];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    for (const opcao of lista.opcoes) expect(opcao.id).toContain('b=1');
  });

  it('pede formato compacto — a regra de <=3 vale pro dia', () => {
    const lista = tocaBarbeiro(DIAS)[1];
    expect(lista?.tipo === 'enviar_lista' && lista.compacta).toBe(true);
  });

  it('nenhum dia com vaga nao e a mesma coisa que agenda fora do ar', () => {
    const semVaga = tocaBarbeiro({ tipo: 'dias', dias: [] });
    const quebrada = tocaBarbeiro({ tipo: 'fora_do_ar' });

    expect(semVaga[0]?.resposta).toBe('sem_dia_disponivel');
    expect(semVaga[0]?.texto).toContain('Lucas Costa');
    expect(quebrada[0]?.resposta).toBe('agenda_fora_do_ar');
    // A frase da falha nossa nao pode culpar a agenda do barbeiro.
    expect(quebrada[0]?.texto).not.toContain('Lucas Costa');
  });

  it('nunca oferece mais de 10 dias — a Meta recusa a mensagem inteira acima disso', () => {
    const doze = Array.from({ length: 12 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const lista = tocaBarbeiro({ tipo: 'dias', dias: doze })[1];

    expect(lista?.tipo === 'enviar_lista' && lista.opcoes).toHaveLength(10);
  });
});

describe('rotear — escolha do horario', () => {
  const tocaDia = (agenda: ContextoFluxo['agenda'], d = '2026-08-04') =>
    rotear(botao(montarId('dia', { b: '1', d })), { ...SEM_NOME, agenda });

  it('intersecao com o dia escolhido, e a lista de horarios atras', () => {
    const acoes = tocaDia(HORARIOS(['08:00', '09:00', '13:00', '14:00']));

    expect(acoes.map((acao) => acao.resposta)).toEqual(['dia_escolhido', 'escolher_horario']);
    expect(acoes[0]?.texto).toContain('Ter 04/08');

    const lista = acoes[1];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    expect(lista.opcoes[0]).toEqual({ id: '1.hora?b=1&d=2026-08-04&h=08%3A00', titulo: '08:00' });
  });

  it('corta nos 10 primeiros horarios — decisao explicita, com custo conhecido', () => {
    const treze = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);
    const lista = tocaDia(HORARIOS(treze))[1];

    expect(lista?.tipo === 'enviar_lista' && lista.opcoes).toHaveLength(10);
  });

  it('dia sem horario oferece a volta — e a volta e uma rota que existe', () => {
    const [acao] = tocaDia(HORARIOS([]));

    expect(acao?.resposta).toBe('sem_horario_no_dia');
    if (acao?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    // O n8n oferecia "Escolher outro dia" com um id que nenhuma rota reconhecia.
    const volta = acao.opcoes[0]!;
    expect(volta.id).toBe('1.barbeiro?b=1');
    expect(rotear(botao(volta.id), { ...SEM_NOME, agenda: DIAS })[0]?.resposta).toBe(
      'barbeiro_escolhido',
    );
  });

  it('barbeiro desativado no meio derruba o `b` do id e volta a pergunta', () => {
    const acoes = rotear(botao(montarId('dia', { b: '9', d: '2026-08-04' })), {
      ...SEM_NOME,
      agenda: HORARIOS(['08:00']),
    });

    expect(acoes[0]?.resposta).toBe('escolher_barbeiro');
  });
});

describe('rotear — pergunta do nome (fim desta fatia)', () => {
  const tocaHora = (params: Record<string, string>) =>
    rotear(botao(montarId('hora', params)), SEM_NOME);

  it('confirma a escolha inteira e pede nome e sobrenome', () => {
    const acoes = tocaHora({ b: '1', d: '2026-08-04', h: '13:00' });

    expect(acoes.map((acao) => acao.resposta)).toEqual(['horario_escolhido', 'pedir_nome']);
    expect(acoes[0]?.texto).toContain('Ter 04/08');
    expect(acoes[0]?.texto).toContain('13:00');
    expect(acoes[0]?.texto).toContain('Lucas Costa');
    expect(acoes[1]?.texto).toContain('nome e sobrenome');
  });

  it('sem dia ou sem hora no id, oferece a volta em vez de inventar', () => {
    expect(tocaHora({ b: '1', h: '13:00' })[0]?.resposta).toBe('sem_horario_no_dia');
    expect(tocaHora({ b: '1', d: '2026-08-04' })[0]?.resposta).toBe('sem_horario_no_dia');
  });
});
