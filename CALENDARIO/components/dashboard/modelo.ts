/**
 * A tradução entre o que a API devolve e o que a tela desenha.
 *
 * O protótipo trabalhava em horas decimais (8.5 = 08:30) porque é o que fecha
 * conta e vira ângulo sem gambiarra de string — o relógio inteiro depende disso.
 * A API fala "HH:MM", que é o formato do banco. A conversão mora aqui, num lugar
 * só, e nenhum componente volta a fazê-la.
 *
 * O que este arquivo NÃO faz: decidir quais horários existem. Isso é regra de
 * agenda, vem pronto do servidor (`grade_hoje`, `livres_hoje`, `vagas`), e
 * refazer aqui seria a terceira implementação da mesma conta.
 */
import type {
  DashboardResumo,
  EstadoDoDia,
  LinhaAgendaDashboard,
  ProfissionalDashboard,
} from "../../services/calendarApi";

export type StatusLinha =
  | "agendado"
  | "confirmado"
  | "reagendado"
  | "concluido"
  | "cancelado"
  | "em-atendimento";

export interface ProfVm {
  id: number;
  name: string;
  /** Primeiro e último nome; é o que cabe nas colunas estreitas. */
  short: string;
  color: string;
  expediente: { inicio: number; fim: number; dur: number };
  intervalo: { ini: number; fim: number } | null;
  janela: number;
  capacidade: number;
  /** Toda a grade do dia, em horas decimais. */
  slots: { ini: number; fim: number }[];
  /** Os inícios que estão vagos — subconjunto de `slots`. */
  livres: number[];
}

export interface LinhaVm {
  id: number;
  profId: number;
  hora: string;
  ini: number;
  fim: number;
  duracao: number;
  cliente: string;
  telefone: string;
  status: StatusLinha;
}

export interface DiaVm {
  data: string;
  wd: number;
  /** O número do dia, como a coluna escreve: "20". */
  dd: string;
  hoje: boolean;
}

export interface DashboardVm {
  hoje: string;
  agora: number;
  geradoEm: number;
  profs: ProfVm[];
  janelaDia: { ini: number; fim: number };
  agenda: LinhaVm[];
  dias: DiaVm[];
  vagas: Record<number, EstadoDoDia[]>;
}

export const WD_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WD_LONGO = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/** "08:30" → 8.5 */
export function paraDecimal(hhmmStr: string): number {
  const [h, m] = String(hhmmStr).split(":").map(Number);
  return h + (m || 0) / 60;
}

/** 8.5 → "08:30" */
export function hhmm(t: number): string {
  const h = Math.floor(t + 1e-9);
  const m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function nomeCurto(nome: string): string {
  const partes = String(nome ?? "").trim().split(/\s+/);
  if (partes.length <= 2) return partes.join(" ");
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

function montarProf(p: ProfissionalDashboard): ProfVm {
  const inicio = paraDecimal(p.expediente.inicio);
  const fim = paraDecimal(p.expediente.fim);
  const passo = p.expediente.duracao_min / 60;
  const intervaloIni = p.expediente.intervalo_inicio
    ? paraDecimal(p.expediente.intervalo_inicio)
    : null;

  return {
    id: p.id,
    name: p.nome,
    short: nomeCurto(p.nome),
    color: p.cor || "#888888",
    expediente: { inicio, fim, dur: p.expediente.duracao_min },
    intervalo:
      intervaloIni !== null && p.expediente.intervalo_duracao_min
        ? {
            ini: intervaloIni,
            fim: intervaloIni + p.expediente.intervalo_duracao_min / 60,
          }
        : null,
    janela: p.janela_dias,
    capacidade: p.capacidade_hoje,
    slots: p.grade_hoje.map((s) => {
      const ini = paraDecimal(s);
      return { ini, fim: ini + passo };
    }),
    livres: p.livres_hoje.map(paraDecimal),
  };
}

/**
 * `em-atendimento` não existe no banco: é `agendado` cujo horário já começou e
 * ainda não terminou. Derivar aqui, do relógio de quem olha, é o que faz a
 * linha acender sozinha sem ninguém escrever nada — e some sozinha depois.
 */
function statusDaLinha(
  linha: LinhaAgendaDashboard,
  ini: number,
  fim: number,
  agora: number,
): StatusLinha {
  const bruto = (linha.status ?? "agendado") as StatusLinha;
  if (bruto === "cancelado" || bruto === "concluido" || bruto === "reagendado") {
    return bruto;
  }
  if (agora >= ini && agora < fim) return "em-atendimento";
  return bruto;
}

export function montarVm(
  dados: DashboardResumo,
  agoraDate = new Date(),
): DashboardVm {
  const profs = dados.profissionais.map(montarProf);
  const porId = new Map(profs.map((p) => [p.id, p]));
  const agora = agoraDate.getHours() + agoraDate.getMinutes() / 60;

  // A volta do relógio vai do começo do mais madrugador ao fim do mais noturno,
  // sempre sobre TODOS os barbeiros — nunca só os filtrados. Assim filtrar num
  // profissional tira um anel sem mexer a posição das horas; se a escala
  // encolhesse junto, o mesmo horário mudaria de lugar a cada clique.
  const janelaDia = profs.length
    ? {
        ini: Math.min(...profs.map((p) => p.expediente.inicio)),
        fim: Math.max(...profs.map((p) => p.expediente.fim)),
      }
    : { ini: 8, fim: 20 };

  const agenda: LinhaVm[] = dados.agenda
    .map((a) => {
      const ini = paraDecimal(a.hora);
      const fim = ini + a.duracao_min / 60;
      return {
        id: a.id,
        profId: a.professional_id,
        hora: a.hora,
        ini,
        fim,
        duracao: a.duracao_min,
        cliente: a.cliente ?? "Sem nome",
        telefone: a.telefone ?? "",
        status: statusDaLinha(a, ini, fim, agora),
      };
    })
    .filter((a) => porId.has(a.profId));

  const dias: DiaVm[] = dados.disponibilidade.dias.map((d) => ({
    data: d.data,
    wd: d.wd,
    dd: String(Number(d.data.slice(8, 10))),
    hoje: d.hoje,
  }));

  const vagas: Record<number, EstadoDoDia[]> = {};
  for (const [chave, lista] of Object.entries(dados.disponibilidade.vagas)) {
    vagas[Number(chave)] = lista;
  }

  return {
    hoje: dados.hoje,
    agora,
    geradoEm: new Date(dados.gerado_em).getTime(),
    profs,
    janelaDia,
    agenda,
    dias,
    vagas,
  };
}

/**
 * Os dois próximos encaixes de um barbeiro: as vagas de hoje que ainda não
 * passaram. Quando o dia acaba, o próximo encaixe é o começo do expediente de
 * amanhã — o único caso que o relógio não consegue mostrar, e a razão de este
 * painel continuar existindo ao lado dele.
 */
export function proximosLivres(prof: ProfVm, agora: number, vagasAmanha: EstadoDoDia | undefined): string[] {
  const hoje = prof.livres
    .filter((ini) => ini >= agora)
    .sort((a, b) => a - b)
    .map((ini) => `Hoje ${hhmm(ini)}`);
  if (hoje.length >= 2) return hoje.slice(0, 2);

  const temAmanha =
    vagasAmanha?.tipo === "vagas" && vagasAmanha.vagas > 0
      ? [`Amanhã ${hhmm(prof.expediente.inicio)}`]
      : [];
  return [...hoje, ...temAmanha].slice(0, 2);
}
