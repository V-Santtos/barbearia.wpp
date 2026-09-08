/**
 * O registro das seções do painel. Uma lista só, ordenada.
 *
 * O rail NÃO conhece nenhuma seção pelo nome — ele itera esta lista. É o que
 * faz "adicionar o Financeiro" ser uma linha aqui em vez de uma edição no
 * componente de navegação.
 *
 * Ícones: cobertura de conceitos vinda do template shadcn, mas escolhendo a
 * **variante redonda** do lucide onde ela existe. A regra tem motivo: o
 * conjunto do template é retilíneo (`MessageSquare`, `LayoutDashboard`,
 * `Banknote`) e este app é o contrário — "Criar" é pílula, FAB e avatar são
 * círculos, painéis têm canto de 28px. Decidido com o dono em 2026-09-08.
 *
 * `Coins` no Financeiro e não `CircleDollarSign` porque o segundo é cifrão de
 * dólar, e a barbearia cobra em real.
 */
import { CalendarDays, Coins, Gauge, MessageCircleMore } from "lucide-react";
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
    Icone: CalendarDays,
    temPainel: true,
    pronta: true,
  },
  {
    id: "conversas",
    rotulo: "Conversas",
    Icone: MessageCircleMore,
    temPainel: true,
    pronta: false,
  },
  {
    id: "dashboard",
    rotulo: "Dashboard",
    Icone: Gauge,
    temPainel: false,
    pronta: false,
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    Icone: Coins,
    temPainel: true,
    pronta: false,
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
