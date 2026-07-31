import { describe, expect, it } from 'vitest';
import type { ContextoFluxo } from '../fluxo/acoes.js';
import { montarId } from '../fluxo/botoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { alvoDaAgenda } from './eventos.js';

/**
 * `alvoDaAgenda` decide o que perguntar — e, desde a etapa do nome, o que ESCREVER.
 * E a unica funcao do bot que autoriza um efeito, entao os testes aqui sao sobre
 * quando ela autoriza e, principalmente, quando ela se recusa.
 */

const BASE = {
  wamid: 'wamid.TESTE',
  numeroBarbearia: '922642447599728',
  de: '553384246770',
  nome: 'Vitinho 🔥',
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

const LUCAS = { id: 1, nome: 'Lucas Costa' };

const CONTEXTO: Omit<ContextoFluxo, 'agenda'> = {
  nome: undefined,
  saudacao: 'Boa noite',
  hoje: '2026-07-30',
  barbeiros: [LUCAS, { id: 2, nome: 'Lucas Eloi' }],
  ultimaResposta: undefined,
  degrau: 0,
  donoAtendendo: false,
  nomePendente: undefined,
  reserva: undefined,
};

const NO_CARTAO: Omit<ContextoFluxo, 'agenda'> = {
  ...CONTEXTO,
  ultimaResposta: 'conferir_nome',
  nomePendente: 'Victor',
  reserva: { barbeiro: LUCAS, data: '2026-08-04', hora: '08:00' },
};

describe('alvoDaAgenda — consultas', () => {
  it('cada passo pergunta o que precisa, e `hora` nao pergunta nada', () => {
    expect(alvoDaAgenda(botao(montarId('barbeiro', { b: '1' })), CONTEXTO)).toEqual({
      tipo: 'dias',
      barbeiro: 1,
    });
    expect(alvoDaAgenda(botao(montarId('dia', { b: '1', d: '2026-08-04' })), CONTEXTO)).toEqual({
      tipo: 'horarios',
      barbeiro: 1,
      data: '2026-08-04',
    });
    expect(
      alvoDaAgenda(botao(montarId('hora', { b: '1', d: '2026-08-04', h: '08:00' })), CONTEXTO),
    ).toBeUndefined();
  });
});

describe('alvoDaAgenda — quando escrever', () => {
  it('Confirmar marca com a reserva e o nome do historico', () => {
    const alvo = alvoDaAgenda(botao(montarId('confirmar')), {
      ...NO_CARTAO,
      nomePendente: 'Victor Santos',
    });

    expect(alvo).toEqual({
      tipo: 'marcar',
      barbeiro: LUCAS,
      data: '2026-08-04',
      hora: '08:00',
      cliente: 'Victor Santos',
      telefone: '553384246770',
    });
  });

  it('sobrenome depois do cartao marca sozinho, com o nome ja juntado', () => {
    const alvo = alvoDaAgenda(texto('Santos'), NO_CARTAO);

    expect(alvo).toMatchObject({ tipo: 'marcar', cliente: 'Victor Santos' });
  });
});

describe('alvoDaAgenda — quando NAO escrever', () => {
  it('correcao nao marca: e onde a nossa leitura mais erra, e o cartao tem que voltar', () => {
    expect(alvoDaAgenda(texto('Victor'), { ...NO_CARTAO, nomePendente: 'Vicctor' })).toBeUndefined();
  });

  it('primeiro nome sozinho nao marca — falta informacao, nao ha o que gravar', () => {
    expect(alvoDaAgenda(texto('Victor'), { ...NO_CARTAO, nomePendente: undefined })).toBeUndefined();
  });

  it('Confirmar sem reserva ou sem nome nao grava agendamento pela metade', () => {
    const semNome = { ...NO_CARTAO, nomePendente: undefined };
    const semReserva = { ...NO_CARTAO, nomePendente: 'Victor Santos', reserva: undefined };

    expect(alvoDaAgenda(botao(montarId('confirmar')), semNome)).toBeUndefined();
    expect(alvoDaAgenda(botao(montarId('confirmar')), semReserva)).toBeUndefined();
  });

  it('texto fora da etapa do nome nunca escreve', () => {
    // Sem este corte, "Victor Santos" dito no meio do menu marcaria um horario.
    expect(
      alvoDaAgenda(texto('Santos'), { ...NO_CARTAO, ultimaResposta: 'menu_principal' }),
    ).toBeUndefined();
  });

  it('lixo na etapa do nome nao escreve', () => {
    for (const entrada of ['ok', '123', '😀', 'errei o nome']) {
      expect(alvoDaAgenda(texto(entrada), NO_CARTAO), entrada).toBeUndefined();
    }
  });

  it('barbeiro desativado no meio derruba a reserva antes de virar escrita', () => {
    // A reserva ja vem validada contra a lista de ativos, entao aqui basta ela nao
    // existir — mas o teste fixa o contrato: sem barbeiro, nao ha marcacao.
    expect(
      alvoDaAgenda(botao(montarId('confirmar')), { ...NO_CARTAO, reserva: undefined }),
    ).toBeUndefined();
  });
});
