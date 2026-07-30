import type pg from 'pg';
import type { Acao, ContextoFluxo, NomeResposta } from '../fluxo/acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { saudacaoDe } from '../fluxo/saudacao.js';
import { registrarContato } from './contatos.js';
import { lerBarbeirosAtivos } from './profissionais.js';

/**
 * O substituto dos tres usos de Redis do fluxo antigo, numa tabela so.
 *
 *  - dedupe de reentrega  -> `UNIQUE (wamid)`, garantia do banco em vez de TTL chutado
 *  - trava de rajada      -> "falei com esse contato agora ha pouco?"
 *  - estado da conversa   -> derivado: a ultima resposta que o bot deu
 *
 * O estado NAO e gravado em coluna de propósito. No fluxo antigo ele vivia em dois
 * lugares (Redis e `dados_cliente.fluxo`) com validades diferentes, e o desencontro
 * entre os dois era o que a rota de "fallback de estado" existia pra remendar. Aqui
 * ha uma fonte so: o que o bot respondeu, que ja fica registrado.
 */

// ponytail: janela fixa de 15s pra trava de rajada. Teto: cobre a rajada tipica
// ("oi" + "bom dia" + "queria cortar"). Gatilho de upgrade: reclamacao real de
// cliente que ficou sem resposta, ou necessidade de janela por tipo de resposta.
export const JANELA_RAJADA_SEGUNDOS = 15;

const FUSO = 'America/Sao_Paulo';

export type Decisao = {
  /** `false` quando o `wamid` ja estava gravado: e reentrega da Meta. */
  novo: boolean;
  /** As acoes que sobreviveram a trava de rajada. */
  enviar: Acao[];
  /** `true` quando esta foi a primeira mensagem que esse numero mandou. */
  clienteNovo: boolean;
};

/**
 * Grava o evento, cadastra o contato, monta o contexto e decide o que enviar.
 * Tudo numa transacao so, sob a mesma trava.
 *
 * O roteamento entra como funcao (`decidir`) em vez de lista pronta porque a
 * resposta depende de coisas que so se descobrem aqui dentro: se o contato acabou
 * de ser criado, e em que degrau da escada de feedback ele esta. Assim o roteador
 * continua puro — ele recebe o contexto, nao vai busca-lo.
 *
 * O `pg_advisory_xact_lock` serializa por contato: cobre o caso de a Meta entregar
 * mensagens em requisicoes HTTP paralelas, em que duas leituras simultaneas do
 * contexto veriam o mesmo degrau e responderiam duas vezes.
 */
export async function registrarEDecidir(
  pool: pg.Pool,
  evento: EventoRecebido,
  decidir: (contexto: ContextoFluxo) => Acao[],
  janelaSegundos: number = JANELA_RAJADA_SEGUNDOS,
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
      return { novo: false, enviar: [], clienteNovo: false };
    }

    // Cadastro do contato: qualquer mensagem prova que o numero existe, entao vale
    // pra texto, botao e formato nao suportado.
    const contato = await registrarContato(cliente, evento.de);

    // A saudacao sai do horario em que o CLIENTE mandou, nao de `now()`: e o relogio
    // dele que importa, e usar o timestamp do evento mantem o resultado igual se a
    // mensagem for reprocessada depois.
    // Os barbeiros sao lidos em TODO evento, inclusive nos que nunca vao usar a
    // lista. Carregar so quando "parece que vai precisar" faria o roteador depender
    // em silencio de quem o chamou: um dia uma rota nova consultaria `barbeiros` num
    // caminho onde ele veio vazio, e a barbearia inteira pareceria estar sem equipe.
    // Sao poucas linhas, na conexao ja aberta, dentro da mesma transacao.
    const acoes = decidir({
      nome: contato.nome,
      saudacao: saudacaoDe(evento.recebidoEm),
      barbeiros: await lerBarbeirosAtivos(cliente),
      ...(await lerEscada(cliente, evento.de)),
    });

    // A trava de rajada vale so pra texto: dois toques em botao seguidos sao uso
    // normal do fluxo, nao insistencia.
    const calado = evento.tipo !== 'botao' && (await falouRecentemente(cliente, evento.de, janelaSegundos));
    const enviar = calado ? [] : acoes;

    // `acao` e text[] em ordem de envio. Era text com nomes concatenados por virgula
    // enquanto o roteador devolvia no maximo uma acao por evento; a abertura picada
    // (saudacao + menu) foi o gatilho previsto pra trocar.
    await cliente.query(
      `update webhook_eventos
          set acao = $2, processado_em = now()
        where id = $1`,
      [linha.id, enviar.length > 0 ? enviar.map((acao) => acao.resposta) : null],
    );

    await cliente.query('commit');
    return { novo: true, enviar, clienteNovo: contato.novo };
  } catch (erro) {
    await cliente.query('rollback').catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

/**
 * Le o degrau da escada de feedback e o ultimo estado, direto do historico.
 *
 * Os dois recortes da consulta sao os dois resets combinados, e nenhum deles custa
 * campo de controle ou rotina de limpeza:
 *
 *  - **do dia corrente em Sao Paulo pra ca** -> na virada da meia-noite tudo zera
 *    sozinho, porque "hoje" mudou. (Tem que ser meia-noite daqui: em UTC o dia
 *    viraria as 21h, e o cliente das 22h seria tratado como se fosse amanha.)
 *  - **do ultimo toque em botao pra ca** -> tocou, zerou. O cliente que voltou pro
 *    trilho recomeca do degrau zero.
 *
 * O corte do botao e INCLUSIVO (`>=`) de proposito: a resposta dada ao toque fica
 * gravada na linha do proprio evento de botao. Com `>` ela ficaria de fora, e o bot
 * esqueceria o que acabou de dizer — mandaria o menu no lugar da dica certa. Foi
 * assim que este exato bug apareceu na verificacao contra o banco.
 */
async function lerEscada(
  cliente: pg.PoolClient,
  de: string,
): Promise<{ ultimaResposta: NomeResposta | undefined; degrau: 0 | 1 | 2 }> {
  const { rows } = await cliente.query<{ acao: string[] | null }>(
    `with inicio as (
       select date_trunc('day', now() at time zone $2) at time zone $2 as momento
     ),
     ultimo_botao as (
       select coalesce(max(e.id), 0) as id
         from webhook_eventos e, inicio
        where e.de = $1 and e.tipo = 'botao' and e.recebido_em >= inicio.momento
     )
     select e.acao
       from webhook_eventos e, inicio, ultimo_botao
      where e.de = $1
        and e.recebido_em >= inicio.momento
        and e.acao is not null
        and e.id >= ultimo_botao.id
      order by e.id desc`,
    [de, FUSO],
  );

  // O degrau olha tudo que o bot disse na janela; `ultimaResposta` olha so o evento
  // mais novo — e, dentro dele, a ULTIMA acao. Numa abertura picada
  // (`{saudacao,menu_principal}`) o que vale pra mirar a dica e o menu, nao o "Boa noite".
  const respostas = rows.flatMap((linha) => linha.acao ?? []);
  const maisRecente = rows[0]?.acao ?? [];
  const degrau = respostas.includes('menu_reforcado') ? 2 : respostas.includes('feedback') ? 1 : 0;

  return {
    ultimaResposta: maisRecente[maisRecente.length - 1] as NomeResposta | undefined,
    degrau,
  };
}

/** "Acabei de falar com esse contato?" — a trava de rajada. */
async function falouRecentemente(
  cliente: pg.PoolClient,
  de: string,
  janelaSegundos: number,
): Promise<boolean> {
  const encontrado = await cliente.query(
    `select 1
       from webhook_eventos
      where de = $1
        and acao is not null
        and recebido_em > now() - make_interval(secs => $2::int)
      limit 1`,
    [de, janelaSegundos],
  );

  return (encontrado.rowCount ?? 0) > 0;
}
