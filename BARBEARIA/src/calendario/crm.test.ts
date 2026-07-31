import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Acao } from '../fluxo/acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { criarEspelho, renderizar } from './crm.js';

const BASE = 'http://localhost:3334';
const TOKEN = 'token-de-espelho';

const EVENTO = {
  wamid: 'wamid.RECEBIDA',
  numeroBarbearia: '922642447599728',
  de: '553384246770',
  nome: 'Vitinho 🔥',
  recebidoEm: new Date('2026-07-30T21:09:17Z'),
  cru: { messages: [{ id: 'wamid.RECEBIDA' }] },
} as const;

const texto = (texto: string): EventoRecebido => ({ ...EVENTO, tipo: 'texto', texto });
const botao = (botaoId: string, titulo?: string): EventoRecebido => ({
  ...EVENTO,
  tipo: 'botao',
  botaoId,
  titulo,
});

const CARTAO: Acao = {
  tipo: 'enviar_lista',
  para: '553384246770',
  resposta: 'escolher_dia',
  cabecalho: 'Agendamento 📅',
  texto: 'Qual dia você prefere?',
  rodape: 'Selecione uma opção',
  abrir: 'Ver dias',
  secao: 'Dias disponíveis',
  compacta: true,
  opcoes: [
    { id: '1.dia?b=1&d=2026-07-30', titulo: 'Hoje' },
    { id: '1.dia?b=1&d=2026-07-31', titulo: 'Amanhã' },
  ],
};

/** Troca o `fetch` e guarda o que foi mandado, pra o teste nao tocar em rede. */
function fingirFetch(status = 201) {
  const chamadas: { url: string; corpo: any; cabecalhos: any }[] = [];

  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    chamadas.push({
      url: String(url),
      corpo: JSON.parse(String(init.body)),
      cabecalhos: init.headers,
    });
    return new Response(JSON.stringify({ message: { id: 1 } }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });

  return chamadas;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('espelho da entrada', () => {
  it('manda pro endpoint certo, com o token no cabecalho', async () => {
    const chamadas = fingirFetch();

    await criarEspelho(BASE, TOKEN).entrada(texto('Oi'), undefined);

    expect(chamadas[0]?.url).toBe(`${BASE}/whatsapp/events`);
    expect(chamadas[0]?.cabecalhos['x-webhook-token']).toBe(TOKEN);
    expect(chamadas[0]?.corpo.direction).toBe('inbound');
    expect(chamadas[0]?.corpo.sender_type).toBe('customer');
  });

  it('usa o wamid como chave de idempotencia', async () => {
    const chamadas = fingirFetch();

    await criarEspelho(BASE, TOKEN).entrada(texto('Oi'), undefined);

    expect(chamadas[0]?.corpo.whatsapp_message_id).toBe('wamid.RECEBIDA');
  });

  it('manda o telefone no formato canonico — sem JID, sem 9 artificial', async () => {
    const chamadas = fingirFetch();

    await criarEspelho(BASE, TOKEN).entrada(texto('Oi'), undefined);

    expect(chamadas[0]?.corpo.phone).toBe('553384246770');
    expect(chamadas[0]?.corpo.wa_id).toBe('553384246770');
  });

  it('prefere o nome do cadastro; cai no perfil do WhatsApp so na falta dele', async () => {
    const chamadas = fingirFetch();
    const espelho = criarEspelho(BASE, TOKEN);

    await espelho.entrada(texto('Oi'), 'Victor Santos');
    await espelho.entrada(texto('Oi'), undefined);

    expect(chamadas[0]?.corpo.name).toBe('Victor Santos');
    expect(chamadas[1]?.corpo.name).toBe('Vitinho 🔥');
  });

  it('toque em botao vira so o rotulo que o cliente viu — o id fica no raw_payload', async () => {
    const chamadas = fingirFetch();
    const espelho = criarEspelho(BASE, TOKEN);

    await espelho.entrada(botao('1.barbeiro?b=1', 'Lucas Costa'), undefined);
    await espelho.entrada(botao('1.agendar'), undefined);

    expect(chamadas[0]?.corpo.body).toBe('Lucas Costa');
    // Sem titulo, o id sozinho ainda conta o que ele escolheu.
    expect(chamadas[1]?.corpo.body).toBe('1.agendar');
  });
});

describe('espelho da saida', () => {
  it('marca como bot e usa o wamid que a Meta devolveu', async () => {
    const chamadas = fingirFetch();

    await criarEspelho(BASE, TOKEN).saida(CARTAO, 'wamid.ENVIADA');

    expect(chamadas[0]?.corpo.direction).toBe('outbound');
    expect(chamadas[0]?.corpo.sender_type).toBe('bot');
    expect(chamadas[0]?.corpo.whatsapp_message_id).toBe('wamid.ENVIADA');
  });
});

describe('como o cartao aparece no painel', () => {
  it('junta cabecalho, corpo e as opcoes numa leitura so', () => {
    expect(renderizar(CARTAO)).toBe(
      'Agendamento 📅\nQual dia você prefere?\n\n▸ Hoje\n▸ Amanhã',
    );
  });

  it('sai da PROPRIA acao — nao ha segunda versao do texto pra divergir', () => {
    // O n8n escrevia a parafrase a mao num no separado, e o painel dizia
    // "Qual dia voce prefere? para o agendamento" enquanto o WhatsApp dizia outra
    // coisa. Aqui o texto do cartao aparece literal.
    expect(renderizar(CARTAO)).toContain(CARTAO.texto);
    for (const opcao of CARTAO.opcoes) expect(renderizar(CARTAO)).toContain(opcao.titulo);
  });

  it('mensagem de texto vai como esta, sem enfeite', () => {
    expect(
      renderizar({
        tipo: 'enviar_texto',
        para: '553384246770',
        resposta: 'dia_escolhido',
        texto: 'Show, *Amanhã*. ⏳',
      }),
    ).toBe('Show, *Amanhã*. ⏳');
  });

  it('cartao sem cabecalho nao deixa linha vazia sobrando', () => {
    expect(renderizar({ ...CARTAO, cabecalho: undefined })).toBe(
      'Qual dia você prefere?\n\n▸ Hoje\n▸ Amanhã',
    );
  });
});

describe('quando o painel nao coopera', () => {
  it('token recusado nao lanca — devolve ok:false com o motivo', async () => {
    fingirFetch(401);

    const resultado = await criarEspelho(BASE, 'token-errado').entrada(texto('Oi'), undefined);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivo).toContain('401');
  });

  it('calendario fora do ar nao lanca', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED');
    });

    const resultado = await criarEspelho(BASE, TOKEN).saida(CARTAO, 'wamid.X');

    expect(resultado).toEqual({ ok: false, motivo: 'ECONNREFUSED' });
  });
});
