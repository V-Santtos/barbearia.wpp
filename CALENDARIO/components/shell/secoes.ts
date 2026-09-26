/**
 * O registro das seções do painel. Uma lista só, ordenada.
 *
 * O rail NÃO conhece nenhuma seção pelo nome — ele itera esta lista. É o que
 * faz "adicionar o Financeiro" ser uma linha aqui em vez de uma edição no
 * componente de navegação.
 *
 * Ícones: o conjunto do template shadcn, tal como ele é — retilíneo e no
 * mesmo par de números da referência (16px, traço 2, sem variação entre ativo
 * e inativo). A regra da "variante redonda" foi revertida com o dono em
 * 2026-09-08: o objetivo passou a ser o minimalismo da sidebar do Studio
 * Admin, e ali o peso vem do tamanho pequeno, não do traço fino.
 *
 * Cada seção pega o ícone do item equivalente da referência: Calendar do
 * "Calendar", MessageSquare do "Chat", LayoutDashboard do "Default" e
 * Banknote do "Finance".
 */
import { Banknote, Calendar, LayoutDashboard, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IdSecao = "agenda" | "conversas" | "dashboard" | "financeiro";

export interface Secao {
  id: IdSecao;
  rotulo: string;
  Icone: LucideIcon;
  /** Seção sem painel não abre gaveta — o Dashboard usa a largura toda. */
  temPainel: boolean;
  /** Enquanto o conteúdo real não migrou para cá. */
  pronta: boolean;
}

export const SECOES: Secao[] = [
  {
    id: "agenda",
    rotulo: "Agenda",
    Icone: Calendar,
    temPainel: true,
    pronta: true,
  },
  {
    id: "conversas",
    rotulo: "Conversas",
    Icone: MessageSquare,
    temPainel: false,
    pronta: true,
  },
  {
    id: "dashboard",
    rotulo: "Dashboard",
    Icone: LayoutDashboard,
    temPainel: false,
    pronta: true,
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    Icone: Banknote,
    /* Gráficos e tabela precisam da largura de trabalho. Não existe ainda
       contexto lateral legítimo que justifique roubar 288px desta seção. */
    temPainel: false,
    pronta: true,
  },
];

export const secaoPorId = (id: IdSecao): Secao =>
  SECOES.find((s) => s.id === id) ?? SECOES[0];

/**
 * A gaveta só abre para seção que tem painel E já tem o que colocar dentro.
 * Sem o `pronta`, entrar no Financeiro abria 288px de coluna vazia com o botão
 * "Criar" boiando sozinho — parece defeito, não obra em andamento.
 */
export const abreGaveta = (id: IdSecao): boolean => {
  const s = secaoPorId(id);
  return s.temPainel && s.pronta;
};
