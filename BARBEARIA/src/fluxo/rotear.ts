import type { EventoRecebido } from '../whatsapp/eventos.js';
import type { Acao, Barbeiro, ContextoFluxo, NomeResposta, Opcao } from './acoes.js';
import { lerId, montarId, VERSAO_ID } from './botoes.js';
import { rotularDia } from './dias.js';
import { juntarNome, lerNome, palavrasReais, primeiroNome, type MotivoInvalido } from './nome.js';

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
  // O toque em botao vem ANTES da checagem do dono, e nao e detalhe: e ele que
  // devolve a conversa ao atendimento automatico. O cliente que toca no menu esta
  // pedindo o bot com todas as letras, mesmo no meio de uma conversa com o dono.
  if (evento.tipo === 'botao') return rotearBotao(evento.botaoId, evento.de, contexto);

  // Dono atendendo: o bot nao fala por cima. A escada existe pra quem digitou sem
  // ninguem do outro lado — com o dono ali, ela viraria uma segunda voz mandando o
  // cliente "tocar em Ver opcoes" enquanto ele conversa com uma pessoa de verdade.
  if (contexto.donoAtendendo) return [];

  // A etapa do nome e o UNICO lugar em que texto livre vira dado, e por isso ela sai
  // da escada. Aqui a regra e outra e nao tem excecao: **todo texto produz resposta.**
  // E o que garante que nao exista caminho terminando em silencio — o cliente que
  // manda so o primeiro nome e para nunca fica olhando pra uma tela parada.
  if (naEtapaDoNome(contexto.ultimaResposta) && evento.tipo === 'texto') {
    return responderNome(evento.texto, evento.de, contexto);
  }

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
  agenda_indisponivel: 'A agenda está fechada agora — assim que abrir, é só me chamar. 🙂',
  rota_em_construcao: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  feedback: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  menu_reforcado: 'É só tocar em *Ver opções* na mensagem acima. 👆',
  // A intersecao nunca e a ultima coisa dita — vem sempre uma lista atras. Se ela
  // aparecer aqui, a segunda mensagem falhou no envio, e a dica certa e mandar o
  // cliente esperar em vez de apontar pra uma tela que nao chegou.
  dia_escolhido: 'Só um instante que eu já te mostro os horários. 🙂',
  escolher_dia: 'Toque em um dos dias na mensagem acima pra continuar. 👆',
  escolher_horario: 'Toque em um dos horários na mensagem acima pra continuar. 👆',
  // ponytail: a etapa de nome ainda nao existe, entao o nome digitado cai aqui em vez
  // de ser aproveitado. Teto: o cliente chega ao fim do fluxo e para. Gatilho de
  // upgrade: a proxima fatia, que trata a resposta de texto neste estado.
  pedir_nome: 'Essa última parte ainda está sendo montada por aqui — já já eu volto pra concluir. 🙂',
  agenda_fora_do_ar: 'Não consegui abrir a agenda agora. Tente de novo daqui a pouco. 🙏',
  sem_dia_disponivel: 'Toque em *Ver opções* pra voltar ao menu. 👆',
  sem_horario_no_dia: 'Toque na opção acima pra escolher outro dia. 👆',
  // Estes tres nunca chegam a ser usados: na etapa do nome o texto e tratado antes da
  // escada, porque ali texto e resposta esperada e nao erro de rota. Ficam porque o
  // `Record<NomeResposta, string>` cobra — e a cobranca e o que garante que nenhum
  // estado FUTURO vire silencio por descuido.
  conferir_nome_aviso: 'Confere o nome no cartão acima. 👆',
  conferir_nome: 'Se o nome estiver certo, toque em *Confirmar*. 👆',
  nome_invalido: 'Me manda seu nome, assim: *Victor Santos*. 🙂',
  agendado: 'Seu horário já está marcado! Toque em *Ver opções* se precisar de algo. 👆',
  horario_ocupado: 'Toque numa das opções acima pra escolher outro horário. 👆',
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

    case 'dia':
      return escolherDia(para, contexto, id.params.get('b'), id.params.get('d'));

    case 'hora':
      return escolherHora(
        para,
        contexto,
        id.params.get('b'),
        id.params.get('d'),
        id.params.get('h'),
      );

    // Os dois botoes do cartao de conferencia. `confirmar` nao precisa de parametro
    // no id: o que ele confirma e a reserva e o nome que o contexto ja carrega, lidos
    // do historico. Poe-los no id duplicaria a verdade, e a copia do id nao passaria
    // pela revalidacao do barbeiro.
    case 'confirmar':
      return [confirmarAgendamento(para, contexto)];

    case 'corrigir':
      return [pedirNome(para, true)];

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
  if (resto.length === 0) return comBarbeiro(para, contexto, unico);

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

  if (escolhido) return comBarbeiro(para, contexto, escolhido);
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
    // Lista mesmo com 2 opcoes: esta tela ja foi validada no celular com a cara de
    // cartao, e o formato compacto entrou pra dia e horario, nao pra ela.
    compacta: false,
    opcoes: contexto.barbeiros.map((barbeiro) => ({
      id: montarId('barbeiro', { b: String(barbeiro.id) }),
      // Nome de barbeiro e dado da barbearia: pode chegar maior que o teto da Meta,
      // e titulo estourado faz a Meta recusar a mensagem inteira.
      titulo: comIcone(ICONE_BARBEIRO, barbeiro.nome, LIMITE_TITULO),
    })),
  };
}

/**
 * Barbeiro definido: mostra os dias com vaga.
 *
 * **Uma mensagem so.** Ate 2026-07-31 saiam duas — um texto curto ("Boa! Vamos marcar
 * com o Fulano") na frente da lista, pra tapar a espera do cartao. O dono do produto
 * leu isso na tela do celular e cortou: o cartao de dias ja diz com quem e, e a frase
 * virou ruido entre o toque e a resposta. A espera que ele quis manter coberta e a
 * outra, a do passo do dia, onde a consulta de horarios demora de verdade.
 */
function comBarbeiro(para: string, contexto: ContextoFluxo, barbeiro: Barbeiro): Acao[] {
  const agenda = contexto.agenda;

  if (!agenda || agenda.tipo === 'fora_do_ar') return [foraDoAr(para)];

  // Um `horarios` chegando aqui significa que quem montou o contexto leu o id de um
  // jeito e o roteador leu de outro. Nao ha resposta boa pra inventar, e mentir sobre
  // a agenda seria pior que admitir a falha.
  if (agenda.tipo !== 'dias') return [foraDoAr(para)];

  if (agenda.dias.length === 0) return [semDia(para, barbeiro)];

  return [
    {
      tipo: 'enviar_lista',
      para,
      resposta: 'escolher_dia',
      cabecalho: CABECALHO_AGENDAMENTO,
      texto: 'Qual dia você prefere?',
      rodape: 'Selecione uma opção',
      abrir: 'Ver dias',
      secao: 'Dias disponíveis',
      compacta: true,
      opcoes: agenda.dias.slice(0, LIMITE_OPCOES).map((data) => ({
        id: montarId('dia', { b: String(barbeiro.id), d: data }),
        titulo: comIcone(ICONE_DIA, rotularDia(data, contexto.hoje), LIMITE_TITULO_COMPACTO),
      })),
    },
  ];
}

/**
 * Tocou num dia. O `b` e revalidado aqui pelo mesmo motivo de sempre: o id diz o que
 * o cliente quis, nunca o que ele pode.
 */
function escolherDia(
  para: string,
  contexto: ContextoFluxo,
  b: string | null,
  d: string | null,
): Acao[] {
  const barbeiro = contexto.barbeiros.find((candidato) => String(candidato.id) === b);

  if (!barbeiro) return escolherBarbeiro(para, contexto, b);

  const agenda = contexto.agenda;

  // Sem `d`, ou com `d` que a API nao entendeu, o caminho de volta e o mesmo: mostrar
  // os dias de novo. O n8n oferecia esse botao ("Escolher outro dia") e nenhuma rota
  // reconhecia o id — botao morto. Aqui ele leva pra rota do barbeiro, que ja sabe
  // buscar os dias.
  if (!d) return [semHorario(para, barbeiro, undefined)];

  if (!agenda || agenda.tipo === 'fora_do_ar') return [foraDoAr(para)];
  if (agenda.tipo !== 'horarios') return [foraDoAr(para)];

  if (agenda.horarios.length === 0) return [semHorario(para, barbeiro, d, contexto.hoje)];

  return [
    {
      tipo: 'enviar_texto',
      para,
      resposta: 'dia_escolhido',
      texto: 'Só um momento que eu já te mostro os horários disponíveis. ⏳',
    },
    {
      tipo: 'enviar_lista',
      para,
      resposta: 'escolher_horario',
      cabecalho: CABECALHO_AGENDAMENTO,
      // Sem o dia na frase. O cliente acabou de toca-lo, entao repeti-lo aqui gasta
      // linha e ainda estoura o corpo do cartao em dia com rotulo longo.
      texto: 'Qual horário fica melhor pra você?',
      rodape: 'Selecione uma opção',
      abrir: 'Ver horários',
      secao: 'Horários livres',
      compacta: true,
      // ponytail: corta nos 10 primeiros e o resto do dia nao aparece — decisao
      // explicita do dono do produto (2026-07-30), com o custo a vista. Teto: uma
      // agenda de 08h as 23h gera 13 slots, entao as marcacoes da noite ficam
      // invisiveis num dia vazio. Gatilho de upgrade: reclamacao de dono ou de
      // cliente que nao achou horario que existia; o conserto e perguntar o periodo
      // (manha/tarde/noite) antes, que cabe em botao e nao esconde nada.
      opcoes: agenda.horarios.slice(0, LIMITE_OPCOES).map((hora) => ({
        id: montarId('hora', { b: String(barbeiro.id), d, h: hora }),
        titulo: comIcone(ICONE_HORA, hora, LIMITE_TITULO_COMPACTO),
      })),
    },
  ];
}

/**
 * Tocou num horario. Fim do escopo desta fatia: o bot pede o nome.
 *
 * Uma mensagem so. A confirmacao ("Fechou: tal dia as tal hora com o Fulano") foi
 * cortada em 2026-07-31 pelo dono do produto: o cliente acabou de tocar no horario,
 * entao repeti-lo de volta e eco, nao confirmacao. A conferencia de verdade e o
 * cartao do passo seguinte, que ainda nao existe.
 *
 * ponytail: a resposta do cliente a esta pergunta ainda nao e tratada — texto cai na
 * escada de feedback, e a dica de `pedir_nome` avisa que a parte esta sendo montada.
 * Teto: o cliente chega aqui e para, sem agendamento gravado. Gatilho de upgrade: a
 * proxima fatia (nome, conferencia e `POST /agendamentos`), cuja rota ainda vai ser
 * decidida com o dono do produto.
 *
 * ponytail: a pergunta do nome sai igual pra todo mundo, inclusive pra quem ja tem
 * cadastro e cujo nome o bot ja usa na saudacao (`contexto.nome`). Teto: na segunda
 * vez que agenda, o cliente conhecido le "como voce e novo por aqui". Gatilho de
 * upgrade: a proxima fatia — decidido com o dono do produto em 2026-07-31 que quem
 * ja fechou um agendamento **pula esta pergunta**, e o salto so tem pra onde ir
 * quando o passo de conferencia existir.
 */
function escolherHora(
  para: string,
  contexto: ContextoFluxo,
  b: string | null,
  d: string | null,
  h: string | null,
): Acao[] {
  const barbeiro = contexto.barbeiros.find((candidato) => String(candidato.id) === b);

  if (!barbeiro) return escolherBarbeiro(para, contexto, b);
  if (!d || !h) return [semHorario(para, barbeiro, undefined)];

  return [
    {
      tipo: 'enviar_texto',
      para,
      resposta: 'pedir_nome',
      texto:
        'Como você é novo por aqui, me manda seu *nome e sobrenome* que já finalizo seu agendamento. ✍🏻',
    },
  ];
}

/**
 * Os estados em que o bot esta esperando um nome: a pergunta, o cartao de conferencia
 * (texto ali e sobrenome ou correcao) e a recusa.
 *
 * Exportado porque `alvoDaAgenda` precisa do mesmo predicado — e duas listas iguais
 * escritas separadas divergiriam no dia em que um estado novo entrasse so numa delas.
 * O sintoma seria o pior: o bot tratando o texto por um caminho e calando pelo outro.
 */
export const ESTADOS_DO_NOME: ReadonlySet<NomeResposta> = new Set([
  'pedir_nome',
  'conferir_nome',
  'nome_invalido',
  'horario_ocupado',
]);

function naEtapaDoNome(ultima: NomeResposta | undefined): boolean {
  return ESTADOS_DO_NOME.has(ultima as NomeResposta);
}

/**
 * O tratamento do texto na etapa do nome.
 *
 * Uma forma de mensagem so — o cartao — e duas saidas de excecao. Nao existe "as
 * vezes cartao, as vezes bronca, depende do relogio": a trava de rajada nao vale
 * aqui, porque ela foi feita pra adivinhar se o cliente terminou de falar, e neste
 * ponto o bot fez uma pergunta especifica e esta recebendo a resposta dela.
 */
function responderNome(texto: string, para: string, contexto: ContextoFluxo): Acao[] {
  const leitura = lerNome(texto);

  if (leitura.tipo === 'quer_corrigir') return [pedirNome(para, true)];
  if (leitura.tipo === 'invalido') return [nomeInvalido(para, leitura.motivo)];

  const juncao = juntarNome(contexto.nomePendente, leitura.nome);
  const reserva = contexto.reserva;

  // Sem reserva no contexto o cartao nao tem o que mostrar. Nao ha resposta boa pra
  // inventar aqui, e inventar um dia ou um horario seria pior que admitir a falha.
  if (!reserva) return [foraDoAr(para)];

  // Acrescimo com nome completo fecha SEM TOQUE: o cliente acabou de digitar as duas
  // partes, entao a informacao esta completa e conferida por quem sabe. Correcao nao
  // fecha — e justo onde a nossa leitura tem mais chance de estar errada, e pular o
  // cartao ali seria abrir mao da unica conferencia que existe.
  if (juncao.tipo === 'acrescimo' && palavrasReais(juncao.nome) > 1) {
    return [fecharAgendamento(para, contexto, juncao.nome)];
  }

  return cartaoDeConferencia(para, contexto, juncao.nome);
}

/**
 * O cartao de conferencia: a peca que sustenta a etapa inteira.
 *
 * **O nome e o unico campo aqui que pode estar errado.** Barbeiro, dia e hora vieram
 * de ids de botao que nos mesmos escrevemos — nao ha caminho em que estejam errados.
 * Por isso ele sai sozinho na primeira linha, em negrito, longe do resto: cercado de
 * coisa certa, o olho reconhece o conjunto pelo dia e pela hora e passa batido
 * justamente pelo unico item que precisava de conferencia.
 *
 * A mensagem curta na frente existe pelo mesmo motivo, e e uma ponte deliberada — as
 * outras tres foram cortadas por serem ruido, esta tem trabalho a fazer. O 👇 e o que
 * a faz funcionar: sem ele, ela mandaria conferir algo que ainda nao chegou na tela.
 */
function cartaoDeConferencia(para: string, contexto: ContextoFluxo, nome: string): Acao[] {
  const reserva = contexto.reserva!;
  const completo = palavrasReais(nome) > 1;

  return [
    {
      tipo: 'enviar_texto',
      para,
      resposta: 'conferir_nome_aviso',
      texto: 'Só confere teu nome antes de confirmar 👇',
    },
    {
      tipo: 'enviar_lista',
      para,
      resposta: 'conferir_nome',
      cabecalho: CABECALHO_AGENDAMENTO,
      texto: `*${nome}*\n\n📅 ${rotularDia(reserva.data, contexto.hoje)} às ${reserva.hora}\n💈 ${reserva.barbeiro.nome}`,
      // O rodape anuncia a acao provavel de CADA estado. Com uma palavra so, o que
      // falta e o sobrenome; com o nome completo, o que resta e conferir.
      rodape: completo
        ? 'Confira o nome antes de confirmar.'
        : 'Se tiver sobrenome, é só mandar abaixo.',
      abrir: 'Ver opções',
      secao: 'Agendamento',
      // Dois botoes: sai no formato `button`, com cabecalho e rodape a vista, sem o
      // cliente precisar tocar em nada pra ler o que vai confirmar.
      compacta: true,
      opcoes: [
        { id: montarId('confirmar'), titulo: '✅ Confirmar' },
        { id: montarId('corrigir'), titulo: '✏️ Corrigir nome' },
      ],
    },
  ];
}

/**
 * A recusa, com a frase mirada no motivo.
 *
 * O `Nome - Tratamento` do n8n calculava exatamente este motivo e **jogava fora**,
 * mandando sempre a mesma mensagem generica. A precisao ja estava paga.
 */
function nomeInvalido(para: string, motivo: MotivoInvalido): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'nome_invalido',
    texto: `${MOTIVO[motivo]}\n\nManda assim: *Victor Santos*`,
  };
}

const MOTIVO: Record<MotivoInvalido, string> = {
  vazio: 'Preciso do seu nome pra fechar. 🙂',
  curto: 'Preciso do nome completo pra fechar. 🙂',
  tem_numero: 'Nome não leva número. 🙂',
  caracter_invalido: 'Não consegui ler esse nome. 🙂',
  resposta_generica: 'Preciso do seu nome pra fechar. 🙂',
};

function pedirNome(para: string, denovo = false): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'pedir_nome',
    texto: denovo
      ? 'Sem problema! Me manda o nome certo. ✍🏻'
      : 'Como você é novo por aqui, me manda seu *nome e sobrenome* que já finalizo seu agendamento. ✍🏻',
  };
}

/**
 * Fim do fluxo: o que o cliente ve depois de o agendamento existir na agenda do dono.
 *
 * O `✅` fecha o gesto do botao que ele acabou de tocar, e "Tudo certo" responde a
 * pergunta que o cartao fez. E ele e chamado pelo PRIMEIRO nome — o completo foi
 * gravado pro dono reconhecer quem e, nao pro bot recitar.
 */
/**
 * Tocou em Confirmar. O nome vem do contexto, nao do id — e se ele nao estiver la, o
 * cartao foi confirmado sem nome nenhum (id antigo, historico cortado pela virada do
 * dia). Reperguntar e melhor que gravar um agendamento sem cliente.
 */
function confirmarAgendamento(para: string, contexto: ContextoFluxo): Acao {
  if (!contexto.nomePendente) return pedirNome(para);

  return fecharAgendamento(para, contexto, contexto.nomePendente);
}

function fecharAgendamento(para: string, contexto: ContextoFluxo, nome: string): Acao {
  const agenda = contexto.agenda;
  const reserva = contexto.reserva;

  if (!reserva) return foraDoAr(para);
  if (agenda?.tipo === 'ocupado') return horarioOcupado(para, reserva);
  if (agenda?.tipo !== 'marcado') return foraDoAr(para);

  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'agendado',
    texto: `Tudo certo, ${primeiroNome(nome)}! Tá marcado. ✅\n\n📅 ${rotularDia(reserva.data, contexto.hoje)} às ${reserva.hora}\n💈 ${reserva.barbeiro.nome}\n\nTe espero lá!`,
  };
}

/**
 * O horario foi tomado entre a escolha e a confirmacao. Frase sobre a AGENDA, nunca
 * sobre o sistema — e com o caminho de volta tratado, nao so oferecido.
 */
function horarioOcupado(para: string, reserva: ContextoFluxo['reserva'] & object): Acao {
  return {
    tipo: 'enviar_lista',
    para,
    resposta: 'horario_ocupado',
    cabecalho: undefined,
    texto: `O horário das *${reserva.hora}* acabou de ser pego. 😕`,
    rodape: 'Selecione uma opção',
    abrir: 'Ver opções',
    secao: 'Agendamento',
    compacta: true,
    opcoes: [
      { id: montarId('dia', { b: String(reserva.barbeiro.id), d: reserva.data }), titulo: '🕐 Outro horário' },
      { id: montarId('barbeiro', { b: String(reserva.barbeiro.id) }), titulo: '📅 Outro dia' },
    ],
  };
}

/** A agenda existe, o barbeiro atende, mas nao ha vaga na janela que o dono abriu. */
function semDia(para: string, barbeiro: Barbeiro): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'sem_dia_disponivel',
    texto: `O *${barbeiro.nome}* está sem horário livre nos próximos dias. 😕\n\nSe quiser, me chame de novo mais tarde ou escolha outro profissional pelo menu.`,
  };
}

/**
 * O dia escolhido nao tem horario. Diferente de `semDia`, aqui existe caminho de
 * volta — e ele e tratado de verdade, nao so oferecido.
 */
function semHorario(para: string, barbeiro: Barbeiro, dia: string | undefined, hoje?: string): Acao {
  const rotulo = dia && hoje ? rotularDia(dia, hoje) : undefined;

  return {
    tipo: 'enviar_lista',
    para,
    resposta: 'sem_horario_no_dia',
    cabecalho: undefined,
    texto: rotulo
      ? `Os horários de *${rotulo}* acabaram de encher. 😕`
      : 'Não consegui identificar esse dia. 😕',
    rodape: 'Selecione uma opção',
    abrir: 'Ver opções',
    secao: 'Agendamento',
    compacta: true,
    opcoes: [
      { id: montarId('barbeiro', { b: String(barbeiro.id) }), titulo: '📅 Ver outros dias' },
      { id: montarId('agendar'), titulo: '↩️ Recomeçar' },
    ],
  };
}

/**
 * A API do calendario nao respondeu. Frase deliberadamente diferente de `semDia`: uma
 * fala sobre a agenda da barbearia, a outra sobre o nosso sistema. Trocar as duas
 * faria o bot dizer que o barbeiro esta lotado quando o problema e nosso.
 */
function foraDoAr(para: string): Acao {
  return {
    tipo: 'enviar_texto',
    para,
    resposta: 'agenda_fora_do_ar',
    texto: 'Não consegui abrir a agenda agora. 😕\n\nTenta de novo daqui a pouquinho, por favor.',
  };
}

const CABECALHO_AGENDAMENTO = 'Agendamento: 📅';

/** Teto da Meta em linhas por lista: 10 no total, somando todas as secoes. */
const LIMITE_OPCOES = 10;

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

/**
 * Um titulo de opcao com icone na frente.
 *
 * O corte acontece ANTES do prefixo, e isso e o ponto: `cortar()` fatia por
 * `.length`, e nenhum destes icones ocupa uma posicao so — `🔘` e `🕐` sao pares
 * surrogate, `▫️` e o simbolo mais o seletor de variacao (U+25AB U+FE0F). Cortar a
 * string ja prefixada partiria o emoji ao meio num nome longo, e titulo com metade de
 * surrogate faz a Meta recusar a mensagem inteira — com a lista toda junto.
 */
function comIcone(icone: string, texto: string, limite: number): string {
  const prefixo = `${icone} `;

  return `${prefixo}${cortar(texto, limite - prefixo.length)}`;
}

/**
 * Os icones que abrem cada linha de lista. Escolha do dono do produto em 2026-07-31,
 * olhando as telas no celular.
 *
 * `ICONE_HORA` e um so pra todos os horarios, de proposito. O Unicode tem carinha de
 * relogio exata (`🕗`, `🕣`) apenas para `:00` e `:30`, e o slot tem o tamanho da
 * `duracao_min` daquele profissional — hoje mesmo o Lucas Eloi trabalha em 45 min e
 * produz 08:45, 09:30, 10:15. Emoji exato so daria certo em parte da lista.
 */
const ICONE_BARBEIRO = '▫️';
const ICONE_DIA = '🔘';
const ICONE_HORA = '🕐';

/** Teto da Meta no titulo de linha da lista. */
const LIMITE_TITULO = 24;

/**
 * Teto do titulo de um botao de resposta rapida: 20, contra 24 da linha de lista.
 * Toda opcao marcada `compacta` usa o menor, porque ela pode sair nos dois formatos e
 * so se sabe qual na hora do envio.
 */
const LIMITE_TITULO_COMPACTO = 20;

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
    // O menu tem exatamente 3 opcoes e ainda assim e lista, por decisao do dono do
    // produto: e a unica mensagem que 100% dos clientes veem.
    compacta: false,
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
