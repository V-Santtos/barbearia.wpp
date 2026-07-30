/**
 * Camada de anticorrupcao: o formato da Meta entra aqui e nao sai.
 *
 * Daqui pra dentro o resto do codigo so conhece `EventoRecebido`. Dois motivos
 * praticos, os dois verificados no fluxo antigo:
 *
 *  - A Meta versiona a API (v22, v23...) e muda formato. O estrago fica neste
 *    arquivo em vez de espalhado pelo roteador.
 *  - Recibo de entrega (`statuses`) chega no MESMO campo `messages` que a
 *    mensagem do cliente. Numa conversa normal chega mais recibo do que
 *    mensagem — sem separar na porta, o codigo tenta rotear recibo como se
 *    fosse gente falando.
 */

export type EnvelopeWebhook = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
  }>;
};

type Comum = {
  /** Identificador da mensagem na Meta. E a chave de dedupe. */
  wamid: string;
  /** `phone_number_id`: qual numero da barbearia recebeu. Discriminador de tenant. */
  numeroBarbearia: string;
  /** `wa_id` de quem mandou, no formato limpo que a Cloud API entrega. */
  de: string;
  /** Nome do perfil do WhatsApp, quando a Meta manda. */
  nome: string | undefined;
  recebidoEm: Date;
  /** O objeto cru da mensagem, do jeito que a Meta mandou. Vai pro banco. */
  cru: unknown;
};

export type EventoRecebido = Comum &
  (
    | { tipo: 'texto'; texto: string }
    | { tipo: 'botao'; botaoId: string; titulo: string | undefined }
    | { tipo: 'nao_suportado'; formato: string }
  );

export type Traducao = {
  eventos: EventoRecebido[];
  /** Motivos do que foi descartado, so pra log (ex.: `status:delivered`). */
  ignorados: string[];
};

export function traduzirEnvelope(envelope: EnvelopeWebhook): Traducao {
  const eventos: EventoRecebido[] = [];
  const ignorados: string[] = [];

  for (const entrada of envelope.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const campo = mudanca.field ?? 'desconhecido';
      const valor = mudanca.value ?? {};

      // Coexistencia (`history`, `smb_app_state_sync`, `smb_message_echoes`) e
      // qualquer campo novo caem aqui: reconhecidos, nao roteados.
      if (campo !== 'messages') {
        ignorados.push(`campo:${campo}`);
        continue;
      }

      for (const status of lista(valor.statuses)) {
        ignorados.push(`status:${texto(status.status) ?? 'sem-status'}`);
      }

      const numeroBarbearia = texto(objeto(valor.metadata)?.phone_number_id);
      const nomes = nomesPorWaId(valor.contacts);

      for (const mensagem of lista(valor.messages)) {
        const wamid = texto(mensagem.id);
        const de = texto(mensagem.from);

        // Sem wamid nao ha dedupe, e sem remetente nao ha pra quem responder.
        if (!wamid || !de || !numeroBarbearia) {
          ignorados.push('mensagem:incompleta');
          continue;
        }

        const comum: Comum = {
          wamid,
          numeroBarbearia,
          de,
          nome: nomes.get(de),
          recebidoEm: paraData(mensagem.timestamp),
          cru: mensagem,
        };

        eventos.push({ ...comum, ...conteudo(mensagem) });
      }
    }
  }

  return { eventos, ignorados };
}

type Conteudo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'botao'; botaoId: string; titulo: string | undefined }
  | { tipo: 'nao_suportado'; formato: string };

function conteudo(mensagem: Record<string, unknown>): Conteudo {
  const formato = texto(mensagem.type) ?? 'desconhecido';

  if (formato === 'text') {
    const corpo = texto(objeto(mensagem.text)?.body);
    return corpo ? { tipo: 'texto', texto: corpo } : { tipo: 'nao_suportado', formato };
  }

  if (formato === 'interactive') {
    // O toque volta em `button_reply` ou `list_reply` dependendo do tipo que foi
    // enviado. Normalizamos os dois num campo so.
    const interativo = objeto(mensagem.interactive);
    const resposta = objeto(interativo?.button_reply) ?? objeto(interativo?.list_reply);
    const botaoId = texto(resposta?.id);

    return botaoId
      ? { tipo: 'botao', botaoId, titulo: texto(resposta?.title) }
      : { tipo: 'nao_suportado', formato };
  }

  // audio, image, sticker, location, document, contacts, reaction...
  return { tipo: 'nao_suportado', formato };
}

function nomesPorWaId(contatos: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const contato of lista(contatos)) {
    const waId = texto(contato.wa_id);
    const nome = texto(objeto(contato.profile)?.name);
    if (waId && nome) mapa.set(waId, nome);
  }
  return mapa;
}

/** A Meta manda unix em segundos, como string. */
function paraData(valor: unknown): Date {
  const segundos = Number(valor);
  return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : new Date();
}

function lista(valor: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
}

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : undefined;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}
