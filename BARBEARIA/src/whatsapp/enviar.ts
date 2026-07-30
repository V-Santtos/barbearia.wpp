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

  // `interactive.type = button` aceita no maximo 3 opcoes; acima disso a Meta
  // exige `list`, que custa um toque a mais do cliente pra abrir. O menu foi
  // desenhado com 3 justamente pra caber aqui.
  return {
    ...base,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: acao.texto },
      action: {
        buttons: acao.botoes.map((botao) => ({
          type: 'reply',
          reply: { id: botao.id, title: botao.titulo },
        })),
      },
    },
  };
}
