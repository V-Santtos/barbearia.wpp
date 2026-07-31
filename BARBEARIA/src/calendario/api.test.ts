import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarDias, buscarHorarios } from './api.js';

const BASE = 'http://localhost:3334';

/** Troca o `fetch` global e guarda as URLs pedidas, pra o teste nao tocar em rede. */
function fingirFetch(responder: () => Response | Promise<Response>) {
  const pedidas: string[] = [];

  vi.stubGlobal('fetch', async (url: string | URL) => {
    pedidas.push(String(url));
    return responder();
  });

  return pedidas;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buscarDias', () => {
  it('NAO manda days= — a janela e a que o dono configurou no painel', async () => {
    const pedidas = fingirFetch(() => json({ openDays: [] }));

    await buscarDias(BASE, 1);

    expect(pedidas[0]).toBe(`${BASE}/agendamentos/dias-disponiveis?professionalId=1`);
    expect(pedidas[0]).not.toContain('days=');
  });

  it('devolve so as datas, na ordem que vieram', async () => {
    fingirFetch(() =>
      json({
        openDays: [
          { date: '2026-08-03', availableSlotsCount: 5, firstSlot: '08:00' },
          { date: '2026-08-04', availableSlotsCount: 2, firstSlot: '13:00' },
        ],
        disabledDays: ['2026-08-02'],
      }),
    );

    const consulta = await buscarDias(BASE, 1);

    expect(consulta).toEqual({ ok: true, dados: [{ data: '2026-08-03' }, { data: '2026-08-04' }] });
  });

  it('dia sem vaga nenhuma nao e erro — e uma lista vazia', async () => {
    fingirFetch(() => json({ openDays: [], disabledDays: [] }));

    expect(await buscarDias(BASE, 1)).toEqual({ ok: true, dados: [] });
  });
});

describe('buscarHorarios', () => {
  it('manda profissional e data', async () => {
    const pedidas = fingirFetch(() => json({ availableSlots: ['08:00'] }));

    const consulta = await buscarHorarios(BASE, 2, '2026-08-04');

    expect(pedidas[0]).toContain('professionalId=2');
    expect(pedidas[0]).toContain('date=2026-08-04');
    expect(consulta).toEqual({ ok: true, dados: ['08:00'] });
  });
});

describe('quando a API nao coopera', () => {
  it('status fora do 200 vira ok:false, nunca excecao', async () => {
    for (const status of [400, 404, 429, 500, 502]) {
      fingirFetch(() => json({ error: 'nao' }, status));

      const consulta = await buscarDias(BASE, 1);

      expect(consulta.ok).toBe(false);
      expect(consulta.ok === false && consulta.motivo).toContain(String(status));
    }
  });

  it('rede fora do ar vira ok:false com o motivo pro log', async () => {
    fingirFetch(() => {
      throw new Error('ECONNREFUSED');
    });

    const consulta = await buscarDias(BASE, 1);

    expect(consulta).toEqual({ ok: false, motivo: 'ECONNREFUSED' });
  });

  it('corpo que nao e JSON nao derruba o bot', async () => {
    fingirFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 200 }));

    expect((await buscarDias(BASE, 1)).ok).toBe(false);
  });

  it('JSON valido no formato errado tambem e falha — nao vira lista vazia', async () => {
    // Isto e o que separa "nao tenho vaga" de "nao consegui perguntar". Se o formato
    // inesperado virasse `[]`, o bot diria ao cliente que o barbeiro esta lotado.
    fingirFetch(() => json({ dias: ['2026-08-04'] }));

    expect((await buscarDias(BASE, 1)).ok).toBe(false);
    fingirFetch(() => json({ availableSlots: 'nenhum' }));
    expect((await buscarHorarios(BASE, 1, '2026-08-04')).ok).toBe(false);
  });

  it('descarta entrada torta no meio de uma resposta boa', async () => {
    fingirFetch(() => json({ openDays: [{ date: '2026-08-03' }, { date: null }, {}] }));

    expect(await buscarDias(BASE, 1)).toEqual({ ok: true, dados: [{ data: '2026-08-03' }] });
  });
});
