/**
 * Os quatro cartões da faixa de resumo.
 *
 * O rótulo diz A COISA; o período quem diz é o chip. Por isso "Agendamentos" e
 * não "Agendamentos hoje" — repetir o período em cada card era eco do filtro, e
 * ficava ambíguo com a "Agenda de hoje" logo abaixo, que é o único painel onde
 * "hoje" informa, porque ele ignora o chip.
 */
import type { AgregadoDashboard, PeriodoDashboard } from "../../services/calendarApi";
import { plural, type ProfVm } from "./modelo";

export interface CartaoKpi {
  chave: string;
  label: string;
  value: string | number;
  sub: string;
  destaque?: boolean;
}

const DIAS_DO_PERIODO: Record<PeriodoDashboard, number> = {
  hoje: 1,
  "7d": 7,
  "15d": 15,
  "30d": 30,
};

const media = (total: number, dias: number) =>
  (total / dias).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

export function montarKpis(
  ag: AgregadoDashboard,
  periodo: PeriodoDashboard,
  profsEmCena: ProfVm[],
): CartaoKpi[] {
  const dias = DIAS_DO_PERIODO[periodo];
  const ehHoje = periodo === "hoje";

  return [
    {
      chave: "agendamentos",
      label: "Agendamentos",
      value: ag.agendamentos.total,
      sub: ehHoje
        ? [
            plural(ag.agendamentos.concluidos, "concluído", "concluídos"),
            plural(ag.agendamentos.ativos, "ativo", "ativos"),
            plural(ag.agendamentos.cancelados, "cancelado", "cancelados"),
          ].join(" · ")
        : `média ${media(ag.agendamentos.total, dias)}/dia`,
    },
    {
      chave: "ocupacao",
      label: "Ocupação",
      value: `${ag.ocupacao.pct}%`,
      // "2 profissionais ativos" já esteve escrito à mão aqui, e viraria mentira
      // no dia que entrasse um terceiro.
      sub:
        profsEmCena.length === 1
          ? profsEmCena[0].short
          : plural(
              ag.ocupacao.profissionais,
              "profissional ativo",
              "profissionais ativos",
            ),
    },
    {
      chave: "livres",
      label: "Horários livres",
      value: ag.livres.total,
      // Este é o único dos quatro que olha para FRENTE, e o rótulo tem que dizer
      // isso: horário livre que já passou não existe, então contá-lo para trás
      // seria inventar estoque que ninguém pode vender.
      sub: ehHoje
        ? `de ${ag.livres.capacidade} horários no dia`
        : `nos próximos ${dias} dias`,
    },
    {
      chave: "marcacoes",
      label: "Novas marcações",
      value: ag.marcacoes.total,
      // Vem de `created_at`, não de `dia_marcado`: conta quantas vezes alguém
      // marcou, não quantos atendimentos o dia tem. É o único número da tela que
      // cai na hora se o bot parar de pé.
      sub: ehHoje
        ? "entraram hoje"
        : `média ${media(ag.marcacoes.total, dias)}/dia`,
      destaque: true,
    },
  ];
}

export const OPCOES_PERIODO: { value: PeriodoDashboard; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
];

export function rotuloDoPeriodo(
  periodo: PeriodoDashboard,
  hojeISO: string,
): string {
  if (periodo !== "hoje") {
    return `Últimos ${DIAS_DO_PERIODO[periodo]} dias`;
  }
  const [ano, mes, dia] = hojeISO.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const mesCurto = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `Hoje, ${diaSemana} · ${dia} ${mesCurto}`;
}
