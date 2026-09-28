/**
 * Telefone: um formato no banco, outro na tela (2026-09-26, com o dono).
 *
 * - **No banco** fica o número canônico: só dígitos, com o DDI na frente
 *   (`5533990223209`) -- o mesmo formato do `wa_id` que o bot do WhatsApp usa.
 * - **Na tela** aparece só DDD + número (`(33) 99022-3209`). Quase todo cliente
 *   é do Brasil, então o 55 não precisa aparecer.
 *
 * Número digitado com 10 ou 11 dígitos é brasileiro e ganha o 55. Número que
 * já chega com DDI (12 ou 13 dígitos começando em 55) fica como está. Qualquer
 * outra coisa é tratada como estrangeira e guardada como veio.
 *
 * O `server.js` repete `variantesDeBusca` em JavaScript puro (ele não importa
 * TypeScript). Mudar a regra aqui é mudar lá.
 */

const soDigitos = (valor: string) => String(valor ?? "").replace(/\D/g, "");

/** É um celular/fixo brasileiro já com DDI? (55 + DDD + 8 ou 9 dígitos) */
function eBrasileiroComDdi(digitos: string): boolean {
  return digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13);
}

/** O número como deve ser gravado. Vazio continua vazio. */
export function paraCanonico(valor: string): string {
  const digitos = soDigitos(valor);
  if (!digitos) return "";
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/**
 * Formas do mesmo número para procurar no banco. Número antigo de celular às
 * vezes chega do WhatsApp SEM o nono dígito (`553384246770`, 12 dígitos); o
 * mesmo cliente digitado hoje tem 13. Sem procurar as duas formas, o cliente
 * antigo nunca é reconhecido.
 */
export function variantesDeBusca(valor: string): string[] {
  const canonico = paraCanonico(valor);
  if (!canonico) return [];
  const variantes = new Set([canonico]);
  if (eBrasileiroComDdi(canonico)) {
    const ddd = canonico.slice(2, 4);
    const resto = canonico.slice(4);
    if (resto.length === 9 && resto.startsWith("9")) variantes.add(`55${ddd}${resto.slice(1)}`);
    if (resto.length === 8) variantes.add(`55${ddd}9${resto}`);
  }
  return [...variantes];
}

/**
 * Máscara de exibição, a partir do que estiver gravado (canônico, com máscara
 * antiga ou só DDD + número). Brasileiro sai sem o 55; estrangeiro sai com `+`.
 */
export function formatarTelefone(valor: string): string {
  const digitos = soDigitos(valor);
  if (!digitos) return "";
  const nacional = eBrasileiroComDdi(digitos) ? digitos.slice(2) : digitos;
  if (nacional.length === 11) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return `+${digitos}`;
}

/** DDD + número, sem máscara -- o que o campo do formulário edita. */
export function paraNacional(valor: string): string {
  const digitos = soDigitos(valor);
  return eBrasileiroComDdi(digitos) ? digitos.slice(2) : digitos;
}
