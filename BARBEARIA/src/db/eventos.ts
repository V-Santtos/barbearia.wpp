import type pg from 'pg';
import type { Acao, Agenda, Barbeiro, ContextoFluxo, NomeResposta, Reserva } from '../fluxo/acoes.js';
import type { EventoRecebido } from '../whatsapp/eventos.js';
import { hojeEmSaoPaulo } from '../fluxo/dias.js';
import { lerId } from '../fluxo/botoes.js';
import { juntarNome, lerNome, palavrasReais } from '../fluxo/nome.js';
import { ESTADOS_DO_NOME } from '../fluxo/rotear.js';
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

/** O que a agenda precisa responder neste evento — `undefined` quando nao precisa. */
export type AlvoAgenda =
  | { tipo: 'dias'; barbeiro: number }
  | { tipo: 'horarios'; barbeiro: number; data: string }
  /**
   * Marcar de verdade. Escrita, e nao consulta — o unico alvo com efeito.
   *
   * Ele existe aqui, e nao no roteador, pelo mesmo motivo dos outros: `rotear()` e
   * puro e sincrono. A escrita acontece antes, e o roteador so ve o resultado
   * (`marcado` / `ocupado` / `fora_do_ar`) e escolhe a frase.
   */
  | { tipo: 'marcar'; barbeiro: Barbeiro; data: string; hora: string; cliente: string; telefone: string };

export type BuscarAgenda = (alvo: AlvoAgenda) => Promise<Agenda>;

/**
 * Que pergunta este evento faz a agenda. Funcao pura: le o id do botao com o mesmo
 * `lerId` do roteador — nada de parser paralelo, que e como duas leituras do mesmo
 * formato comecam a divergir.
 *
 * Ela existe porque o roteador e sincrono e puro: alguem precisa descobrir o que
 * buscar ANTES dele. O caso que obriga esta funcao a conhecer os barbeiros e o do
 * profissional unico — ali o id e so `1.agendar`, sem dizer com quem, e o roteador
 * pula a pergunta "com quem?" sozinho. Sem a lista em mãos aqui, esse caminho
 * chegaria ao passo dos dias sem dias.
 */
export function alvoDaAgenda(
  evento: EventoRecebido,
  contexto: Omit<ContextoFluxo, 'agenda'>,
): AlvoAgenda | undefined {
  const { barbeiros } = contexto;

  // Texto so pede alguma coisa a agenda num caso: o sobrenome chegando depois do
  // cartao, que fecha o agendamento sem toque. A regra de acrescimo-x-correcao e a
  // mesma do roteador (`juntarNome`), porque ler de um jeito aqui e de outro la faria
  // o bot marcar um horario e anunciar outro.
  if (evento.tipo === 'texto') {
    if (!naEtapaDoNome(contexto.ultimaResposta) || !contexto.reserva) return undefined;

    const leitura = lerNome(evento.texto);
    if (leitura.tipo !== 'nome') return undefined;

    const juncao = juntarNome(contexto.nomePendente, leitura.nome);
    if (juncao.tipo !== 'acrescimo' || palavrasReais(juncao.nome) <= 1) return undefined;

    return marcar(contexto.reserva, juncao.nome, evento.de);
  }

  if (evento.tipo !== 'botao') return undefined;

  const id = lerId(evento.botaoId);
  if (!id) return undefined;

  // Confirmar so marca com o que ja esta no contexto — reserva e nome vindos do
  // historico. Sem um dos dois, nao ha o que gravar e o roteador repergunta.
  if (id.acao === 'confirmar') {
    return contexto.reserva && contexto.nomePendente
      ? marcar(contexto.reserva, contexto.nomePendente, evento.de)
      : undefined;
  }

  // Como no roteador, o `b` do id nao vale nada ate bater com a lista de ativos.
  const doId = (): Barbeiro | undefined => {
    const b = id.params.get('b');
    return barbeiros.find((barbeiro) => String(barbeiro.id) === b);
  };

  if (id.acao === 'agendar') {
    const [unico, ...resto] = barbeiros;
    return unico && resto.length === 0 ? { tipo: 'dias', barbeiro: unico.id } : undefined;
  }

  if (id.acao === 'barbeiro') {
    const barbeiro = doId();
    return barbeiro ? { tipo: 'dias', barbeiro: barbeiro.id } : undefined;
  }

  if (id.acao === 'dia') {
    const barbeiro = doId();
    const data = id.params.get('d');
    return barbeiro && data ? { tipo: 'horarios', barbeiro: barbeiro.id, data } : undefined;
  }

  // `hora` nao consulta nada: o passo seguinte e a pergunta do nome.
  return undefined;
}

function marcar(reserva: Reserva, cliente: string, telefone: string): AlvoAgenda {
  return {
    tipo: 'marcar',
    barbeiro: reserva.barbeiro,
    data: reserva.data,
    hora: reserva.hora,
    cliente,
    telefone,
  };
}

/**
 * Os estados em que o bot espera um nome. Duplicado do roteador de proposito? Nao —
 * e o mesmo predicado, exportado dali, porque se as duas listas divergirem o bot
 * trata o texto por um caminho e cala pelo outro.
 */
function naEtapaDoNome(ultima: NomeResposta | undefined): boolean {
  return ESTADOS_DO_NOME.has(ultima as NomeResposta);
}

export type Decisao = {
  /** `false` quando o `wamid` ja estava gravado: e reentrega da Meta. */
  novo: boolean;
  /** As acoes que sobreviveram a trava de rajada. */
  enviar: Acao[];
  /** `true` quando esta foi a primeira mensagem que esse numero mandou. */
  clienteNovo: boolean;
  /**
   * O nome do cadastro, quando existe. Sai daqui porque o espelho do CRM precisa
   * dele e ele so e conhecido dentro desta transacao.
   */
  nome: string | undefined;
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
  buscarAgenda: BuscarAgenda,
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
      return { novo: false, enviar: [], clienteNovo: false, nome: undefined };
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
    const barbeiros = await lerBarbeirosAtivos(cliente);

    // ponytail: a consulta HTTP a API do calendario acontece DENTRO da transacao,
    // segurando a conexao e a trava por contato enquanto a rede responde. Teto: a API
    // esta em localhost, onde isso e questao de milissegundos, e a trava e por
    // contato — nao bloqueia outros clientes. Gatilho de upgrade: a API sair de
    // localhost, ou conexao de pool virar recurso disputado. O conserto e mover a
    // busca pra fora da transacao, e o custo dele e reencontrar o barbeiro do caso
    // "profissional unico" sem a leitura do banco em mãos.
    // Tudo que sai do historico e lido ANTES de decidir o que perguntar a API: o alvo
    // da agenda depende do estado (marcar so acontece se ja houver reserva e nome).
    const base = {
      nome: contato.nome,
      saudacao: saudacaoDe(evento.recebidoEm),
      hoje: hojeEmSaoPaulo(evento.recebidoEm),
      barbeiros,
      donoAtendendo: await donoAtendendo(cliente, evento.de),
      ...(await lerEtapaDoNome(cliente, evento.de, barbeiros)),
      ...(await lerEscada(cliente, evento.de)),
    };

    const alvo = alvoDaAgenda(evento, base);

    const acoes = decidir({ ...base, agenda: alvo ? await buscarAgenda(alvo) : undefined });

    // A trava de rajada vale so pra texto: dois toques em botao seguidos sao uso
    // normal do fluxo, nao insistencia.
    //
    // **A etapa do nome e excecao.** A trava adivinha se o cliente terminou de falar;
    // ali ele esta respondendo uma pergunta especifica, e calar significaria o cartao
    // nunca chegar — o cliente que manda o nome logo depois do botao ficaria olhando
    // pra tela parada, sem nada que o acordasse depois.
    const calado =
      evento.tipo !== 'botao' &&
      !naEtapaDoNome(base.ultimaResposta) &&
      (await falouRecentemente(cliente, evento.de, janelaSegundos));
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
    return { novo: true, enviar, clienteNovo: contato.novo, nome: contato.nome };
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

/**
 * O nome que o cliente vem montando e a reserva que ele ja fechou por botao.
 *
 * As duas saem do MESMO recorte do resto do estado — hoje em Sao Paulo, e o corte no
 * ultimo botao —, e e esse corte que faz `Corrigir nome` funcionar sem apagar nada:
 * ele e um botao, entao as tentativas anteriores ficam do lado de fora sozinhas.
 *
 * As pecas do nome sao juntadas na ordem em que chegaram, com as mesmas regras que o
 * roteador usa (`juntarNome`), pra que "Victor" + "Santos" vire `Victor Santos` e
 * "Vicctor" + "Victor" vire `Victor` — nunca `Vicctor Victor`.
 */
async function lerEtapaDoNome(
  cliente: pg.PoolClient,
  de: string,
  barbeiros: Barbeiro[],
): Promise<{ nomePendente: string | undefined; reserva: Reserva | undefined }> {
  const { rows } = await cliente.query<{ tipo: string; payload: unknown }>(
    `with inicio as (
       select date_trunc('day', now() at time zone $2) at time zone $2 as momento
     ),
     ultimo_botao as (
       select coalesce(max(e.id), 0) as id
         from webhook_eventos e, inicio
        where e.de = $1 and e.tipo = 'botao' and e.recebido_em >= inicio.momento
     )
     select e.tipo, e.payload
       from webhook_eventos e, inicio, ultimo_botao
      where e.de = $1
        and e.recebido_em >= inicio.momento
        and e.id >= ultimo_botao.id
      order by e.id`,
    [de, FUSO],
  );

  let nomePendente: string | undefined;
  let reserva: Reserva | undefined;

  for (const linha of rows) {
    if (linha.tipo === 'botao') {
      reserva = lerReserva(linha.payload, barbeiros) ?? reserva;
      continue;
    }

    const texto = textoDoPayload(linha.payload);
    if (!texto) continue;

    const leitura = lerNome(texto);
    if (leitura.tipo !== 'nome') continue;

    nomePendente = juntarNome(nomePendente, leitura.nome).nome;
  }

  return { nomePendente, reserva };
}

/**
 * A reserva escondida no id de um toque em `hora`.
 *
 * Le com o mesmo `lerId` do roteador — nunca um parser paralelo, que e como duas
 * leituras do mesmo formato comecam a divergir. E o `b` continua nao valendo nada por
 * si: so vira barbeiro depois de bater com a lista de ativos.
 */
function lerReserva(payload: unknown, barbeiros: Barbeiro[]): Reserva | undefined {
  const id = lerId(botaoDoPayload(payload) ?? '');
  if (!id || id.acao !== 'hora') return undefined;

  const barbeiro = barbeiros.find((candidato) => String(candidato.id) === id.params.get('b'));
  const data = id.params.get('d');
  const hora = id.params.get('h');

  return barbeiro && data && hora ? { barbeiro, data, hora } : undefined;
}

/** O texto e o id do botao dentro do envelope cru que a Meta mandou. */
function textoDoPayload(payload: unknown): string | undefined {
  const corpo = (payload as { text?: { body?: unknown } } | undefined)?.text?.body;
  return typeof corpo === 'string' ? corpo : undefined;
}

function botaoDoPayload(payload: unknown): string | undefined {
  const interativo = (payload as { interactive?: Record<string, { id?: unknown }> } | undefined)
    ?.interactive;
  const id = interativo?.button_reply?.id ?? interativo?.list_reply?.id;

  return typeof id === 'string' ? id : undefined;
}

/**
 * "O dono esta atendendo esta conversa a mao agora?"
 *
 * A resposta e DERIVADA do historico, e nao lida de uma coluna de status — mesma
 * escolha de `lerEscada`, e aqui ela e o que resolve o pior cenario:
 *
 *   cliente fala as 14h -> dono responde as 14h05 -> cliente some
 *   -> cliente volta as 10h do dia seguinte
 *
 * A janela de 24h da Meta ainda esta aberta nesse momento (vence as 14h). Com um
 * `status = 'human'` gravado, o bot continuaria mudo e o cliente falaria sozinho.
 * Com o corte de dia, a meia-noite ja devolveu o atendimento — e como `lerEscada`
 * tambem zera ali, o que ele recebe e a saudacao com o menu, do comeco.
 *
 * O corte do botao usa `>` e nao `>=`, ao contrario de `lerEscada`: la a resposta
 * do bot fica gravada na propria linha do evento de botao e precisa entrar; aqui a
 * pergunta e "o dono falou DEPOIS do toque", e o que aconteceu no mesmo instante do
 * toque nao conta.
 *
 * As tabelas sao do CRM do calendario, e le-las daqui e deliberado: e o mesmo banco,
 * e dado e nao regra, e uma chamada HTTP neste ponto cairia dentro da transacao.
 */
async function donoAtendendo(cliente: pg.PoolClient, de: string): Promise<boolean> {
  const { rows } = await cliente.query<{ atendendo: boolean }>(
    `with inicio as (
       select date_trunc('day', now() at time zone $2) at time zone $2 as momento
     ),
     ultimo_botao as (
       select max(e.recebido_em) as em
         from webhook_eventos e, inicio
        where e.de = $1 and e.tipo = 'botao' and e.recebido_em >= inicio.momento
     )
     select exists (
       select 1
         from whatsapp_messages m
         join whatsapp_contacts c on c.id = m.contact_id, inicio, ultimo_botao
        where c.phone = $1
          and m.sender_type = 'human'
          and m.created_at >= inicio.momento
          and (ultimo_botao.em is null or m.created_at > ultimo_botao.em)
     ) as atendendo`,
    [de, FUSO],
  );

  return rows[0]?.atendendo ?? false;
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
