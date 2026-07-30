export type Env = {
  META_APP_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  DATABASE_URL: string;
  PORT: number;
};

// ponytail: validacao manual de env, sem zod. Estamos EM CIMA do teto declarado
// (6 variaveis). Gatilho de upgrade: a proxima variavel que precisar de coercao ou
// formato (URL, enum, numero com faixa) troca isto por um schema.
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

  return env;
}
