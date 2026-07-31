import type { Saudacao } from './saudacao.js';

/**
 * O que o roteador devolve. Sao INTENCOES, nao efeitos: `rotear()` monta esta
 * lista e nao manda nada. Quem executa e outro pedaco.
 *
 * E isso que torna o fluxo testavel de verdade — o teste compara a lista de
 * acoes esperada, sem subir servidor, sem simular a API da Meta, em
 * milissegundos.
 */

/**
 * Todo nome de resposta que o bot sabe dar. Nao e enfeite: e o que faz o
 * compilador cobrar o feedback correspondente em `rotear.ts`. Estado novo sem a
 * frase de "voce precisa tocar em tal lugar" **nao compila** — que e a unica
 * forma de garantir que a escada de feedback nunca vire silencio por esquecimento.
 */
export const NOMES_RESPOSTA = [
  'saudacao',
  'menu_principal',
  'escolher_barbeiro',
  'agenda_indisponivel',
  'rota_em_construcao',
  'feedback',
  'menu_reforcado',
  // A intersecao: o texto curto que reconhece a escolha e sai na frente da lista
  // seguinte. E resposta de primeira classe, com nome proprio, porque a escada de
  // feedback precisa saber qual foi a ULTIMA coisa dita — e numa mensagem picada
  // quem vale e a segunda.
  //
  // Sobrou uma. As outras duas (`barbeiro_escolhido`, `horario_escolhido`) foram
  // apagadas em 2026-07-31, na lapidacao das mensagens: o dono do produto leu as
  // duas na tela do celular e nao quis nenhuma. Esta ficou porque cobre a unica
  // espera que o cliente sente de verdade — a consulta dos horarios do dia.
  'dia_escolhido',
  'escolher_dia',
  'escolher_horario',
  'pedir_nome',
  // A etapa do nome. `conferir_nome_aviso` e a mensagem curta que sai na frente do
  // cartao apontando pra ele: o cliente desatento toca no botao sem ler, e ela existe
  // pra dar a ele uma chance a mais de conferir a unica coisa que pode estar errada.
  'conferir_nome_aviso',
  'conferir_nome',
  'nome_invalido',
  'agendado',
  'horario_ocupado',
  'agenda_fora_do_ar',
  'sem_dia_disponivel',
  'sem_horario_no_dia',
] as const;

export type NomeResposta = (typeof NOMES_RESPOSTA)[number];

export type Opcao = {
  id: string;
  /** Teto da Meta na linha de lista: 24 caracteres. */
  titulo: string;
};

type Base = {
  /** `wa_id` do destinatario. */
  para: string;
  /**
   * Qual resposta e esta. Vai pro banco e sustenta duas regras: a trava
   * anti-repeticao e a escada de feedback, que precisa saber a ultima coisa que o
   * bot falou pra mirar a dica certa.
   */
  resposta: NomeResposta;
  /** O corpo da mensagem. Numa lista, e o `body` — o texto entre header e footer. */
  texto: string;
};

/**
 * A mensagem de opcoes. Sai como `interactive.type = list` por padrao; com `compacta`
 * e no maximo 3 opcoes, sai como `button` — os dois com header e footer.
 *
 * A escolha do formato e declarada por mensagem, nunca deduzida da contagem. O menu de
 * abertura tem exatamente 3 opcoes e ainda assim e lista: e a unica mensagem que 100%
 * dos clientes veem, e o dono do produto escolheu o cartao completo com "Ver opcoes"
 * pra ela. Deduzir pela contagem transformaria essa decisao num acidente.
 */
export type Acao =
  | (Base & { tipo: 'enviar_texto' })
  | (Base & {
      tipo: 'enviar_lista';
      /** Teto de 60. Opcional: so a abertura do dia tem cabecalho. */
      cabecalho: string | undefined;
      /** Teto de 60. */
      rodape: string;
      /** O rotulo que abre a lista. Teto de 20. Ignorado quando vira `button`. */
      abrir: string;
      /** Titulo da secao. Teto de 24. Ignorado quando vira `button`. */
      secao: string;
      /**
       * "Pode virar botoes se couber." Regra do dono do produto: ate 3 opcoes, o
       * cliente ve tudo na tela sem abrir nada — obriga-lo a tocar em "Ver opcoes"
       * pra encarar dois horarios cobra um toque por estetica.
       */
      compacta: boolean;
      opcoes: Opcao[];
    });

/**
 * O que o roteador precisa saber alem do evento. Entra como parametro justamente
 * pra funcao continuar pura: quem consulta o banco (e quem olha o relogio) e o
 * chamador.
 *
 * `ultimaResposta` e `degrau` sao escopados ao **dia corrente em Sao Paulo** e ao
 * que aconteceu **depois do ultimo toque em botao** — e por isso que o reset diario
 * e o reset por interacao saem de graca, sem job de limpeza e sem campo de controle.
 */
/** Um profissional ativo da barbearia, do jeito que o fluxo precisa dele. */
export type Barbeiro = {
  /** `profissionais.id`. E o que viaja no id da opcao (`1.barbeiro?b=2`). */
  id: number;
  nome: string;
};

/**
 * O que a API do calendario respondeu, quando o evento pediu que ela fosse
 * consultada. `undefined` no resto — a maioria dos eventos nao precisa de agenda.
 *
 * `fora_do_ar` e um estado de primeira classe, e nao um `dias: []`, porque as duas
 * situacoes merecem frases opostas: "nao tenho vaga nos proximos dias" e uma resposta
 * sobre a agenda, "nao consegui consultar agora" e uma resposta sobre o sistema.
 * Confundir as duas faria o bot mentir sobre a barbearia quando o problema e nosso.
 */
export type Agenda =
  | { tipo: 'dias'; dias: string[] }
  | { tipo: 'horarios'; data: string; horarios: string[] }
  /** O agendamento foi gravado — aparece na agenda do dono. */
  | { tipo: 'marcado' }
  /** `409`: alguem pegou o horario no meio do caminho. Fala de agenda, nao de sistema. */
  | { tipo: 'ocupado' }
  | { tipo: 'fora_do_ar' };

export type ContextoFluxo = {
  /**
   * Os barbeiros ativos, em ordem estavel. **Barbeiro e dado, nao codigo** — e o
   * que decide, sozinho, se a pergunta "com quem?" chega a ser feita:
   *
   *   0 -> nao ha agenda pra oferecer
   *   1 -> pergunta pulada, a escolha e obvia
   *   2 -> a pergunta aparece
   *
   * No fluxo n8n os dois barbeiros eram codigo: id hardcoded em tres nos e ~20 nos
   * duplicados por profissional. Trocar um barbeiro era editar o fluxo.
   */
  barbeiros: Barbeiro[];
  /**
   * O nome que o cliente informou ao fechar um agendamento — `undefined` enquanto
   * ele nunca fechou nenhum.
   *
   * **Nao e o nome do perfil do WhatsApp.** A Meta manda aquele de graca em toda
   * mensagem e o tradutor ate captura, mas ele e o que a pessoa escreveu no proprio
   * aparelho: apelido, nome de loja, emoji. Chamar cliente por aquilo gera confusao,
   * entao a fonte e uma so — a resposta dele na etapa de nome do agendamento.
   */
  nome: string | undefined;
  /** "Bom dia" | "Boa tarde" | "Boa noite", calculado no fuso de Sao Paulo. */
  saudacao: Saudacao;
  /**
   * Hoje em `YYYY-MM-DD`, no fuso de Sao Paulo. Serve pra rotular os dias (`Hoje`,
   * `Amanha`, `Qua 06/08`) sem o roteador olhar o relogio.
   */
  hoje: string;
  /** O que a API do calendario respondeu — so nos eventos que precisam dela. */
  agenda: Agenda | undefined;
  /** A ultima resposta que o bot deu hoje, depois do ultimo botao tocado. */
  ultimaResposta: NomeResposta | undefined;
  /**
   * O dono esta atendendo esta conversa a mao **agora**.
   *
   * Verdadeiro enquanto ele tiver escrito hoje (fuso de Sao Paulo) e depois do
   * ultimo toque em botao — o mesmo recorte de `ultimaResposta` e `degrau`, e pelo
   * mesmo motivo: os dois resets saem de graca, sem coluna de controle e sem
   * ninguem ter que lembrar de devolver a conversa ao bot.
   *
   * **Nao e `conversations.status = 'human'`.** Aquela coluna e permanente ate
   * alguem mudar, e a janela de 24h da Meta nao fecha na virada do dia: cliente que
   * falou as 14h e voltasse as 10h do dia seguinte encontraria o bot mudo, com a
   * conversa presa em humano. Aqui a meia-noite devolve o atendimento sozinha.
   */
  donoAtendendo: boolean;
  /**
   * O nome que o cliente vem montando NESTA etapa, ja limpo e capitalizado —
   * `undefined` enquanto ele nao mandou nada aproveitavel.
   *
   * Sai do historico, como todo o resto do estado: sao os textos que chegaram depois
   * do ultimo toque em botao, hoje. Por isso `Corrigir nome` nao precisa apagar nada
   * — ele e um botao, e o proprio corte do "depois do ultimo botao" deixa as
   * tentativas velhas pra tras.
   */
  nomePendente: string | undefined;
  /**
   * O que ja foi escolhido por botao: barbeiro, dia e hora. `undefined` fora da etapa
   * do nome.
   *
   * Existe porque, depois que o cliente comeca a digitar o nome, o id do botao ficou
   * pra tras — e o cartao de conferencia precisa reimprimir a reserva a cada texto.
   * Sai do ULTIMO toque em `hora` de hoje, relido do historico como todo o resto, e o
   * barbeiro e revalidado contra a lista de ativos antes de virar isto aqui.
   */
  reserva: Reserva | undefined;
  /**
   * Degrau da escada de feedback nesta sequencia de mensagens de texto:
   * 0 = ainda nao avisei, 1 = ja avisei uma vez, 2 = ja reforcei o menu (travado).
   */
  degrau: 0 | 1 | 2;
};

/** O agendamento montado por botao, esperando so o nome. */
export type Reserva = {
  barbeiro: Barbeiro;
  /** `YYYY-MM-DD`. */
  data: string;
  /** `HH:MM`. */
  hora: string;
};
