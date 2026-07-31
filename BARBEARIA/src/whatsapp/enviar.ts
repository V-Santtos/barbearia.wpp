import type { Env } from '../config/env.js';
import type { Acao } from '../fluxo/acoes.js';

/**
 * Executor das acoes: e o unico lugar que fala com a Cloud API pra enviar.
 *
 * O fluxo antigo gastava 3 a 4 chamadas HTTP por resposta — e duas delas eram o
 * par `Digitando` com payload identico, duplicado em todos os 7 pontos do fluxo
 * sem ninguem notar. Aqui e uma chamada por mensagem.
 */

// ponytail: versao da Graph API fixada. Teto: a Meta mantem versao por ~2 anos.
// Gatilho de upgrade: quando um recurso novo exigir versao maior, ou quando esta
// entrar em depreciacao no painel.
const VERSAO_API = 'v22.0';

/**
 * Devolve o `wamid` que a Meta gerou para a mensagem, ou `undefined` se ela nao
 * mandou um. Esse id e a chave de idempotencia do espelho no painel: sem ele, uma
 * repeticao duplicaria a fala do bot e a conversa apareceria gaguejando pro dono.
 */
export type Emissor = (acao: Acao) => Promise<string | undefined>;

export function criarEmissor(env: Env): Emissor {
  const url = `https://graph.facebook.com/${VERSAO_API}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  return async (acao: Acao): Promise<string | undefined> => {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(montarCorpo(acao)),
    });

    if (!resposta.ok) {
      // O corpo do erro da Meta e a parte util (code, error_subcode, message).
      // Sem ele, depurar isso vira adivinhacao.
      const detalhe = await resposta.text().catch(() => '');
      throw new Error(`Cloud API recusou o envio (${resposta.status}): ${detalhe}`);
    }

    // Corpo ilegivel aqui NAO e erro: a mensagem saiu, a Meta respondeu 200. Perder o
    // id custa a idempotencia do espelho, nao a conversa — entao engole e segue.
    const corpo = (await resposta.json().catch(() => undefined)) as
      | { messages?: { id?: unknown }[] }
      | undefined;
    const id = corpo?.messages?.[0]?.id;

    return typeof id === 'string' ? id : undefined;
  };
}

/** `button` aceita no maximo 3 respostas rapidas; acima disso so `list` resolve. */
const MAXIMO_BOTOES = 3;

function montarCorpo(acao: Acao): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: acao.para };

  if (acao.tipo === 'enviar_texto') {
    return { ...base, type: 'text', text: { preview_url: false, body: acao.texto } };
  }

  // Header e opcional, e mandar `header: undefined` nao serve — a Meta rejeita a
  // chave presente com valor vazio.
  const moldura = {
    ...(acao.cabecalho ? { header: { type: 'text', text: acao.cabecalho } } : {}),
    body: { text: acao.texto },
    footer: { text: acao.rodape },
  };

  // Tetos da Meta, todos silenciosos (ela recusa o envio inteiro com 400): header 60,
  // body 1024, footer 60, `action.button` 20, titulo de linha 24, id de linha 200,
  // titulo de botao 20, id de botao 256, 10 linhas por secao.
  if (acao.compacta && acao.opcoes.length <= MAXIMO_BOTOES) {
    // `button` tambem aceita header e footer — o fluxo n8n assumia que nao, e essa
    // premissa errada foi o que justificou padronizar tudo em lista. Aqui o cliente
    // ganha o toque economizado sem perder o cartao.
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...moldura,
        action: {
          buttons: acao.opcoes.map((opcao) => ({
            type: 'reply',
            reply: { id: opcao.id, title: opcao.titulo },
          })),
        },
      },
    };
  }

  // `interactive.type = list`: o cliente toca em "Ver opcoes" pra abrir a lista.
  return {
    ...base,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...moldura,
      action: {
        button: acao.abrir,
        sections: [
          {
            title: acao.secao,
            rows: acao.opcoes.map((opcao) => ({ id: opcao.id, title: opcao.titulo })),
          },
        ],
      },
    },
  };
}
