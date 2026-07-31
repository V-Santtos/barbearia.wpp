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
  donoAtendendo: false,
  nomePendente: undefined,
  reserva: undefined,
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
      { id: '1.barbeiro?b=1', titulo: '▫️ Lucas Costa' },
      { id: '1.barbeiro?b=2', titulo: '▫️ Lucas Eloi' },
    ]);
  });

  it('com 1 barbeiro, a pergunta NAO e feita — vai direto pros dias', () => {
    const contexto = { ...comBarbeiros([DOIS[0]!]), agenda: DIAS };
    const acoes = rotear(botao(montarId('agendar')), contexto);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['escolher_dia']);
    // A escolha aconteceu, o cliente so nao viu a pergunta: o barbeiro 1 viaja no id.
    const [lista] = acoes;
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    for (const opcao of lista.opcoes) expect(opcao.id).toContain('b=1');
  });

  it('sem barbeiro ativo, avisa que a agenda esta fechada — nunca silencio', () => {
    const [acao] = rotear(botao(montarId('agendar')), comBarbeiros([]));
    expect(acao?.resposta).toBe('agenda_indisponivel');
  });

  it('escolher um barbeiro valido segue com ele — e so com ele', () => {
    const [acao] = rotear(botao(montarId('barbeiro', { b: '2' })), { ...SEM_NOME, agenda: DIAS });

    expect(acao?.resposta).toBe('escolher_dia');
    if (acao?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    // Sem a frase "Vamos marcar com o Fulano" (cortada em 2026-07-31), quem carrega a
    // escolha adiante e o id de cada dia — e ele nao pode trocar de barbeiro no meio.
    for (const opcao of acao.opcoes) expect(opcao.id).toContain('b=2');
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
    // O teto conta o icone junto — e o corte nao pode comer o icone nem parti-lo ao
    // meio, porque titulo com metade de emoji faz a Meta recusar a lista inteira.
    for (const opcao of acao.opcoes) {
      expect(opcao.titulo.length).toBeLessThanOrEqual(24);
      expect(opcao.titulo.startsWith('▫️ ')).toBe(true);
    }
    expect(acao.opcoes[0]?.titulo).toContain('Lucas Costa');
    expect(acao.opcoes[0]?.titulo).toMatch(/…$/);
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

  it('manda a lista sozinha — sem intersecao na frente', () => {
    const acoes = tocaBarbeiro(DIAS);

    expect(acoes.map((acao) => acao.tipo)).toEqual(['enviar_lista']);
    expect(acoes.map((acao) => acao.resposta)).toEqual(['escolher_dia']);
  });

  it('rotula hoje, amanha e o resto com dia da semana e data, com icone na frente', () => {
    const lista = tocaBarbeiro(DIAS)[0];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    expect(lista.opcoes).toEqual([
      { id: '1.dia?b=1&d=2026-07-30', titulo: '🔘 Hoje' },
      { id: '1.dia?b=1&d=2026-07-31', titulo: '🔘 Amanhã' },
      { id: '1.dia?b=1&d=2026-08-03', titulo: '🔘 Seg 03/08' },
      { id: '1.dia?b=1&d=2026-08-04', titulo: '🔘 Ter 04/08' },
    ]);
  });

  it('o cabecalho leva os dois-pontos', () => {
    const lista = tocaBarbeiro(DIAS)[0];
    expect(lista?.tipo === 'enviar_lista' && lista.cabecalho).toBe('Agendamento: 📅');
  });

  it('o contexto viaja no id: o dia carrega o barbeiro junto', () => {
    const lista = tocaBarbeiro(DIAS)[0];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');

    for (const opcao of lista.opcoes) expect(opcao.id).toContain('b=1');
  });

  it('pede formato compacto — a regra de <=3 vale pro dia', () => {
    const lista = tocaBarbeiro(DIAS)[0];
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
    const lista = tocaBarbeiro({ tipo: 'dias', dias: doze })[0];

    expect(lista?.tipo === 'enviar_lista' && lista.opcoes).toHaveLength(10);
  });
});

describe('rotear — escolha do horario', () => {
  const tocaDia = (agenda: ContextoFluxo['agenda'], d = '2026-08-04') =>
    rotear(botao(montarId('dia', { b: '1', d })), { ...SEM_NOME, agenda });

  it('intersecao ANTES da lista de horarios — e a unica espera que sobrou coberta', () => {
    const acoes = tocaDia(HORARIOS(['08:00', '09:00', '13:00', '14:00']));

    expect(acoes.map((acao) => acao.resposta)).toEqual(['dia_escolhido', 'escolher_horario']);
    // A intersecao nao repete o dia: o cliente acabou de toca-lo, e o cartao atras
    // ja diz de que dia sao os horarios.
    expect(acoes[0]?.texto).toBe('Só um momento que eu já te mostro os horários disponíveis. ⏳');

    const lista = acoes[1];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    expect(lista.opcoes[0]).toEqual({ id: '1.hora?b=1&d=2026-08-04&h=08%3A00', titulo: '🕐 08:00' });
    // Nem a intersecao nem o cartao repetem o dia — ele acabou de ser tocado.
    expect(lista.texto).toBe('Qual horário fica melhor pra você?');
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
      'escolher_dia',
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

  it('pede nome e sobrenome, numa mensagem so', () => {
    const acoes = tocaHora({ b: '1', d: '2026-08-04', h: '13:00' });

    // Sem eco da escolha: o cliente acabou de tocar no horario. A confirmacao de
    // verdade e o cartao de conferencia, que ainda nao existe.
    expect(acoes.map((acao) => acao.resposta)).toEqual(['pedir_nome']);
    expect(acoes[0]?.texto).toContain('nome e sobrenome');
  });

  it('sem dia ou sem hora no id, oferece a volta em vez de inventar', () => {
    expect(tocaHora({ b: '1', h: '13:00' })[0]?.resposta).toBe('sem_horario_no_dia');
    expect(tocaHora({ b: '1', d: '2026-08-04' })[0]?.resposta).toBe('sem_horario_no_dia');
  });
});

describe('rotear — o dono atendendo a mao', () => {
  const ATENDENDO: ContextoFluxo = { ...SEM_NOME, donoAtendendo: true };

  it('cala em texto: o bot nao fala por cima de quem esta conversando', () => {
    expect(rotear(texto('e mais cedo, da?'), ATENDENDO)).toEqual([]);
  });

  it('cala tambem em formato sem suporte — audio no meio do papo nao vira aula de menu', () => {
    expect(rotear(naoSuportado('audio'), ATENDENDO)).toEqual([]);
  });

  it('nao cala em texto quando o dono NAO esta atendendo', () => {
    expect(rotear(texto('oi'), SEM_NOME).length).toBeGreaterThan(0);
  });

  it('toque em botao continua funcionando — e o que devolve a conversa ao bot', () => {
    // A checagem do dono vem DEPOIS do botao de proposito: tocar no menu e pedir o
    // bot com todas as letras, mesmo no meio de uma conversa com uma pessoa.
    const acoes = rotear(botao(montarId('agendar')), ATENDENDO);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['escolher_barbeiro']);
  });

  it('a escada nao avanca enquanto o dono atende — o silencio nao e degrau', () => {
    // Sem isto, o cliente conversando com o dono subiria a escada calado e receberia
    // o menu reforcado na cara assim que o dono largasse a conversa.
    const noMeio: ContextoFluxo = { ...ATENDENDO, ultimaResposta: 'menu_principal', degrau: 1 };

    expect(rotear(texto('e ai?'), noMeio)).toEqual([]);
  });
});

describe('rotear — a etapa do nome', () => {
  const RESERVA = { barbeiro: DOIS[0]!, data: '2026-08-04', hora: '08:00' };

  /** O estado logo depois de o bot pedir o nome. */
  const PEDIU: ContextoFluxo = {
    ...SEM_NOME,
    ultimaResposta: 'pedir_nome',
    reserva: RESERVA,
  };

  const cartao = (acoes: ReturnType<typeof rotear>) => {
    const lista = acoes[1];
    if (lista?.tipo !== 'enviar_lista') throw new Error('esperava o cartao');
    return lista;
  };

  it('nome completo vira aviso + cartao, e o nome sai sozinho na primeira linha', () => {
    const acoes = rotear(texto('victor santos'), PEDIU);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['conferir_nome_aviso', 'conferir_nome']);
    // O 👇 amarra o aviso ao cartao: sem ele, a frase manda conferir algo que ainda
    // nao chegou na tela.
    expect(acoes[0]?.texto).toContain('👇');
    expect(cartao(acoes).texto.startsWith('*Victor Santos*')).toBe(true);
    expect(cartao(acoes).texto).toContain('Ter 04/08 às 08:00');
    expect(cartao(acoes).texto).toContain('Lucas Costa');
  });

  it('os dois botoes do cartao, e o formato compacto que mostra tudo sem abrir', () => {
    const lista = cartao(rotear(texto('victor santos'), PEDIU));

    expect(lista.compacta).toBe(true);
    expect(lista.opcoes).toEqual([
      { id: '1.confirmar', titulo: '✅ Confirmar' },
      { id: '1.corrigir', titulo: '✏️ Corrigir nome' },
    ]);
  });

  it('o rodape anuncia a acao provavel de cada estado', () => {
    expect(cartao(rotear(texto('victor'), PEDIU)).rodape).toContain('sobrenome');
    expect(cartao(rotear(texto('victor santos'), PEDIU)).rodape).toContain('Confira o nome');
  });

  it('uma palavra so tambem vira cartao — recusar prenderia o cliente', () => {
    const acoes = rotear(texto('victor'), PEDIU);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['conferir_nome_aviso', 'conferir_nome']);
    expect(cartao(acoes).texto.startsWith('*Victor*')).toBe(true);
  });

  it('sobrenome depois do cartao FECHA sem toque nenhum', () => {
    const comCartao: ContextoFluxo = {
      ...PEDIU,
      ultimaResposta: 'conferir_nome',
      nomePendente: 'Victor',
      agenda: { tipo: 'marcado' },
    };

    const acoes = rotear(texto('Santos'), comCartao);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['agendado']);
    // Chamado pelo PRIMEIRO nome: o completo foi gravado pro dono, nao pro bot recitar.
    expect(acoes[0]?.texto).toContain('Tudo certo, Victor!');
    expect(acoes[0]?.texto).not.toContain('Victor Santos!');
  });

  it('correcao depois do cartao NAO fecha — reimprime pra quem sabe conferir', () => {
    // E justo aqui que a nossa leitura tem mais chance de errar. Pular o cartao
    // seria abrir mao da unica conferencia que existe.
    const comCartao: ContextoFluxo = {
      ...PEDIU,
      ultimaResposta: 'conferir_nome',
      nomePendente: 'Vicctor',
      agenda: { tipo: 'marcado' },
    };

    const acoes = rotear(texto('Victor'), comCartao);

    expect(acoes.map((acao) => acao.resposta)).toEqual(['conferir_nome_aviso', 'conferir_nome']);
    expect(cartao(acoes).texto.startsWith('*Victor*')).toBe(true);
  });

  it('"errei o nome" escrito vale o mesmo que o botao', () => {
    const comCartao: ContextoFluxo = {
      ...PEDIU,
      ultimaResposta: 'conferir_nome',
      nomePendente: 'Vicctor',
    };

    expect(rotear(texto('errei meu nome'), comCartao)[0]?.resposta).toBe('pedir_nome');
    expect(rotear(botao(montarId('corrigir')), comCartao)[0]?.resposta).toBe('pedir_nome');
  });

  it('recusa com a frase mirada no motivo — o que o n8n calculava e jogava fora', () => {
    const recusa = (entrada: string) => rotear(texto(entrada), PEDIU)[0];

    expect(recusa('ok')?.resposta).toBe('nome_invalido');
    expect(recusa('Victor 2')?.texto).toContain('número');
    expect(recusa('x')?.texto).toContain('completo');
    // Toda recusa mostra o exemplo, senao ela cobra sem ensinar.
    expect(recusa('ok')?.texto).toContain('Victor Santos');
  });

  it('nunca fica em silencio: todo texto da etapa produz resposta', () => {
    const entradas = ['victor', 'victor santos', 'ok', '123', '😀', 'errei', 'meu nome é Ana'];

    for (const estado of ['pedir_nome', 'conferir_nome', 'nome_invalido'] as const) {
      for (const entrada of entradas) {
        const acoes = rotear(texto(entrada), { ...PEDIU, ultimaResposta: estado });
        expect(acoes.length, `${estado} + "${entrada}"`).toBeGreaterThan(0);
      }
    }
  });

  it('Confirmar marca; sem nome no historico, repergunta em vez de gravar vazio', () => {
    const pronto: ContextoFluxo = {
      ...PEDIU,
      ultimaResposta: 'conferir_nome',
      nomePendente: 'Victor Santos',
      agenda: { tipo: 'marcado' },
    };

    expect(rotear(botao(montarId('confirmar')), pronto)[0]?.resposta).toBe('agendado');
    expect(rotear(botao(montarId('confirmar')), { ...pronto, nomePendente: undefined })[0]?.resposta).toBe(
      'pedir_nome',
    );
  });

  it('horario tomado no meio do caminho fala da AGENDA, e oferece volta que existe', () => {
    const ocupado: ContextoFluxo = {
      ...PEDIU,
      ultimaResposta: 'conferir_nome',
      nomePendente: 'Victor Santos',
      agenda: { tipo: 'ocupado' },
    };

    const [acao] = rotear(botao(montarId('confirmar')), ocupado);

    expect(acao?.resposta).toBe('horario_ocupado');
    expect(acao?.texto).toContain('08:00');
    if (acao?.tipo !== 'enviar_lista') throw new Error('esperava lista');
    // As duas voltas sao rotas que o switch reconhece, nao botao morto.
    expect(acoes(acao).map((opcao) => opcao.id)).toEqual([
      '1.dia?b=1&d=2026-08-04',
      '1.barbeiro?b=1',
    ]);
  });

  it('o dono atendendo cala tambem a etapa do nome', () => {
    expect(rotear(texto('victor santos'), { ...PEDIU, donoAtendendo: true })).toEqual([]);
  });
});

/** Atalho pra ler as opcoes de uma acao de lista dentro de um teste. */
function acoes(acao: Extract<ReturnType<typeof rotear>[number], { tipo: 'enviar_lista' }>) {
  return acao.opcoes;
}
