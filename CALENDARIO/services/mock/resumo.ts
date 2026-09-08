/**
 * O `GET /dashboard/resumo`, calculado a partir do MESMO mundo que o calendário
 * desenha — nunca inventado à parte.
 *
 * É o ponto inteiro deste arquivo existir em vez de um objeto escrito à mão: se
 * o dashboard dissesse "17 agendamentos hoje" e o calendário mostrasse 3, o
 * teste visual estaria mentindo justamente sobre a coisa que o dashboard
 * existe para fazer. Contar aqui, do mesmo array, é o que mantém as duas telas
 * de acordo.
 *
 * As contas seguem o contrato que o `kpis.ts` assume, que não é uniforme e vale
 * anotar: `agendamentos`, `ocupacao` e `marcacoes` olham para TRÁS ("Últimos 7
 * dias"), enquanto `livres` olha para FRENTE ("nos próximos 7 dias"). Horário
 * livre que já passou não é estoque.
 */
import type {
  AgregadoDashboard,
  DashboardResumo,
  EstadoDoDia,
  LinhaAgendaDashboard,
  PeriodoDashboard,
  ProfissionalDashboard,
} from "../calendarApi";
import {
  MOLDES,
  gradeDoDia,
  hhmm,
  iso,
  moldeDe,
  mundo,
} from "./mundo";

const DIAS_DO_PERIODO: Record<PeriodoDashboard, number> = {
  hoje: 1,
  "7d": 7,
  "15d": 15,
  "30d": 30,
};

/** Cancelado devolve o horário para a grade: continua vendável. */
const OCUPA = (status: string) => status !== "cancelado";

function somarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Capacidade de um dia: quantos slots existem, somando os profissionais. */
function capacidadeDoDia(dia: Date, profIds: number[]): number {
  const wd = dia.getDay();
  return profIds.reduce((soma, id) => {
    const m = moldeDe(id);
    return soma + (m ? gradeDoDia(m, wd).length : 0);
  }, 0);
}

function bloqueadoEm(dataISO: string): boolean {
  return mundo.bloqueios.some((b) => b.data === dataISO && !b.periodos);
}

function agregarJanela(
  profIds: number[],
  inicio: Date,
  dias: number,
  livresFrente: number,
  capacidadeHoje: number,
  ehHoje: boolean,
): AgregadoDashboard {
  const datas: string[] = [];
  let capacidade = 0;
  for (let i = 0; i < dias; i += 1) {
    const d = somarDias(inicio, ehHoje ? i : -i);
    datas.push(iso(d));
    capacidade += capacidadeDoDia(d, profIds);
  }
  const dentro = new Set(datas);

  const linhas = mundo.agendamentos.filter(
    (a) => dentro.has(a.dia_marcado) && profIds.includes(a.professional_id),
  );
  const total = linhas.length;
  const cancelados = linhas.filter((a) => a.status === "cancelado").length;
  const concluidos = linhas.filter((a) => a.status === "concluido").length;
  const ativos = total - cancelados - concluidos;
  const ocupados = linhas.filter((a) => OCUPA(a.status)).length;

  // `created_at` responde "quantas vezes alguém marcou", não "quantos
  // atendimentos o dia tem". É o único número da tela que cai na hora se o bot
  // parar de pé — por isso conta pela data de criação, não pela do atendimento.
  const marcacoes = mundo.agendamentos.filter(
    (a) =>
      profIds.includes(a.professional_id) &&
      dentro.has(a.created_at.slice(0, 10)),
  ).length;

  return {
    agendamentos: { total, concluidos, cancelados, ativos },
    ocupacao: {
      pct: capacidade ? Math.round((ocupados / capacidade) * 100) : 0,
      capacidade,
      ocupados,
      profissionais: profIds.length,
    },
    livres: ehHoje
      ? { total: livresFrente, capacidade: capacidadeHoje }
      : { total: livresNaFrente(profIds, dias), capacidade: capacidadeNaFrente(profIds, dias) },
    marcacoes: { total: marcacoes },
  };
}

function capacidadeNaFrente(profIds: number[], dias: number): number {
  let soma = 0;
  for (let i = 0; i < dias; i += 1) {
    soma += capacidadeDoDia(somarDias(mundo.hoje, i), profIds);
  }
  return soma;
}

function livresNaFrente(profIds: number[], dias: number): number {
  const agora = new Date();
  const agoraDec = agora.getHours() + agora.getMinutes() / 60;
  let soma = 0;

  for (let i = 0; i < dias; i += 1) {
    const dia = somarDias(mundo.hoje, i);
    const dataISO = iso(dia);
    if (bloqueadoEm(dataISO)) continue;
    const wd = dia.getDay();

    for (const id of profIds) {
      const m = moldeDe(id);
      if (!m) continue;
      const ocupados = new Set(
        mundo.agendamentos
          .filter(
            (a) =>
              a.dia_marcado === dataISO &&
              a.professional_id === id &&
              OCUPA(a.status),
          )
          .map((a) => a.hora_marcada),
      );
      soma += gradeDoDia(m, wd).filter(
        (s) => !ocupados.has(hhmm(s)) && (i > 0 || s >= agoraDec),
      ).length;
    }
  }
  return soma;
}

export function montarResumoDoMundo(dataISO: string): DashboardResumo {
  const agora = new Date();
  const agoraDec = agora.getHours() + agora.getMinutes() / 60;
  const wdHoje = new Date(`${dataISO}T12:00:00`).getDay();

  const profissionais: ProfissionalDashboard[] = MOLDES.map((m) => {
    const grade = gradeDoDia(m, wdHoje);
    const ocupados = new Set(
      mundo.agendamentos
        .filter(
          (a) =>
            a.dia_marcado === dataISO &&
            a.professional_id === m.id &&
            OCUPA(a.status),
        )
        .map((a) => a.hora_marcada),
    );
    const livres = grade.filter((s) => !ocupados.has(hhmm(s)) && s >= agoraDec);

    return {
      id: m.id,
      nome: m.nome,
      cor: m.cor,
      expediente: {
        inicio: hhmm(m.inicio),
        fim: hhmm(m.fim),
        duracao_min: m.duracaoMin,
        intervalo_inicio: hhmm(m.intervaloIni),
        intervalo_duracao_min: m.intervaloMin,
      },
      janela_dias: 14,
      grade_hoje: grade.map(hhmm),
      capacidade_hoje: grade.length,
      livres_hoje: livres.map(hhmm),
    };
  });

  const agenda: LinhaAgendaDashboard[] = mundo.agendamentos
    .filter((a) => a.dia_marcado === dataISO)
    .map((a) => ({
      id: a.id,
      professional_id: a.professional_id,
      hora: a.hora_marcada,
      duracao_min: a.duracao_min,
      cliente: a.cliente,
      telefone: a.telefone,
      status: a.status,
      source: a.source,
    }));

  // ── Disponibilidade dos próximos 14 dias ───────────────────────────────────
  const JANELA = 14;
  const dias: { data: string; wd: number; hoje: boolean }[] = [];
  const vagas: Record<string, EstadoDoDia[]> = {};
  for (const m of MOLDES) vagas[String(m.id)] = [];

  for (let i = 0; i < JANELA; i += 1) {
    const d = somarDias(mundo.hoje, i);
    const dataDia = iso(d);
    const wd = d.getDay();
    dias.push({ data: dataDia, wd, hoje: i === 0 });

    for (const m of MOLDES) {
      const grade = gradeDoDia(m, wd);
      let estado: EstadoDoDia;

      if (!grade.length) {
        estado = { tipo: "fechado" };
      } else if (bloqueadoEm(dataDia)) {
        estado = { tipo: "bloqueio" };
      } else {
        const ocupados = new Set(
          mundo.agendamentos
            .filter(
              (a) =>
                a.dia_marcado === dataDia &&
                a.professional_id === m.id &&
                OCUPA(a.status),
            )
            .map((a) => a.hora_marcada),
        );
        const livres = grade.filter(
          (s) => !ocupados.has(hhmm(s)) && (i > 0 || s >= agoraDec),
        ).length;
        estado = livres ? { tipo: "vagas", vagas: livres } : { tipo: "lotado", vagas: 0 };
      }
      vagas[String(m.id)].push(estado);
    }
  }

  // ── Períodos ───────────────────────────────────────────────────────────────
  const todosIds = MOLDES.map((m) => m.id);
  const capacidadeHojeTotal = profissionais.reduce(
    (s, p) => s + p.capacidade_hoje,
    0,
  );
  const livresHojeTotal = profissionais.reduce(
    (s, p) => s + p.livres_hoje.length,
    0,
  );

  const periodos = {} as DashboardResumo["periodos"];
  (Object.keys(DIAS_DO_PERIODO) as PeriodoDashboard[]).forEach((p) => {
    const n = DIAS_DO_PERIODO[p];
    const ehHoje = p === "hoje";
    const porProf: Record<string, AgregadoDashboard> = {};

    for (const prof of profissionais) {
      porProf[String(prof.id)] = agregarJanela(
        [prof.id],
        mundo.hoje,
        n,
        prof.livres_hoje.length,
        prof.capacidade_hoje,
        ehHoje,
      );
    }

    periodos[p] = {
      ...porProf,
      all: agregarJanela(
        todosIds,
        mundo.hoje,
        n,
        livresHojeTotal,
        capacidadeHojeTotal,
        ehHoje,
      ),
    };
  });

  return {
    gerado_em: new Date().toISOString(),
    hoje: dataISO,
    profissionais,
    agenda,
    disponibilidade: { dias, vagas },
    periodos,
  };
}
