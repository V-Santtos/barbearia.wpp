import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A sessão do dono. Único lugar do painel que fala com o Supabase Auth.
 *
 * Antes de 09/2026 o "login" comparava duas strings que o Vite embutia no bundle
 * (`VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD`), e o acesso à API era um
 * `VITE_ADMIN_API_TOKEN` — também no bundle. Qualquer pessoa com a URL e o DevTools
 * aberto entrava. O login era enfeite: não havia nada para burlar.
 *
 * Agora quem valida é o Supabase, e o que a API recebe é um JWT assinado, ligado a
 * um usuário, que o Postgres usa para cobrar a barbearia via RLS.
 *
 * ── O MODO LEGADO ────────────────────────────────────────────────────────────
 *
 * Sem `VITE_SUPABASE_URL` o painel volta ao comportamento antigo. Existe pela mesma
 * razão do lado do servidor: deploy e configuração são gestos separados aqui (Vercel
 * por CLI manual), e um painel que exigisse Supabase no instante do deploy ficaria
 * fora do ar até a última variável entrar.
 *
 * TEM DATA PRA MORRER: sai junto com o ramo legado do `lib/autenticacao.js`, assim
 * que o modo JWT estiver de pé.
 */

const URL_SUPABASE = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const CHAVE_SUPABASE = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const TOKEN_LEGADO = (import.meta.env.VITE_ADMIN_API_TOKEN ?? "").trim();

export const MODO_JWT = Boolean(URL_SUPABASE && CHAVE_SUPABASE);

export const supabase: SupabaseClient | null = MODO_JWT
  ? createClient(URL_SUPABASE, CHAVE_SUPABASE, {
      auth: {
        // A sessão sobrevive a recarga e o token se renova sozinho — é o que evita
        // o dono ser deslogado no meio do expediente quando o access token vence.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/* `name`/`email`, e não `nome`: é o formato que o `OwnerSession` do painel já usa,
   e traduzir na fronteira sairia mais caro que aceitar a chave em inglês aqui. */
export type Dono = { name: string; email: string };

export function donoDaSessao(sessao: Session | null): Dono | null {
  if (!sessao?.user) return null;
  return {
    name: (sessao.user.user_metadata?.nome as string | undefined) ?? "Proprietário",
    email: sessao.user.email ?? "",
  };
}

/**
 * O cabeçalho `Authorization` da próxima chamada à API.
 *
 * `getSession()` devolve o que está em memória e só vai à rede quando o token está
 * perto de vencer — então chamar isto a cada requisição não custa viagem.
 *
 * Devolve `{}` quando não há sessão: a chamada segue sem credencial e a API responde
 * 401. Mandar sem token e deixar o servidor recusar é melhor que adivinhar aqui —
 * quem decide o que é autorizado é um lado só.
 */
export async function credencial(): Promise<Record<string, string>> {
  if (!MODO_JWT) {
    return TOKEN_LEGADO ? { Authorization: `Bearer ${TOKEN_LEGADO}` } : {};
  }

  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function entrar(email: string, senha: string): Promise<void> {
  if (!MODO_JWT) throw new Error("Login não configurado: falta VITE_SUPABASE_URL.");

  const { error } = await supabase!.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function sair(): Promise<void> {
  if (MODO_JWT) await supabase!.auth.signOut();
}
