import type pg from 'pg';
import type { Acao } from '../fluxo/acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';

/**
 * O substituto dos tres usos de Redis do fluxo antigo, numa tabela so.
 *
 *  - dedupe de reentrega  -> `UNIQUE (wamid)`, garantia do banco em vez de TTL chutado
 *  - anti-repeticao       -> "ja respondi isso pra esse contato agora ha pouco?"
 *  - replay pra depurar   -> o payload cru fica gravado
 */

// ponytail: janela fixa de 15s pra anti-repeticao. Teto: cobre a rajada tipica
// ("oi" + "bom dia" + "queria cortar"). Gatilho de upgrade: reclamacao real de
// cliente que ficou sem resposta, ou necessidade de janela por tipo de resposta.
export const JANELA_ANTI_REPETICAO_SEGUNDOS = 15;

export type Decisao = {
  /** `false` quando o `wamid` ja estava gravado: e reentrega da Meta. */
  novo: boolean;
  /** As acoes que sobreviveram a trava anti-repeticao. */
  enviar: Acao[];
};

/**
 * Grava o evento e decide o que ainda deve ser enviado. Tudo numa transacao so.
 *
 * A trava de rajada e na SAIDA, nao na entrada: as tres mensagens da rajada sao
 * processadas e gravadas (nenhuma e descartada, ao contrario do `INCR` do fluxo
 * antigo, que jogava fora justamente a terceira — a que costuma trazer a
 * informacao boa), mas o menu so sai uma vez.
 *
 * O `pg_advisory_xact_lock` serializa por contato: cobre o caso de a Meta
 * entregar a rajada em requisicoes HTTP paralelas, em que duas checagens
 * simultaneas passariam as duas.
 */
export async function registrarEDecidir(
  pool: pg.Pool,
  evento: EventoRecebido,
  acoes: Acao[],
  janelaSegundos: number = JANELA_ANTI_REPETICAO_SEGUNDOS,
): Promise<Decisao> {
  const cliente = await pool.connect();

  try {
    await cliente.query('begin');
    await cliente.query('select pg_advisory_xact_lock(hashtext($1))', [evento.de]);

    const inserido = await cliente.query<{ id: string }>(
      `insert into webhook_eventos (wamid, numero_barbearia, de, tipo, payload)
       values ($1, $2, $3, $4, $5)
       on conflict (wamid) where wamid is not null do nothing
       returning id`,
      [
        evento.wamid,
        evento.numeroBarbearia,
        evento.de,
        evento.tipo,
        JSON.stringify(evento.cru ?? {}),
      ],
    );

    const linha = inserido.rows[0];
    if (!linha) {
      await cliente.query('commit');
      return { novo: false, enviar: [] };
    }

    const enviar: Acao[] = [];
    for (const acao of acoes) {
      if (!(await respondeuRecentemente(cliente, evento.de, acao.resposta, janelaSegundos))) {
        enviar.push(acao);
      }
    }

    // ponytail: `acao` guarda os nomes separados por virgula e a checagem compara
    // por igualdade. Teto: hoje o roteador devolve exatamente uma acao por evento.
    // Gatilho de upgrade: no dia em que uma rota devolver duas, trocar a coluna
    // por text[] e a comparacao por `= any(acao)`.
    await cliente.query(
      `update webhook_eventos
          set acao = $2, processado_em = now()
        where id = $1`,
      [linha.id, enviar.map((acao) => acao.resposta).join(',') || null],
    );

    await cliente.query('commit');
    return { novo: true, enviar };
  } catch (erro) {
    await cliente.query('rollback').catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

async function respondeuRecentemente(
  cliente: pg.PoolClient,
  de: string,
  resposta: string,
  janelaSegundos: number,
): Promise<boolean> {
  const encontrado = await cliente.query(
    `select 1
       from webhook_eventos
      where de = $1
        and acao = $2
        and recebido_em > now() - make_interval(secs => $3::int)
      limit 1`,
    [de, resposta, janelaSegundos],
  );

  return (encontrado.rowCount ?? 0) > 0;
}
