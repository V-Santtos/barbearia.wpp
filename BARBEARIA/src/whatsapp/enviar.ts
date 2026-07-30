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

export type Emissor = (acao: Acao) => Promise<void>;

export function criarEmissor(env: Env): Emissor {
  const url = `https://graph.facebook.com/${VERSAO_API}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  return async (acao: Acao): Promise<void> => {
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
  };
}

function montarCorpo(acao: Acao): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: acao.para };

  if (acao.tipo === 'enviar_texto') {
    return { ...base, type: 'text', text: { preview_url: false, body: acao.texto } };
  }

  // `interactive.type = list`: o cliente toca em "Ver opcoes" pra abrir a lista.
  // Custa um toque a mais que o formato `button`, e em troca traz header e footer,
  // que `button` nao aceita — foi a escolha do dono do produto pra padronizar o menu.
  //
  // Tetos da Meta, todos silenciosos (ela recusa o envio com 400): header 60,
  // body 1024, footer 60, `action.button` 20, titulo de linha 24, id de linha 200.
  return {
    ...base,
    type: 'interactive',
    interactive: {
      type: 'list',
      // Header e opcional: so a abertura do dia manda um. Mandar `header: undefined`
      // nao serve — a Meta rejeita a chave presente com valor vazio.
      ...(acao.cabecalho ? { header: { type: 'text', text: acao.cabecalho } } : {}),
      body: { text: acao.texto },
      footer: { text: acao.rodape },
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
