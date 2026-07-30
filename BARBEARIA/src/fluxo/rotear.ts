import type { EventoRecebido } from '../whatsapp/eventos.js';
import type { Acao, ContextoFluxo, NomeResposta, Opcao } from './acoes.js';
import { lerId, montarId, VERSAO_ID } from './botoes.js';

/**
 * O roteador. Funcao PURA: recebe o evento e o contexto, devolve o que fazer,
 * nao faz nada.
 *
 * Tres regras que valem pra sempre aqui:
 *
 *  - Roteia pelo ID da opcao, jamais pelo titulo. O fluxo antigo comparava
 *    `button_title === '✅ Confirmar'`: trocar o emoji quebrava o bot em silencio.
 *  - A lista SEMPRE funciona. Nunca e suprimida, nunca e travada — e a saida que a
 *    escada de feedback promete ao cliente.
 *  - Silencio so acontece num lugar: no fim da escada, quando a tela do cliente
 *    ja tem toda a informacao e repetir vira ruido.
 */
export function rotear(evento: EventoRecebido, contexto: ContextoFluxo): Acao[] {
  if (evento.tipo === 'botao') return rotearBotao(evento.botaoId, evento.de, contexto);

  // Texto e formatos sem suporte entram na escada: os dois sao "o cliente falou
  // fora do trilho do menu".
  return escadaDeFeedback(evento, contexto);
}

/**
 * A escada. Cada degrau responde uma coisa diferente, e a subida so acontece por
 * insistencia real — mensagem suprimida pela trava de rajada nao conta, porque
 * quem escreve em mensagens picadas nao esta insistindo, esta digitando.
 *
 *   sem resposta hoje  -> abertura (saudacao + menu)
 *   degrau 0           -> dica curta, mirada no que o bot pediu por ultimo
 *   degrau 1           -> reenvia o menu e trava as respostas a texto
 *   degrau 2           -> silencio (a tela dele ja diz tudo)
 *
 * Tudo volta ao normal na virada do dia ou no primeiro toque no menu.
 */
function escadaDeFeedback(
  evento: Extract<EventoRecebido, { tipo: 'texto' | 'nao_suportado' }>,
  contexto: ContextoFluxo,
): Acao[] {
  if (contexto.degrau >= 2) return [];

  if (!contexto.ultimaResposta) return abertura(evento.de, contexto, evento.tipo);

  if (contexto.degrau === 0) {
    return [
      {
        tipo: 'enviar_texto',
        para: evento.de,
        resposta: 'feedback',
        texto: AJUDA[contexto.ultimaResposta],
      },
    ];
  }

  return [menu(evento.de, 'Escolha uma opção pra gente continuar. 👇', 'menu_reforcado')];
}

/**
 * A abertura do dia, em DUAS mensagens.
 *
 * Picar e deliberado: a saudacao chega como mensagem de texto normal, no ritmo de
 * quem responde no WhatsApp, e o menu vem logo atras com a cara de vitrine (header,
 * footer e "Ver opcoes"). Numa mensagem so, o "Boa noite" viraria titulo de cartao.
 *
 * Custa uma chamada HTTP a mais por abertura. Foi decisao do dono do produto.
 */
function abertura(
  para: string,
  contexto: ContextoFluxo,
  tipo: 'texto' | 'nao_suportado' = 'texto',
): Acao[] {
  return [
    {
      tipo: 'enviar_texto',
      para,
      resposta: 'saudacao',
      texto: contexto.nome
        ? `${contexto.saudacao}, ${contexto.nome}. 👋`
        : `${contexto.saudacao}! 👋`,
    },
    menu(
      para,
      tipo === 'nao_suportado'
        ? 'Por aqui eu entendo mensagem de texto e as opções abaixo. 🙂'
        : 'Como podemos te ajudar hoje?',
      'menu_principal',
      // A unica diferenca entre quem ja fechou um agendamento e o resto e esta
      // linha. No fluxo n8n isso eram dois ramos inteiros duplicados ("Lead novo" /
      // "Lead frequente"), com ~7 nos cada — e duplicacao desse tipo foi o que
      // produziu o unico bug que a leitura do fluxo antigo encontrou sozinha.
      contexto.nome ? 'Bom de ver novamente!' : 'Bem-vindo à Barbearia.',
    ),
  ];
}

/**
 * A dica que o cliente recebe quando digita em vez de tocar, mirada no que o bot
 * pediu por ultimo.
 *
 * O `Record<NomeResposta, string>` e o que torna isto a prova de esquecimento:
 * ao criar um estado novo (`escolher_dia`, `escolher_horario`, `confirmar`), o
 * TypeScript exige a frase correspondente aqui. Nao compila sem ela — e por isso
 * nenhum estado futuro pode virar silencio por descuido.
 */
const AJUDA: Record<NomeResposta, string> = {
  saudacao: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  menu_principal: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  escolher_barbeiro: 'Pra continuar, toque em *Ver barbeiros* na mensagem acima e escolha um. 👆',
  agendar_inicio: 'Pra seguir com o agendamento, toque em *Ver opções* na mensagem acima. 👆',
  agenda_indisponivel: 'A agenda está fechada agora — assim que abrir, é só me chamar. 🙂',
  rota_em_construcao: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  feedback: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  menu_reforcado: 'É só tocar em *Ver opções* na mensagem acima. 👆',
};

function rotearBotao(botaoId: string, para: string, contexto: ContextoFluxo): Acao[] {
  const id = lerId(botaoId);

  // Fora do formato: id do fluxo n8n antigo, ou lixo. Nao herdamos nenhum.
  if (!id) return abertura(para, contexto);

  // Opcao de uma versao anterior do contrato. Como o cliente pode tocar num item de
  // semanas atras, isso vai acontecer de verdade um dia.
  if (id.versao !== VERSAO_ID) {
    return [menu(para, 'Essa opção é de uma conversa antiga. Aqui está o menu de agora:', 'menu_principal')];
  }

  switch (id.acao) {
    case 'agendar':
      return comecarAgendamento(para, contexto);

    case 'barbeiro':
      return escolherBarbeiro(para, contexto, id.params.get('b'));

    case 'reagendar':
    case 'cancelar':
      return [
        {
          tipo: 'enviar_texto',
          para,
          resposta: 'rota_em_construcao',
          texto: 'Ainda estou aprendendo a fazer isso por aqui. Por enquanto consigo te ajudar a *agendar* um horário. 🙂',
        },
      ];

    default:
      return [menu(para, 'Não reconheci essa opção. Aqui está o menu:', 'menu_principal')];
  }
}

/**
 * Tocou em "Agendar". O primeiro passo do agendamento e escolher o barbeiro — e
 * a pergunta so existe quando ha escolha de verdade.
 *
 * O fluxo antigo perguntava antes disso por qual MEIO o cliente queria agendar
 * (WhatsApp ou site). Essa pergunta nao existe aqui: quem esta no WhatsApp ja
 * respondeu, tocando em Agendar.
 */
function comecarAgendamento(para: string, contexto: ContextoFluxo): Acao[] {
  const [unico, ...resto] = contexto.barbeiros;

  if (!unico) return [semAgenda(para)];

  // Um barbeiro so: perguntar "com quem?" seria pedir pro cliente confirmar o
  // obvio. A escolha acontece, ele so nao ve a pergunta.
  if (resto.length === 0) return [comBarbeiro(para, unico)];

  return [perguntarBarbeiro(para, contexto, PERGUNTA_BARBEIRO, 'Show!')];
}

const PERGUNTA_BARBEIRO = 'Com qual profissional você deseja agendar seu horário?';

/**
 * Voltou a escolha do barbeiro. O `b` vem do id da opcao e **nao vale nada por si**:
 * so vira barbeiro depois de bater com a lista de ativos.
 *
 * Isso nao e paranoia — o cliente pode tocar num item de ontem, e o barbeiro pode
 * ter sido desativado no meio. Nesse caso a pergunta volta com quem sobrou, em vez
 * de escolher alguem por ele.
 */
function escolherBarbeiro(para: string, contexto: ContextoFluxo, b: string | null): Acao[] {
  const escolhido = contexto.barbeiros.find((barbeiro) => String(barbeiro.id) === b);

  if (escolhido) return [comBarbeiro(para, escolhido)];
  if (contexto.barbeiros.length === 0) return [semAgenda(para)];

  // Sem cabecalho aqui: "Show!" comemora, e isto e uma correcao de rota.
  return [perguntarBarbeiro(para, contexto, `Não encontrei esse barbeiro. ${PERGUNTA_BARBEIRO}`)];
}

function perguntarBarbeiro(
  para: string,
  contexto: ContextoFluxo,
  texto: string,
  cabecalho?: string,
): Acao {
  return {
    tipo: 'enviar_lista',
    para,
    resposta: 'escolher_barbeiro',
    texto,
    cabecalho,
    // O rodape aqui nao e o institucional do menu: neste passo o cliente precisa de
    // instrucao, nao de assinatura.
    rodape: 'Selecione uma opção',
    abrir: 'Ver barbeiros',
    secao: 'Barbeiros',
    opcoes: contexto.barbeiros.map((barbeiro) => ({
      id: montarId('barbeiro', { b: String(barbeiro.id) }),
      // Nome de barbeiro e dado da barbearia: pode chegar maior que o teto da Meta,
      // e titulo estourado faz a Meta recusar a mensagem inteira.
      titulo: cortar(barbeiro.nome, LIMITE_TITULO),
    })),
  };
}

/** ponytail: o passo seguinte (dia e horario) ainda nao existe. Teto: o cliente
 * escolhe o barbeiro e para aqui. Gatilho de upgrade: a proxima fatia do fluxo. */
function comBarbeiro(para: string, barbeiro: { nome: string }): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'agendar_inicio',
    texto: `Boa! Vamos marcar com o *${barbeiro.nome}*. 💈\n\nEssa parte ainda está sendo montada — já já eu volto com os dias e horários.`,
  };
}

function semAgenda(para: string): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'agenda_indisponivel',
    texto: 'A agenda está fechada por aqui no momento. 😕\n\nAssim que abrir, é só me chamar de novo.',
  };
}

function cortar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1).trimEnd()}…`;
}

/** Teto da Meta no titulo de linha da lista. */
const LIMITE_TITULO = 24;

function menu(para: string, texto: string, resposta: NomeResposta, cabecalho?: string): Acao {
  return {
    tipo: 'enviar_lista',
    para,
    resposta,
    texto,
    cabecalho,
    rodape: RODAPE,
    abrir: ABRIR,
    secao: SECAO,
    opcoes: OPCOES_MENU,
  };
}

const RODAPE = '⚡ Atendimento rápido e humanizado';
const ABRIR = 'Ver opções';
const SECAO = 'Menu principal';

const OPCOES_MENU: Opcao[] = [
  { id: montarId('agendar'), titulo: '🗓️ Agendar horário' },
  { id: montarId('reagendar'), titulo: '🔄 Reagendar horário' },
  { id: montarId('cancelar'), titulo: '❌ Cancelar horário' },
];
