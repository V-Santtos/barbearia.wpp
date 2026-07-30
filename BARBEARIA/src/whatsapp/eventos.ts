/**
 * Formatos de webhook que a Meta manda. Modelado como uma envelope generica
 * porque na Fase 1 a gente so quer SABER o que chegou — interpretar o conteudo
 * de cada campo vem depois, junto com a maquina de estados.
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

export type ResumoEvento = {
  /** Nome do campo assinado: messages, smb_message_echoes, history, ... */
  campo: string;
  /** ID da WABA que originou o evento. */
  wabaId: string | undefined;
  /** Identificadores de mensagem (wamid), quando o campo carrega mensagens. */
  wamids: string[];
};

const LISTAS_DE_MENSAGEM = ['messages', 'statuses', 'message_echoes'] as const;

/**
 * Achata o envelope num resumo por `change`. E o que a gente loga pra enxergar
 * o primeiro evento chegando — e, mais pra frente, a chave de dedupe por wamid.
 */
export function resumirEvento(envelope: EnvelopeWebhook): ResumoEvento[] {
  const resumos: ResumoEvento[] = [];

  for (const entrada of envelope.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      resumos.push({
        campo: mudanca.field ?? 'desconhecido',
        wabaId: entrada.id,
        wamids: extrairWamids(mudanca.value),
      });
    }
  }

  return resumos;
}

function extrairWamids(valor: Record<string, unknown> | undefined): string[] {
  if (!valor) return [];

  const ids: string[] = [];
  for (const chave of LISTAS_DE_MENSAGEM) {
    const lista = valor[chave];
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      const id = (item as { id?: unknown })?.id;
      if (typeof id === 'string') ids.push(id);
    }
  }
  return ids;
}
