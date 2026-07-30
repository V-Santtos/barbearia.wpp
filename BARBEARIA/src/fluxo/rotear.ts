import type { EventoRecebido } from '../whatsapp/eventos.js';
import type { Acao, Botao } from './acoes.js';
import { lerId, montarId, VERSAO_ID } from './botoes.js';

/**
 * O roteador. Funcao PURA: recebe o evento, devolve o que fazer, nao faz nada.
 *
 * Duas regras que valem pra sempre aqui:
 *
 *  - E TOTAL. Toda entrada tem saida definida — botao desconhecido, formato que
 *    a gente nao entende, texto solto, id de uma versao antiga. Silencio nunca e
 *    comportamento; no fluxo antigo o clique nao tratado caia num `No Operation`
 *    e o cliente ficava olhando pra tela.
 *  - Roteia pelo ID do botao, jamais pelo titulo. O fluxo antigo comparava
 *    `button_title === '✅ Confirmar'`: trocar o emoji quebrava o bot em silencio.
 */
export function rotear(evento: EventoRecebido): Acao[] {
  if (evento.tipo === 'texto') {
    return [menu(evento.de, SAUDACAO)];
  }

  if (evento.tipo === 'nao_suportado') {
    return [menu(evento.de, 'Por aqui eu entendo mensagem de texto e os botões abaixo. 🙂')];
  }

  const id = lerId(evento.botaoId);

  // Fora do formato: id do fluxo n8n antigo, ou lixo. Nao herdamos nenhum.
  if (!id) return [menu(evento.de, SAUDACAO)];

  // Botao de uma versao anterior do contrato. Como o cliente pode clicar num
  // botao de semanas atras, isso vai acontecer de verdade um dia.
  if (id.versao !== VERSAO_ID) {
    return [menu(evento.de, 'Esse botão é de uma conversa antiga. Aqui está o menu de agora:')];
  }

  switch (id.acao) {
    case 'agendar':
      return [
        {
          tipo: 'enviar_texto',
          para: evento.de,
          resposta: 'agendar_inicio',
          texto: 'Boa! Vamos marcar seu horário. 💈\n\nEssa parte ainda está sendo montada — já já eu volto com os barbeiros e os horários.',
        },
      ];

    case 'reagendar':
    case 'cancelar':
      return [
        {
          tipo: 'enviar_texto',
          para: evento.de,
          resposta: 'rota_em_construcao',
          texto: 'Ainda estou aprendendo a fazer isso por aqui. Por enquanto consigo te ajudar a *agendar* um horário. 🙂',
        },
      ];

    default:
      return [menu(evento.de, 'Não reconheci essa opção. Aqui está o menu:')];
  }
}

const SAUDACAO = 'Olá! 👋 Sou o atendimento da *Barbearia*.\n\nComo posso te ajudar?';

/**
 * Todos os caminhos de fallback usam `menu_principal` como nome de resposta de
 * proposito: assim a trava anti-repeticao trata os quatro como a mesma coisa e o
 * cliente nao recebe dois menus seguidos com textos diferentes.
 */
function menu(para: string, texto: string): Acao {
  return { tipo: 'enviar_botoes', para, resposta: 'menu_principal', texto, botoes: BOTOES_MENU };
}

const BOTOES_MENU: Botao[] = [
  { id: montarId('agendar'), titulo: 'Agendar' },
  { id: montarId('reagendar'), titulo: 'Reagendar' },
  { id: montarId('cancelar'), titulo: 'Cancelar' },
];
