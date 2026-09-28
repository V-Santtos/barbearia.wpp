/**
 * O painel está rodando sobre o mundo de teste (`VITE_MOCK=1`)?
 *
 * A regra da casca é que a interface NÃO conheça o mock: a troca de dado acontece no
 * transporte, em `services/calendarApi.ts`. Esta constante é a exceção, e existe para
 * uma coisa só — **conteúdo de demonstração escrito na própria tela**, que o
 * transporte não alcança: as conversas-exemplo da lateral, os cards-exemplo da noite
 * e as movimentações demonstrativas do Financeiro.
 *
 * Até 28/09/2026 esses exemplos apareciam sempre, e só faziam sentido enquanto não
 * havia dado real. Com o painel contra o banco de verdade, um dono sem conversas veria
 * "Maria Silva (exemplo)" e um card falso na agenda da noite dele. Aqui eles ficam
 * restritos ao modo de teste, onde o desenho continua visível para quem lapida a tela.
 *
 * Um lugar só, e não `import.meta.env.VITE_MOCK` repetido em cada tela: três cópias da
 * mesma condição divergem — foi assim que o Financeiro desligou as receitas-exemplo
 * fora do mock e esqueceu as despesas.
 */
export const MODO_DEMONSTRACAO = (import.meta.env.VITE_MOCK ?? "").trim() === "1";
