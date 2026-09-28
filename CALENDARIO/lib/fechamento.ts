import type { ConfiguredService } from "../services/calendarApi";

/**
 * Fechamento do atendimento (spec 2026-09-27-fechar-atendimento-design).
 * Tudo em reais; as somas passam por centavos inteiros para não acumular erro
 * de ponto flutuante.
 */

export type TipoAjuste = "acrescimo" | "desconto";

export interface AjusteDeValor {
  tipo: TipoAjuste;
  valor: number;
  motivo?: string;
}

export interface ServicoDoAtendimento {
  servicoId?: number;
  nome: string;
  /** Preço do dia da conclusão. */
  preco: number;
}

export interface FechamentoDoAtendimento {
  servicos: ServicoDoAtendimento[];
  ajuste: AjusteDeValor | null;
  total: number;
  concluidoEm: string;
}

export interface ClientePresencial {
  nome: string;
  telefone: string;
}

// Vírgula, e não " + ": nomes de combo já usam "+" ("Corte + Barba").
const SEPARADOR = ", ";

export function separarServicos(texto: string | null | undefined): string[] {
  return String(texto ?? "")
    .split(",")
    .map((nome) => nome.trim())
    .filter(Boolean);
}

export function juntarServicos(nomes: string[]): string {
  return nomes.map((nome) => nome.trim()).filter(Boolean).join(SEPARADOR);
}

/** O catálogo guarda texto ("35", "R$ 15,00"); o que não for número vale 0. */
export function precoDoCatalogo(preco: string | undefined): number {
  const limpo = String(preco ?? "").replace(/[^\d.,]/g, "");
  if (!limpo) return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function chave(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("pt-BR");
}

/** Nome fora da tabela entra com preço 0, para o barbeiro ver e trocar. */
export function itensDoCatalogo(
  nomes: string[],
  catalogo: ConfiguredService[],
): ServicoDoAtendimento[] {
  return nomes.map((nome) => {
    const achado = catalogo.find((opcao) => chave(opcao.name) === chave(nome));
    if (!achado) return { nome, preco: 0 };
    return {
      ...(achado.id !== undefined && { servicoId: Number(achado.id) }),
      nome: achado.name,
      preco: precoDoCatalogo(achado.price),
    };
  });
}

const centavos = (valor: number) => Math.round((Number.isFinite(valor) ? valor : 0) * 100);

export function calcularTotais(
  servicos: ServicoDoAtendimento[],
  ajuste: AjusteDeValor | null,
): { subtotal: number; total: number } {
  const subtotal = servicos.reduce((soma, item) => soma + centavos(item.preco), 0);
  const delta = ajuste ? centavos(ajuste.valor) * (ajuste.tipo === "desconto" ? -1 : 1) : 0;
  return { subtotal: subtotal / 100, total: (subtotal + delta) / 100 };
}

export function validarFechamento(entrada: {
  servicos: ServicoDoAtendimento[];
  ajuste: AjusteDeValor | null;
  cliente?: ClientePresencial | null;
}): Record<string, string> {
  const erros: Record<string, string> = {};
  if (entrada.servicos.length === 0) erros.servicos = "Selecione pelo menos um serviço.";

  if (entrada.ajuste) {
    const { subtotal } = calcularTotais(entrada.servicos, null);
    if (centavos(entrada.ajuste.valor) <= 0) erros.ajuste = "Informe o valor do ajuste.";
    else if (entrada.ajuste.tipo === "desconto" && centavos(entrada.ajuste.valor) > centavos(subtotal)) {
      erros.ajuste = "O desconto não pode passar do subtotal.";
    }
  }

  const digitos = String(entrada.cliente?.telefone ?? "").replace(/\D/g, "");
  if (digitos && (digitos.length < 10 || digitos.length > 11)) erros.telefone = "Telefone incompleto.";

  return erros;
}
