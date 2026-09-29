/**
 * De qual barbearia é este site — o primeiro segmento do caminho.
 *
 *   /lucas-costa           -> página inicial da Barbearia Lucas Costa
 *   /lucas-costa/agendar   -> agendamento dela
 *
 * Um mesmo site atende todas as barbearias do sistema; a API exige saber de qual
 * delas cada chamada fala, e responde 400 sem isso (`noSite()` em
 * `CALENDARIO/server.js`).
 *
 * CAMINHO, e não subdomínio, por ora (decisão de 29/09/2026): funciona localmente sem
 * configurar DNS, e deixa testar duas lojas na mesma porta. Subdomínio pode vir quando
 * houver domínio próprio — a API não muda, só esta função.
 *
 * SEM PADRÃO. Sem barbearia no caminho, a resposta é `null` e o site mostra que falta
 * a barbearia — nunca cai numa loja escolhida no escuro. Um padrão silencioso é o
 * mesmo defeito que a API recusa: quem esquecesse o slug atenderia a loja errada.
 */
export function barbeariaAtual(): string | null {
  const primeiro = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  const slug = decodeURIComponent(primeiro).trim().toLowerCase();
  // `agendar` é rota, não barbearia: o endereço antigo `/agendar`, sem slug, não pode
  // ser lido como uma loja chamada "agendar".
  return slug && slug !== "agendar" ? slug : null;
}

/** O caminho dentro da barbearia atual: `caminhoDaLoja("/agendar")` -> `/lucas-costa/agendar`. */
export function caminhoDaLoja(dentro = "/"): string {
  const slug = barbeariaAtual();
  const resto = dentro === "/" ? "" : dentro;
  return slug ? `/${slug}${resto}` : dentro;
}
