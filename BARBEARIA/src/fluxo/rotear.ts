import type { EventoRecebido } from '../whatsapp/eventos.js';
import type { Acao, Botao, ContextoFluxo, NomeResposta } from './acoes.js';
import { lerId, montarId, VERSAO_ID } from './botoes.js';

/**
 * O roteador. Funcao PURA: recebe o evento e o contexto, devolve o que fazer,
 * nao faz nada.
 *
 * Tres regras que valem pra sempre aqui:
 *
 *  - Roteia pelo ID do botao, jamais pelo titulo. O fluxo antigo comparava
 *    `button_title === '✅ Confirmar'`: trocar o emoji quebrava o bot em silencio.
 *  - Botao SEMPRE funciona. Nunca e suprimido, nunca e travado — e a saida que a
 *    escada de feedback promete ao cliente.
 *  - Silencio so acontece num lugar: no fim da escada, quando a tela do cliente
 *    ja tem toda a informacao e repetir vira ruido.
 */
export function rotear(evento: EventoRecebido, contexto: ContextoFluxo): Acao[] {
  if (evento.tipo === 'botao') return rotearBotao(evento.botaoId, evento.de, contexto);

  // Texto e formatos sem suporte entram na escada: os dois sao "o cliente falou
  // fora do trilho de botoes".
  return escadaDeFeedback(evento, contexto);
}

/**
 * A escada. Cada degrau responde uma coisa diferente, e a subida so acontece por
 * insistencia real — mensagem suprimida pela trava de rajada nao conta, porque
 * quem escreve em mensagens picadas nao esta insistindo, esta digitando.
 *
 *   sem resposta hoje  -> menu completo (com a saudacao de novo/conhecido)
 *   degrau 0           -> dica curta, mirada no que o bot pediu por ultimo
 *   degrau 1           -> reenvia o menu e trava as respostas a texto
 *   degrau 2           -> silencio (a tela dele ja diz tudo)
 *
 * Tudo volta ao normal na virada do dia ou no primeiro toque em botao.
 */
function escadaDeFeedback(
  evento: Extract<EventoRecebido, { tipo: 'texto' | 'nao_suportado' }>,
  contexto: ContextoFluxo,
): Acao[] {
  if (contexto.degrau >= 2) return [];

  if (!contexto.ultimaResposta) {
    const abertura =
      evento.tipo === 'nao_suportado'
        ? 'Por aqui eu entendo mensagem de texto e os botões abaixo. 🙂'
        : saudacao(contexto);
    return [menu(evento.de, abertura, 'menu_principal')];
  }

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

  return [
    menu(
      evento.de,
      'Pra continuar, é só tocar num dos botões. 👇\n\nSe preferir recomeçar, escolha uma opção aqui:',
      'menu_reforcado',
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
  menu_principal: 'É só tocar num dos botões que apareceram acima. 👆',
  agendar_inicio: 'Pra seguir com o agendamento, toque num dos botões acima. 👆',
  rota_em_construcao: 'É só tocar num dos botões que apareceram acima. 👆',
  feedback: 'É só tocar num dos botões que apareceram acima. 👆',
  menu_reforcado: 'É só tocar num dos botões que apareceram acima. 👆',
};

function rotearBotao(botaoId: string, para: string, contexto: ContextoFluxo): Acao[] {
  const id = lerId(botaoId);

  // Fora do formato: id do fluxo n8n antigo, ou lixo. Nao herdamos nenhum.
  if (!id) return [menu(para, saudacao(contexto), 'menu_principal')];

  // Botao de uma versao anterior do contrato. Como o cliente pode clicar num
  // botao de semanas atras, isso vai acontecer de verdade um dia.
  if (id.versao !== VERSAO_ID) {
    return [
      menu(para, 'Esse botão é de uma conversa antiga. Aqui está o menu de agora:', 'menu_principal'),
    ];
  }

  switch (id.acao) {
    case 'agendar':
      return [
        {
          tipo: 'enviar_texto',
          para,
          resposta: 'agendar_inicio',
          texto: 'Boa! Vamos marcar seu horário. 💈\n\nEssa parte ainda está sendo montada — já já eu volto com os barbeiros e os horários.',
        },
      ];

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
 * A unica diferenca entre cliente novo e conhecido e a frase. No fluxo n8n isso
 * eram dois ramos inteiros duplicados ("Lead novo" / "Lead frequente"), com ~7 nos
 * cada — e duplicacao desse tipo foi o que produziu o unico bug que a leitura do
 * fluxo antigo encontrou sozinha.
 */
function saudacao(contexto: ContextoFluxo): string {
  return contexto.clienteNovo
    ? 'Olá! 👋 Sou o atendimento da *Barbearia*.\n\nComo posso te ajudar?'
    : 'Que bom te ver de novo por aqui! 👋\n\nComo posso te ajudar hoje?';
}

function menu(para: string, texto: string, resposta: NomeResposta): Acao {
  return { tipo: 'enviar_botoes', para, resposta, texto, botoes: BOTOES_MENU };
}

const BOTOES_MENU: Botao[] = [
  { id: montarId('agendar'), titulo: 'Agendar' },
  { id: montarId('reagendar'), titulo: 'Reagendar' },
  { id: montarId('cancelar'), titulo: 'Cancelar' },
];
