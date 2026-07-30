export type Env = {
  META_APP_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
  PORT: number;
};

// ponytail: validacao manual de env, sem zod. Teto: ~6 variaveis. Gatilho de
// upgrade: quando passar disso ou quando alguma precisar de coercao/formato
// (URL, enum), trocar por um schema.
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
