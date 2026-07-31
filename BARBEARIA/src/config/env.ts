export type Env = {
  META_APP_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  DATABASE_URL: string;
  /** Base da API do calendario (`CALENDARIO/server.js`). Local por decisao: 3334. */
  CALENDARIO_URL: string;
  /**
   * Token do `POST /whatsapp/events`, que espelha a conversa no painel do dono.
   * **Opcional de proposito:** sem ele o bot atende igual e so o painel fica sem a
   * conversa. Deve bater com o `WHATSAPP_WEBHOOK_TOKEN` do `.env` do calendario.
   */
  CALENDARIO_WEBHOOK_TOKEN: string;
  /**
   * Token do `POST /mensagens`, por onde o painel manda o bot falar quando o dono
   * responde a mão.
   *
   * **Segredo proprio, e nao o `CALENDARIO_WEBHOOK_TOKEN`:** aquele protege a
   * direcao contraria (bot -> calendario). Um valor so pros dois sentidos faria um
   * vazamento abrir as duas portas de uma vez.
   *
   * Opcional como o outro: sem ele a rota responde 503 e o bot atende igual.
   */
  PAINEL_TOKEN: string;
  PORT: number;
};

/** O calendario roda ao lado, na 3334 — a 3333 e deste bot. */
const CALENDARIO_PADRAO = 'http://localhost:3334';

// ponytail: validacao manual de env, sem zod. O gatilho declarado aqui era "a proxima
// variavel que precisar de coercao ou formato" — CALENDARIO_URL disparou, e foi
// coberta com `new URL()`, que e formato sem coercao e nao pede dependencia nova.
// Gatilho que fica de pe: a primeira variavel que precisar de ENUM ou de FAIXA
// numerica troca isto por um schema, porque ai a checagem a mao vira regra escondida.
export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const faltando: string[] = [];

  const obrigatoria = (nome: string): string => {
    const valor = fonte[nome]?.trim();
    if (!valor) {
      faltando.push(nome);
      return '';
    }
    return valor;
  };

  const env: Env = {
    META_APP_SECRET: obrigatoria('META_APP_SECRET'),
    WHATSAPP_VERIFY_TOKEN: obrigatoria('WHATSAPP_VERIFY_TOKEN'),
    WHATSAPP_TOKEN: obrigatoria('WHATSAPP_TOKEN'),
    WHATSAPP_PHONE_NUMBER_ID: obrigatoria('WHATSAPP_PHONE_NUMBER_ID'),
    DATABASE_URL: obrigatoria('DATABASE_URL'),
    // Sem barra no fim: quem monta o caminho concatena, e `//agendamentos` vira 404.
    CALENDARIO_URL: (fonte.CALENDARIO_URL?.trim() || CALENDARIO_PADRAO).replace(/\/+$/, ''),
    CALENDARIO_WEBHOOK_TOKEN: fonte.CALENDARIO_WEBHOOK_TOKEN?.trim() ?? '',
    PAINEL_TOKEN: fonte.PAINEL_TOKEN?.trim() ?? '',
    PORT: Number(fonte.PORT ?? 3000),
  };

  if (faltando.length > 0) {
    throw new Error(
      `Variaveis de ambiente faltando: ${faltando.join(', ')}.\n` +
        `Copie BARBEARIA/.env.example para BARBEARIA/.env e preencha.`,
    );
  }

  if (!Number.isInteger(env.PORT) || env.PORT <= 0) {
    throw new Error(`PORT invalida: ${fonte.PORT}`);
  }

  // URL torta so daria sintoma no primeiro cliente que tocasse num barbeiro, e o
  // sintoma seria "a agenda esta fora do ar" — mensagem que aponta pro lugar errado.
  try {
    new URL(env.CALENDARIO_URL);
  } catch {
    throw new Error(`CALENDARIO_URL invalida: ${env.CALENDARIO_URL}`);
  }

  return env;
}
