import React from '../CALENDARIO/node_modules/react/index.js';
import { createRoot } from '../CALENDARIO/node_modules/react-dom/client.js';
const ReactDOM = { createRoot };

// ============================================================================
// Mock data — tudo fictício mas plausível, pt-BR.
// Estrutura: KPIS_BASE[period][profKey]
// profKey: "all" | 1 | 2
// ============================================================================

const PROFISSIONAIS = [
  { id: 1, name: "Lucas Costa", short: "Lucas Costa", color: "#3DD9B0", initials: "LC" },
  { id: 2, name: "Lucas Eloi",  short: "Lucas Eloi",  color: "#E8845A", initials: "LE" },
];
const PROF_BY_ID = Object.fromEntries(PROFISSIONAIS.map(p => [p.id, p]));

// --- KPIs [period][profKey] ---------------------------------------------------
const KPIS_BASE = {
  // `hoje` NÃO é escrito à mão: é calculado mais abaixo, depois que a agenda do
  // dia, a capacidade e as vagas existem. Escrever à mão foi o que produziu três
  // respostas diferentes para "quantos horários livres hoje" na mesma tela.
  "7d": {
    all: {
      agendamentos: { value: 184,   sub: "média 26,3/dia",                trend: "+9%",   trendDir: "up"   },
      ocupacao:     { value: "71%", sub: "pico em sábado",                trend: "+3 pp", trendDir: "up"   },
      slotsLivres:  { value: 96,    sub: "janela 7 dias",                 trend: "-18",   trendDir: "down" },
      bloqueios:    { value: 4,     sub: "no período",                    trend: "0",     trendDir: "down" },
    },
    1: {
      agendamentos: { value: 102,   sub: "média 14,6/dia",                trend: "+7%",   trendDir: "up"   },
      ocupacao:     { value: "74%", sub: "Lucas Costa",                   trend: "+2 pp", trendDir: "up"   },
      slotsLivres:  { value: 52,    sub: "janela 7 dias",                 trend: "-9",    trendDir: "down" },
      bloqueios:    { value: 2,     sub: "no período",                    trend: "0",     trendDir: "down" },
    },
    2: {
      agendamentos: { value: 82,    sub: "média 11,7/dia",                trend: "+11%",  trendDir: "up"   },
      ocupacao:     { value: "67%", sub: "Lucas Eloi",                    trend: "+4 pp", trendDir: "up"   },
      slotsLivres:  { value: 44,    sub: "janela 7 dias",                 trend: "-9",    trendDir: "down" },
      bloqueios:    { value: 2,     sub: "no período",                    trend: "0",     trendDir: "down" },
    },
  },
  "15d": {
    all: {
      agendamentos: { value: 372,   sub: "média 24,8/dia",                trend: "+14%",  trendDir: "up"   },
      ocupacao:     { value: "69%", sub: "estável",                       trend: "+1 pp", trendDir: "up"   },
      slotsLivres:  { value: 188,   sub: "janela 15 dias",                trend: "-24",   trendDir: "down" },
      bloqueios:    { value: 8,     sub: "no período",                    trend: "+2",    trendDir: "up"   },
    },
    1: {
      agendamentos: { value: 205,   sub: "média 13,7/dia",                trend: "+11%",  trendDir: "up"   },
      ocupacao:     { value: "72%", sub: "Lucas Costa",                   trend: "+2 pp", trendDir: "up"   },
      slotsLivres:  { value: 98,    sub: "janela 15 dias",                trend: "-14",   trendDir: "down" },
      bloqueios:    { value: 4,     sub: "no período",                    trend: "+1",    trendDir: "up"   },
    },
    2: {
      agendamentos: { value: 167,   sub: "média 11,1/dia",                trend: "+17%",  trendDir: "up"   },
      ocupacao:     { value: "65%", sub: "Lucas Eloi",                    trend: "+1 pp", trendDir: "up"   },
      slotsLivres:  { value: 90,    sub: "janela 15 dias",                trend: "-10",   trendDir: "down" },
      bloqueios:    { value: 4,     sub: "no período",                    trend: "+1",    trendDir: "up"   },
    },
  },
  "30d": {
    all: {
      agendamentos: { value: 798,   sub: "média 26,6/dia",                trend: "+22%",  trendDir: "up"   },
      ocupacao:     { value: "67%", sub: "tendência alta",                trend: "+4 pp", trendDir: "up"   },
      slotsLivres:  { value: 412,   sub: "janela 30 dias",                trend: "-61",   trendDir: "down" },
      bloqueios:    { value: 17,    sub: "no período",                    trend: "+5",    trendDir: "up"   },
    },
    1: {
      agendamentos: { value: 441,   sub: "média 14,7/dia",                trend: "+19%",  trendDir: "up"   },
      ocupacao:     { value: "70%", sub: "Lucas Costa",                   trend: "+3 pp", trendDir: "up"   },
      slotsLivres:  { value: 218,   sub: "janela 30 dias",                trend: "-33",   trendDir: "down" },
      bloqueios:    { value: 9,     sub: "no período",                    trend: "+3",    trendDir: "up"   },
    },
    2: {
      agendamentos: { value: 357,   sub: "média 11,9/dia",                trend: "+25%",  trendDir: "up"   },
      ocupacao:     { value: "63%", sub: "Lucas Eloi",                    trend: "+5 pp", trendDir: "up"   },
      slotsLivres:  { value: 194,   sub: "janela 30 dias",                trend: "-28",   trendDir: "down" },
      bloqueios:    { value: 8,     sub: "no período",                    trend: "+2",    trendDir: "up"   },
    },
  },
  ano: {
    all: {
      agendamentos: { value: 892,   sub: "cortes concluídos em 2026",     trend: "+18%",  trendDir: "up"   },
      ocupacao:     { value: "71%", sub: "média anual",                   trend: "+5 pp", trendDir: "up"   },
      slotsLivres:  { value: 1240,  sub: "slots totais no ano",           trend: "+22%",  trendDir: "up"   },
      bloqueios:    { value: 34,    sub: "dias bloqueados em 2026",       trend: "-8%",   trendDir: "down" },
    },
    1: {
      agendamentos: { value: 492,   sub: "cortes de Lucas Costa em 2026", trend: "+16%",  trendDir: "up"   },
      ocupacao:     { value: "73%", sub: "Lucas Costa · média anual",     trend: "+4 pp", trendDir: "up"   },
      slotsLivres:  { value: 668,   sub: "slots totais no ano",           trend: "+19%",  trendDir: "up"   },
      bloqueios:    { value: 18,    sub: "dias bloqueados em 2026",       trend: "-6%",   trendDir: "down" },
    },
    2: {
      agendamentos: { value: 400,   sub: "cortes de Lucas Eloi em 2026",  trend: "+21%",  trendDir: "up"   },
      ocupacao:     { value: "68%", sub: "Lucas Eloi · média anual",      trend: "+6 pp", trendDir: "up"   },
      slotsLivres:  { value: 572,   sub: "slots totais no ano",           trend: "+25%",  trendDir: "up"   },
      bloqueios:    { value: 16,    sub: "dias bloqueados em 2026",       trend: "-10%",  trendDir: "down" },
    },
  },
};

// --- Agenda de hoje -----------------------------------------------------------
// A agenda de hoje MORA NA SEÇÃO DA DISPONIBILIDADE, mais abaixo — ela depende
// da grade de horários de cada barbeiro, e a grade nasce de `AGENDA_CONFIG`.
// Ver `AGENDA_HOJE`, logo depois de `slotsDoDia`.

const WHATSAPP_QUEUE = [
  { nome: "Marcos Vieira",   telefone: "(11) 98•••4412", preview: "Tem horário pra hoje à tarde?",       tempo: "2h 14m", status: "aguardando", urgent: true,  cor: "#FF5000" },
  { nome: "Felipe Toledo",   telefone: "(11) 99•••0087", preview: "Pode marcar com o Lucas sexta?",       tempo: "47m",    status: "aguardando", urgent: true,  cor: "#6B3EFF" },
  { nome: "Gustavo Andrade", telefone: "(21) 98•••3320", preview: "Beleza, confirmado então ok",          tempo: "12m",    status: "humano",     urgent: false, cor: "#07FF99" },
  { nome: "Léo Magalhães",   telefone: "(11) 97•••2271", preview: "Bot: qual data você prefere?",         tempo: "8m",     status: "bot",        urgent: false, cor: "#FC00FF" },
  { nome: "Otávio Pires",    telefone: "(11) 98•••5544", preview: "Posso reagendar de quinta pra sexta?", tempo: "1h 03m", status: "aguardando", urgent: true,  cor: "#FF2A29" },
];

// Marcações que ENTRARAM no período — `created_at`, não `dia_marcado`.
// É outro eixo: "Agendamentos" conta os atendimentos do dia; este conta quantas
// vezes alguém marcou. Se o bot parar de pé, é o único número que cai na hora.
const MARCACOES = {
  hoje:  { all: { value: 7,   sub: "entraram pelo WhatsApp" }, 1: { value: 4,  sub: "entraram pelo WhatsApp" }, 2: { value: 3,  sub: "entraram pelo WhatsApp" } },
  "7d":  { all: { value: 41,  sub: "média 5,9/dia" },          1: { value: 23, sub: "média 3,3/dia" },          2: { value: 18, sub: "média 2,6/dia" } },
  "15d": { all: { value: 88,  sub: "média 5,9/dia" },          1: { value: 49, sub: "média 3,3/dia" },          2: { value: 39, sub: "média 2,6/dia" } },
  "30d": { all: { value: 179, sub: "média 6,0/dia" },          1: { value: 98, sub: "média 3,3/dia" },          2: { value: 81, sub: "média 2,7/dia" } },
};

// --- Disponibilidade ----------------------------------------------------------
// Espelha `agenda_profissional`: cada profissional tem os próprios dias de
// trabalho, a própria janela de agendamento e a própria capacidade diária —
// que nasce de hora_inicio/hora_fim/duracao_min/intervalo.
//
// Números reais do banco em 2026-07-31:
//   Costa  08:00-19:00, slot 60min, intervalo 11:00 (90min)  -> ~9 vagas/dia
//   Eloi   08:00-20:00, slot 45min, intervalo 12:00 (120min) -> ~13 vagas/dia
// A janela dos dois é 10 hoje; aqui o Costa está com 8 de propósito, para o
// protótipo mostrar como fica quando os dois divergem.
const AGENDA_CONFIG = {
  1: { diasSemana: [1, 2, 3, 4, 5, 6], janela: 8,
       expediente: { inicio: 8, fim: 19, dur: 60, intervalo: 11, intervaloMin: 90  } },
  2: { diasSemana: [1, 2, 3, 4, 5, 6], janela: 10,
       expediente: { inicio: 8, fim: 20, dur: 45, intervalo: 12, intervaloMin: 120 } },
};

// Horas em decimal (8.5 = 08:30) — é o que fecha conta e vira ângulo sem
// gambiarra de string. Só volta a ser texto na hora de escrever na tela.
const hhmm = t => {
  const h = Math.floor(t + 1e-9), m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * A grade de horários de um barbeiro, pela configuração DELE — a mesma conta que
 * `server.js` faz na API: passo de `dur` a partir de `inicio`, pulando o
 * intervalo, sem estourar `fim`.
 *
 * Isto é a fonte de tudo que fala de hoje. `capacidade` deixou de ser número
 * escrito à mão (era 9 e 13) e passou a ser o tamanho desta lista: escrever a
 * capacidade separada da grade é convidar as duas a discordarem.
 */
const slotsDoDia = profId => {
  const e = AGENDA_CONFIG[profId]?.expediente;
  if (!e) return [];
  const passo = e.dur / 60;
  const iIni = e.intervalo, iFim = e.intervalo + e.intervaloMin / 60;
  const out = [];
  for (let t = e.inicio; t + passo <= e.fim + 1e-9; t += passo) {
    if (t < iFim - 1e-9 && t + passo > iIni + 1e-9) { t = iFim - passo; continue; }
    out.push({ ini: t, fim: t + passo });
  }
  return out;
};

// Que horas são no protótipo. UM lugar só: o ponteiro do relógio, o corte da
// linha do tempo e o "em atendimento" do celular saem todos daqui. Antes o
// celular tinha "11:00" escrito à mão no cabeçalho.
const AGORA = 14 + 20 / 60;

// A volta do relógio: do começo do mais madrugador ao fim do mais noturno,
// sempre sobre TODOS os barbeiros — nunca só os filtrados. Assim filtrar num
// profissional tira um anel sem mexer a posição das horas; se a escala
// encolhesse junto, o mesmo horário mudaria de lugar no mostrador a cada clique.
const JANELA_DIA = {
  ini: Math.min(...PROFISSIONAIS.map(p => AGENDA_CONFIG[p.id].expediente.inicio)),
  fim: Math.max(...PROFISSIONAIS.map(p => AGENDA_CONFIG[p.id].expediente.fim)),
};

// Cada linha ocupa um horário REAL da grade do barbeiro dela. O mock antigo
// tinha o Costa atendendo às 11:00, que é o intervalo dele no banco — enquanto
// só existia lista ninguém via; desenhado em relógio, viraria briga na tela.
// `status` é DERIVADO de `AGORA`; escrito à mão só quando não dá para deduzir
// (cancelado, reagendado).
const AGENDA_HOJE = [
  { profId: 1, hora: "08:00", cliente: "Mateus Ribeiro",     telefone: "(11) 98•••2240", origem: "whatsapp"   },
  { profId: 2, hora: "08:45", cliente: "Felipe Almeida",     telefone: "(11) 97•••8814", origem: "app-etapas" },
  { profId: 1, hora: "09:00", cliente: "André Tavares",      telefone: "(11) 99•••1130", origem: "app-etapas" },
  { profId: 2, hora: "09:30", cliente: "Gabriel Moura",      telefone: "(11) 98•••0023", origem: "whatsapp"   },
  { profId: 1, hora: "10:00", cliente: "Pedro Henrique",     telefone: "(21) 99•••4471", origem: "whatsapp"   },
  { profId: 2, hora: "10:15", cliente: "Thiago Nunes",       telefone: "(11) 98•••6620", origem: "presencial" },
  { profId: 2, hora: "11:00", cliente: "Caio Bertolini",     telefone: "(11) 99•••5040", origem: "whatsapp"   },
  { profId: 1, hora: "12:30", cliente: "Henrique Lopes",     telefone: "(11) 97•••2298", origem: "presencial" },
  { profId: 1, hora: "13:30", cliente: "Ricardo Salles",     telefone: "(11) 98•••1199", origem: "app-etapas" },
  { profId: 2, hora: "14:00", cliente: "Bruno Mendonça",     telefone: "(11) 98•••7741", origem: "whatsapp"   },
  { profId: 1, hora: "14:30", cliente: "Júlio Bastos",       telefone: "(11) 99•••3320", origem: "app-etapas" },
  { profId: 2, hora: "14:45", cliente: "Eduardo Prado",      telefone: "(11) 97•••6655", origem: "app-etapas" },
  { profId: 2, hora: "15:30", cliente: "Daniel Ferraz",      telefone: "(11) 99•••9912", origem: "app-etapas", status: "cancelado"  },
  { profId: 1, hora: "15:30", cliente: "Vinícius Camargo",   telefone: "(11) 98•••8801", origem: "whatsapp",   status: "reagendado" },
  { profId: 1, hora: "16:30", cliente: "Rodrigo Cunha",      telefone: "(11) 98•••2204", origem: "whatsapp",   status: "cancelado"  },
  { profId: 2, hora: "17:00", cliente: "Lucas Bittencourt",  telefone: "(11) 97•••3318", origem: "whatsapp"   },
  { profId: 1, hora: "17:30", cliente: "Renato Albuquerque", telefone: "(11) 98•••4475", origem: "app-etapas" },
  { profId: 2, hora: "17:45", cliente: "Igor Brandão",       telefone: "(11) 99•••5582", origem: "whatsapp",   status: "reagendado" },
].map(a => {
  const ini = Number(a.hora.slice(0, 2)) + Number(a.hora.slice(3)) / 60;
  const dur = AGENDA_CONFIG[a.profId].expediente.dur;
  const fim = ini + dur / 60;
  const derivado = fim <= AGORA ? "concluido" : ini <= AGORA ? "em-atendimento" : "agendado";
  return { ...a, ini, fim, duracao: dur, status: a.status ?? derivado };
});

// O slot está ocupado quando existe linha viva nele — cancelado devolve o
// horário para a rua, e é assim que um buraco aparece no meio da tarde.
const ATIVO = s => s !== "cancelado";
const livresDoDia = profId => slotsDoDia(profId).filter(
  s => !AGENDA_HOJE.some(a => a.profId === profId && ATIVO(a.status) && Math.abs(a.ini - s.ini) < 1e-9)
);

// Dias corridos a partir de hoje (terça, 20 mai). wd: 0=dom … 6=sáb
const DIAS_CORRIDOS = [
  { wd: 2, dd: "20", hoje: true },
  { wd: 3, dd: "21" },
  { wd: 4, dd: "22" },
  { wd: 5, dd: "23" },
  { wd: 6, dd: "24" },
  { wd: 0, dd: "25" },
  { wd: 1, dd: "26" },
  { wd: 2, dd: "27" },
  { wd: 3, dd: "28" },
  { wd: 4, dd: "29" },
];

const WD_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// Por extenso só onde o dia não é uma linha da grade e sobra largura para ele.
const WD_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Vagas livres por profissional, na ordem de DIAS_CORRIDOS.
// null = bloqueio manual (dias_bloqueados).
// A PRIMEIRA coluna é CALCULADA da agenda de hoje, não escrita: ela e o relógio
// e o KPI têm que dizer o mesmo número, e a única forma de garantir isso é não
// deixar ninguém escrever esse número duas vezes. Do segundo dia em diante é
// mock mesmo — não existe agenda futura no protótipo.
const VAGAS = {
  1: [livresDoDia(1).length, 5, 0, 2, 1, 0, 7, 4, 6, 9],
  2: [livresDoDia(2).length, 0, 1, 8, null, 0, 5, 3, 8, 11],
};

// Um dia só pode estar num destes cinco estados, e cada um tem símbolo próprio.
// Nada é comunicado por opacidade: dia lotado é informação, não ausência dela.
const estadoDoDia = (profId, i) => {
  const cfg = AGENDA_CONFIG[profId];
  const dia = DIAS_CORRIDOS[i];
  if (!cfg || !dia) return { tipo: "fora" };
  if (i >= cfg.janela) return { tipo: "fora" };
  if (!cfg.diasSemana.includes(dia.wd)) return { tipo: "fechado" };
  const v = VAGAS[profId]?.[i];
  if (v === null || v === undefined) return { tipo: "bloqueio" };
  if (v === 0) return { tipo: "lotado", vagas: 0 };
  return { tipo: "vagas", vagas: v };
};

// --- Hoje sai de UMA fonte só -------------------------------------------------
// Antes eram três constantes independentes, e elas discordavam na tela: o KPI
// dizia 14 horários livres, a Disponibilidade somava 9 e a ocupação implicava 6.
// Agora tudo que fala de hoje é calculado da agenda do dia + capacidade + vagas.
const doDia   = id => AGENDA_HOJE.filter(a => a.profId === id);
const capacidade = id => slotsDoDia(id).length;
const vagasHoje  = id => VAGAS[id]?.[0] ?? 0;

// Os dois próximos encaixes de cada um, DERIVADOS: são as vagas de hoje que
// ainda não passaram. Eram lista escrita à mão, e o dia que o relógio mostrasse
// um buraco que esta linha não citasse, quem olha não saberia em qual acreditar.
const proximosLivres = id => {
  const hoje = livresDoDia(id).filter(s => s.ini >= AGORA).map(s => `Hoje ${hhmm(s.ini)}`);
  if (hoje.length >= 2) return hoje.slice(0, 2);
  // Acabou o dia: o próximo encaixe é a primeira vaga de amanhã. Amanhã não tem
  // agenda no protótipo, só contagem — então vale o começo do expediente.
  const amanha = (VAGAS[id]?.[1] ?? 0) > 0
    ? [`Amanhã ${hhmm(AGENDA_CONFIG[id].expediente.inicio)}`]
    : [];
  return [...hoje, ...amanha].slice(0, 2);
};

const OCUPACAO_HOJE = PROFISSIONAIS.map(p => ({
  profId: p.id,
  total: capacidade(p.id),
  ocupados: capacidade(p.id) - vagasHoje(p.id),
  proximosLivres: proximosLivres(p.id),
}));

// "1 cancelados" ficou escondido enquanto o número era sempre 2 — apareceu no
// primeiro filtro por profissional.
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const kpisDeHoje = ids => {
  const linhas     = ids.flatMap(doDia);
  const concluidos = linhas.filter(a => a.status === "concluido").length;
  const cancelados = linhas.filter(a => a.status === "cancelado").length;
  const ativos     = linhas.length - concluidos - cancelados;
  const livres     = ids.reduce((s, id) => s + vagasHoje(id), 0);
  const cheia      = ids.reduce((s, id) => s + capacidade(id), 0);
  return {
    agendamentos: {
      value: linhas.length,
      sub: [plural(concluidos, "concluído", "concluídos"),
            plural(ativos, "ativo", "ativos"),
            plural(cancelados, "cancelado", "cancelados")].join(" · "),
    },
    // O "2 profissionais ativos" estava escrito à mão e viraria mentira no dia
    // que entrasse um terceiro.
    ocupacao:     { value: `${Math.round((cheia - livres) / cheia * 100)}%`, sub: ids.length > 1 ? plural(ids.length, "profissional ativo", "profissionais ativos") : PROF_BY_ID[ids[0]].short },
    slotsLivres:  { value: livres, sub: `de ${cheia} horários no dia` },
  };
};

KPIS_BASE.hoje = {
  all: kpisDeHoje(PROFISSIONAIS.map(p => p.id)),
  1:   kpisDeHoje([1]),
  2:   kpisDeHoje([2]),
};

Object.assign(window, {
  PROFISSIONAIS, PROF_BY_ID, KPIS_BASE, AGENDA_HOJE, OCUPACAO_HOJE,
  WHATSAPP_QUEUE,
  AGENDA_CONFIG, DIAS_CORRIDOS, VAGAS, estadoDoDia,
  AGORA, hhmm, slotsDoDia, livresDoDia, capacidade,
});


// ============================================================================
// Shared UI primitives
// ============================================================================
const { useState, useMemo, useRef, useEffect } = React;

const Icon = ({ name, size = 16, stroke = 1.6, className = "", style }) => {
  const s = { width: size, height: size, ...style };
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round",
    strokeLinejoin: "round", className, style: s,
  };
  switch (name) {
    case "calendar":     return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case "clock":        return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "users":        return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "message":      return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
    case "chevron-down": return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-right":return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case "trend-up":     return <svg {...common}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case "trend-down":   return <svg {...common}><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></svg>;
    case "more":         return <svg {...common}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
    case "search":       return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case "settings":     return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "filter":       return <svg {...common}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>;
    case "scissors":     return <svg {...common}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>;
    case "alert":        return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>;
    case "phone":        return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>;
    case "smartphone":   return <svg {...common}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>;
    case "bot":          return <svg {...common}><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M8 4h8M9 14h.01M15 14h.01"/></svg>;
    case "user-check":   return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>;
    case "block":        return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M4.93 4.93l14.14 14.14"/></svg>;
    /* Os três da barra do celular são cópia fiel do lucide-react — os mesmos que
       `MobileBottomNav.tsx` importa. Desenhar "parecido" faria a barra mudar de
       cara sozinha na hora de portar. */
    case "calendar-days":return <svg {...common}><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>;
    case "message-circle":return <svg {...common}><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>;
    case "chart-column": return <svg {...common}><path d="M5 21v-6M12 21V3M19 21V9"/></svg>;
    case "home":         return <svg {...common}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>;
    case "bar-chart":    return <svg {...common}><path d="M3 3v18h18"/><path d="M7 14v4M12 9v9M17 5v13"/></svg>;
    case "sparkle":      return <svg {...common}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>;
    case "arrow-right":  return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "x":            return <svg {...common}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    default: return null;
  }
};

// `meta` é a contagem que muda todo dia e fica na MESMA linha do título.
// `subtitle` continua existindo para o celular, mas no desktop ele saiu: se a
// linha não muda quando o dado muda, ela não é subtítulo, é documentação — e
// documentação não paga 14px de altura para sempre no cabeçalho.
const Panel = ({ title, subtitle, meta, icon, actions, children, className = "", padding = "p-5", innerPadding, style, bodyStyle }) => (
  <section className={`db-panel ${className}`} style={style}>
    {(title || actions) && (
      <header className="db-panel__head">
        <div className="db-panel__head-left">
          {icon && <span className="db-panel__icon"><Icon name={icon} size={19} /></span>}
          <div className="db-panel__titling">
            <h2 className="db-panel__title">{title}</h2>
            {meta && <span className="db-panel__meta">{meta}</span>}
            {subtitle && <p className="db-panel__sub">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="db-panel__actions">{actions}</div>}
      </header>
    )}
    <div className={`db-panel__body ${innerPadding || padding}`} style={bodyStyle}>{children}</div>
  </section>
);

// Três linhas alinhadas à esquerda, sem coluna de ícone. O ladrilho arredondado
// saiu em 2026-08-02: ocupava 18,6% da largura do card no desktop e ~30% no
// celular para não carregar informação nenhuma, e vencia a primeira fixação do
// olho sem recompensar. `destaque` é o único card com tratamento diferente.
const KpiCard = ({ label, value, sub, destaque, compact }) => (
  <div className={`kpi ${compact ? "kpi--compact" : ""} ${destaque ? "kpi--destaque" : ""}`}>
    <span className="kpi__label">{label}</span>
    <div className="kpi__value">{value}</div>
    {sub && <div className="kpi__sub">{sub}</div>}
  </div>
);

// Não é `tablist`: não existe `tabpanel` nem `aria-controls`, e leitor de tela
// anunciava "aba" e ia procurar um painel que não existe. É um grupo de rádio.
const PeriodChips = ({ value, onChange, options }) => (
  <div className="chips" role="radiogroup" aria-label="Período">
    {options.map(o => (
      <button
        key={o.value}
        role="radio"
        aria-checked={value === o.value}
        className={`chip ${value === o.value ? "chip--on" : ""}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const ProfFilter = ({ value, onChange, profs }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const current = value === "all" ? null : profs.find(p => p.id === value);
  return (
    <div className="proffilter" ref={ref}>
      <button className={`proffilter__btn ${open ? "is-open" : ""}`} onClick={() => setOpen(o => !o)}>
        {current ? (
          <>
            <span className="proffilter__dot" style={{ background: current.color }} />
            <span>{current.short}</span>
          </>
        ) : (
          <>
            <Icon name="filter" size={12} />
            <span>Todos profissionais</span>
          </>
        )}
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div className="proffilter__menu">
          <button className={`proffilter__opt ${value === "all" ? "is-active" : ""}`} onClick={() => { onChange("all"); setOpen(false); }}>
            <span className="proffilter__opt-dot" style={{ background: "rgba(255,255,255,.4)" }} />
            <span>Todos profissionais</span>
          </button>
          {profs.map(p => (
            <button key={p.id} className={`proffilter__opt ${value === p.id ? "is-active" : ""}`} onClick={() => { onChange(p.id); setOpen(false); }}>
              <span className="proffilter__opt-dot" style={{ background: p.color }} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    "agendado":       { label: "Agendado",       cls: "is-agendado" },
    "confirmado":     { label: "Agendado",       cls: "is-agendado" },
    "concluido":      { label: "Concluído",      cls: "is-concluido" },
    "em-atendimento": { label: "Em atendimento", cls: "is-active" },
    "reagendado":     { label: "Reagendado",     cls: "is-reagendado" },
    "cancelado":      { label: "Cancelado",      cls: "is-cancelado" },
  };
  const it = map[status] || map.agendado;
  return (
    <span className={`statuspill ${it.cls}`}>
      {status === "em-atendimento" && <span className="statuspill__dot" />}
      {it.label}
    </span>
  );
};

// `rotulo` escreve o motivo de não dar dentro da célula, em vez de escondê-lo no
// `title`. É o modo do celular: tela de toque não tem hover, então a faixa de
// células apagadas ficava sem explicação nenhuma.
// `rotulo` escreve o motivo de não dar dentro da célula, em vez de escondê-lo no
// `title`. Passa a valer também no desktop desde 2026-08-02: os três motivos
// desenhavam pixels idênticos, e no mock duas dessas células aparecem LADO A
// LADO com significados opostos.
const CelulaDispo = ({ estado, prof, hoje = false }) => {
  const cls = `dcell${hoje ? " is-today" : ""}`;
  if (estado.tipo === "fora")
    return <span className={`${cls} dcell--nao dcell--rot`} title={`Fora da janela de ${prof.short}`}>—</span>;
  if (estado.tipo === "fechado")
    return <span className={`${cls} dcell--nao dcell--rot`} title={`${prof.short} não trabalha neste dia`}>folga</span>;
  if (estado.tipo === "bloqueio")
    return <span className={`${cls} dcell--nao dcell--rot`} title={`${prof.short}: dia bloqueado`}>bloqueio</span>;
  // Dia sem vaga é a melhor notícia do mês para o dono. O `0` em âmbar pintava
  // de alerta a vitória — e âmbar já significa "Reagendado" no painel colado.
  if (estado.tipo === "lotado")
    return <span className={`${cls} dcell--cheio`} title={`${prof.short}: sem vaga`}>cheio</span>;
  return <span className={`${cls} dcell--vagas`} title={`${prof.short}: ${estado.vagas} vaga${estado.vagas > 1 ? "s" : ""}`}>{estado.vagas}</span>;
};

// Uma linha por dia, uma coluna por barbeiro. O nome dele vive no CABEÇALHO da
// coluna, uma vez. Antes se repetia célula a célula: dois por linha, dez linhas,
// vinte repetições para dizer a coisa menos variável da tela.
//
// Nasceu no celular, onde 10 colunas não cabiam. Passou a valer TAMBÉM no
// desktop em 2026-08-02, no lugar da faixa horizontal por barbeiro (`DispoStrip`,
// removida): em pé o painel fica estreito e alto, e a largura que sobra na coluna
// da direita paga o relógio do dia ao lado. A borda irregular das janelas
// diferentes não se perdeu — girou junto, e vira `—` no fim da coluna mais curta.
//
// `comCapacidade` só no desktop: a coluna do celular tem 58px e não cabe
// "9 vagas/dia" embaixo do nome. E é ela que torna "3" e "6" comparáveis sem o
// leitor saber de cabeça a configuração de ninguém.
// `colDia` fixo no desktop e `1fr` no celular, e a diferença tem motivo: com a
// coluna do dia elástica, a sobra de largura do painel entra ali e joga o número
// para longe do rótulo dele. Fixa, a grade fica compacta e a sobra vira ar em
// volta (`.db-duo .dlist` centraliza). Fixa em TODAS as linhas, nunca `auto` —
// cada linha é uma grade própria, e `auto` daria trilhos diferentes para
// "Hoje 20" e "domingo 25", desalinhando a coluna inteira.
const DispoList = ({ profFilter = "all", comCapacidade = false, larguraCol = 58, colDia = "1fr" }) => {
  const profs  = profFilter === "all" ? PROFISSIONAIS : PROFISSIONAIS.filter(p => p.id === profFilter);
  const janela = Math.max(...profs.map(p => AGENDA_CONFIG[p.id]?.janela ?? 0));
  const dias   = DIAS_CORRIDOS.slice(0, janela);
  const cols   = { gridTemplateColumns: `${colDia} repeat(${profs.length}, ${larguraCol}px)` };

  // Dia em que nenhum deles atende não merece uma linha de tamanho normal com
  // duas células vazias dentro: vira um risco fino, que segura a sequência das
  // datas sem pesar como dia útil.
  const ninguemAtende = i => profs.every(p => {
    const t = estadoDoDia(p.id, i).tipo;
    return t === "fechado" || t === "fora";
  });

  return (
    <div className="dlist">
      <div className="dlist__head" style={cols}>
        <span />
        {profs.map(p => (
          <span key={p.id} className="dlist__prof">
            <span className="dlist__profname">
              <span className="dlist__dot" style={{ background: p.color }} />
              {p.short.split(" ")[1] ?? p.short}
            </span>
            {comCapacidade && <span className="dlist__cap">{capacidade(p.id)} vagas/dia</span>}
          </span>
        ))}
      </div>

      {dias.map((d, i) => ninguemAtende(i) ? (
        <div key={i} className="dlist__fechado">{WD_LONGO[d.wd]} {d.dd}</div>
      ) : (
        <div key={i} className={`dlist__row${d.hoje ? " is-today" : ""}`} style={cols}>
          <span className="dlist__day">
            <b>{d.hoje ? "Hoje" : WD_LABEL[d.wd]}</b> {d.dd}
          </span>
          {profs.map(p => (
            <CelulaDispo key={p.id} estado={estadoDoDia(p.id, i)} prof={p} />
          ))}
        </div>
      ))}
    </div>
  );
};

// ---- O dia em relógio --------------------------------------------------------
// Um dia É um círculo, e desenhado assim ele mostra o que a lista esconde: o
// FORMATO do dia. "6 horários livres" é o mesmo número quando as vagas estão
// espalhadas pelo meio da tarde e quando estão empilhadas depois das 18h — e as
// duas situações pedem coisas opostas do dono.
//
// Anéis concêntricos, um por barbeiro. Dois mostradores lado a lado não caberiam
// na coluna, e mesmo se coubessem seriam piores: concêntrico alinha o mesmo
// horário no mesmo raio, então dois vãos alinhados = os dois livres na mesma
// hora, que é buraco da barbearia inteira e não de uma cadeira. O anel de dentro
// tem arco mais curto em pixels, mas o mesmo ÂNGULO — e num mostrador se lê
// posição e abertura, nunca comprimento.
const RAD = Math.PI / 180;
const anguloDaHora = t => ((t - JANELA_DIA.ini) / (JANELA_DIA.fim - JANELA_DIA.ini)) * 360 - 90;
const pontoNoAnel = (c, r, a) => [c + r * Math.cos(a * RAD), c + r * Math.sin(a * RAD)];
const arcoDaFaixa = (c, r, t0, t1) => {
  let a0 = anguloDaHora(t0), a1 = anguloDaHora(t1);
  // Volta fechada não desenha com `A` — o ponto final cai em cima do inicial e o
  // navegador não sabe para que lado ir.
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
  const [x0, y0] = pontoNoAnel(c, r, a0);
  const [x1, y1] = pontoNoAnel(c, r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const RelogioDoDia = ({ profFilter = "all" }) => {
  const profs   = profFilter === "all" ? PROFISSIONAIS : PROFISSIONAIS.filter(p => p.id === profFilter);
  const sozinho = profs.length === 1;

  const S = 288, c = S / 2;
  const espessura = sozinho ? 30 : 22;
  const rExterno  = S * 0.355;
  const raio      = i => rExterno - i * (espessura + 6);
  const rBorda    = rExterno + espessura / 2;
  const margem    = 0.03;                       // respiro entre slots vizinhos

  // O MESMO número que o KPI "Horários livres" mostra, pela mesma conta. O card
  // diz quantos; o anel diz onde. Dois números diferentes para a mesma pergunta
  // foi o defeito que a vistoria de design achou — não repetir.
  const total = profs.reduce((s, p) => s + livresDoDia(p.id).length, 0);

  const horas = [];
  for (let h = Math.ceil(JANELA_DIA.ini); h < JANELA_DIA.fim; h++) horas.push(h);

  const resumo = profs
    .map(p => `${p.short}: ${livresDoDia(p.id).map(s => hhmm(s.ini)).join(", ") || "sem vaga"}`)
    .join(". ");

  return (
    <div className="relo">
      {/* O palco existe para o mostrador ser limitado pela ALTURA. O SVG tem
          `viewBox`, então o navegador deriva altura da largura e ele estourava
          o card, empurrando o rodapé para fora. Aqui o palco recebe a altura que
          sobrou e o SVG se ajusta dentro dela. */}
      <div className="relo__palco">
      <svg
        className="relo__dial"
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-label={`Horários livres de hoje, agora ${hhmm(AGORA)}. ${resumo}`}
      >
        {profs.map((prof, i) => {
          const e = AGENDA_CONFIG[prof.id].expediente;
          const r = raio(i);
          const iIni = e.intervalo, iFim = e.intervalo + e.intervaloMin / 60;
          const livres = new Set(livresDoDia(prof.id).map(s => s.ini));

          return (
            <g key={prof.id}>
              {/* O dia inteiro existe para todo mundo; o que muda é quanto dele
                  cada um trabalha. O Costa fecha às 19h e esse pedaço fica como
                  trilho, não como buraco — ausência de expediente não é vaga. */}
              <path className="relo__fora" strokeWidth={espessura}
                    d={arcoDaFaixa(c, r, JANELA_DIA.ini, JANELA_DIA.fim)} />
              <path className="relo__vago" strokeWidth={espessura}
                    d={arcoDaFaixa(c, r, e.inicio, e.fim)} />

              {/* Intervalo com símbolo próprio. Apagar não serve: apagado já é
                  "fora do expediente", e os dois significam coisas diferentes. */}
              <path className="relo__fora"  strokeWidth={espessura}        d={arcoDaFaixa(c, r, iIni, iFim)} />
              <path className="relo__inter" strokeWidth={espessura * 0.30} d={arcoDaFaixa(c, r, iIni, iFim)} />

              {slotsDoDia(prof.id).map(s => livres.has(s.ini) ? (
                // Vaga: fio de aviso. É o assunto do painel, não a falta dele.
                <path key={s.ini} className="relo__livre" strokeWidth={espessura * 0.26}
                      d={arcoDaFaixa(c, r, s.ini + margem, s.fim - margem)} />
              ) : (
                // Ocupado na cor de identidade — a mesma da agenda e da
                // disponibilidade. O que já passou NÃO apaga: opacidade não
                // comunica estado nesta tela.
                <path key={s.ini} stroke={prof.color} strokeWidth={espessura} fill="none"
                      d={arcoDaFaixa(c, r, s.ini + margem, s.fim - margem)} />
              ))}
            </g>
          );
        })}

        {horas.map(h => {
          const a = anguloDaHora(h);
          const rotulado = h % 3 === 2;
          const [x0, y0] = pontoNoAnel(c, rBorda + 4, a);
          const [x1, y1] = pontoNoAnel(c, rBorda + (rotulado ? 9 : 6), a);
          const [lx, ly] = pontoNoAnel(c, rBorda + 20, a);
          return (
            <g key={h}>
              <path className="relo__tick" d={`M ${x0} ${y0} L ${x1} ${y1}`} />
              {rotulado && <text className="relo__hora" x={lx} y={ly + 3.5}>{h}h</text>}
            </g>
          );
        })}

        {/* O ponteiro do agora. É ele que faz a peça ser lida como relógio na
            primeira olhada, e separa o buraco que ainda dá para encher do que
            já passou. */}
        {AGORA > JANELA_DIA.ini && AGORA < JANELA_DIA.fim && (() => {
          const a = anguloDaHora(AGORA);
          const [x0, y0] = pontoNoAnel(c, raio(profs.length - 1) - espessura / 2 - 6, a);
          const [x1, y1] = pontoNoAnel(c, rBorda + 4, a);
          return (
            <g>
              <path className="relo__agora" d={`M ${x0} ${y0} L ${x1} ${y1}`} />
              <circle className="relo__agora-bola" cx={x1} cy={y1} r={2.6} />
            </g>
          );
        })()}

        {sozinho && <text className="relo__quem" x={c} y={c - 26}>{profs[0].short}</text>}
        <text className="relo__total" x={c} y={c + (sozinho ? 12 : 6)}>{total}</text>
        <text className="relo__unid"  x={c} y={c + (sozinho ? 32 : 26)}>
          {total === 1 ? "horário livre" : "horários livres"}
        </text>

        {/* UMA hora escrita, a do próximo encaixe, e só com um barbeiro em cena.
            Escrever todas as vagas quebrou no primeiro teste com 5: 18:30, 19:15
            e 08:00 caem quase no mesmo ponto do mostrador — a volta é 08:00→20:00,
            então o fim do dia encosta no começo. Uma etiqueta não tem com quem
            colidir, e é a que interessa: o buraco que ainda dá para vender. */}
        {sozinho && (() => {
          const livres = livresDoDia(profs[0].id);
          const alvo = livres.find(s => s.ini >= AGORA);
          if (!alvo) return null;
          const [x, y] = pontoNoAnel(c, raio(0) - espessura * 0.95,
                                     anguloDaHora((alvo.ini + alvo.fim) / 2));
          return <text className="relo__vaga-hora" x={x} y={y + 3.5}>{hhmm(alvo.ini)}</text>;
        })()}
      </svg>
      </div>

      <div className="relo__rodape">
        <div className="relo__ident">
          {profs.map(p => {
            const n = livresDoDia(p.id).length;
            return (
              <span key={p.id}>
                <span className="relo__dot" style={{ background: p.color }} />
                {p.short} · <b>{n}</b> {n === 1 ? "vaga" : "vagas"}
              </span>
            );
          })}
        </div>
        {/* Quatro tratamentos diferentes no anel e nenhum cabe escrito por dentro
            — ao contrário da Disponibilidade, onde `folga` e `bloqueio` couberam
            na célula e a legenda pôde sair. Aqui ela se paga.
            O quadradinho de "ocupado" é partido nas cores em cena: verde é o
            Costa, não é "ocupado". Filtrado num barbeiro, vira a cor dele. */}
        <div className="relo__chave">
          <span>
            <i className="relo__sw" style={profs.length === 1
              ? { background: profs[0].color }
              : { background: `linear-gradient(90deg, ${profs.map((p, i) =>
                  `${p.color} ${(i / profs.length) * 100}% ${((i + 1) / profs.length) * 100}%`).join(", ")})` }} />
            ocupado
          </span>
          <span><i className="relo__sw relo__sw--livre" />livre</span>
          <span><i className="relo__sw relo__sw--inter" />intervalo</span>
          <span><i className="relo__sw relo__sw--fora" />fora do expediente</span>
        </div>
      </div>
    </div>
  );
};

// As MESMAS três abas do app, na mesma ordem — conferido em
// `CALENDARIO/components/MobileBottomNav.tsx`. O protótipo tinha inventado um
// "Mais" que não existe em lugar nenhum e perdido "Conversas", que é tela real e
// a única com badge. Validar a barra antiga era validar uma barra que não existe.
const ABAS_MOBILE = [
  { id: "calendar",      icone: "calendar-days",  label: "Agenda" },
  { id: "conversations", icone: "message-circle", label: "Conversas", badge: 3 },
  { id: "dashboard",     icone: "chart-column",   label: "Dashboard" },
];

// Dock flutuante: pílula solta da borda, vidro fosco, ícone sem rótulo.
// Duas coisas da referência ficaram de fora, de propósito:
//   - o rótulo por tooltip, que depende de hover e não existe em tela de toque.
//     Quem diz onde você está é a cor + o ponto, não um balão que nunca abre.
//   - a flutuação em laço e o rotateX de perspectiva, que são graça de dock de
//     vitrine. Isto aqui é a navegação do app: fica parada.
const DockNav = ({ atual, onChange }) => (
  <nav className="mb-dock" aria-label="Navegação">
    {ABAS_MOBILE.map(a => {
      const ativo = a.id === atual;
      return (
        <button
          key={a.id}
          className={`mb-dock__item${ativo ? " is-active" : ""}`}
          onClick={() => onChange(a.id)}
          aria-current={ativo ? "page" : undefined} aria-label={a.label}
        >
          <Icon name={a.icone} size={24} stroke={ativo ? 2.3 : 1.8} />
          {/* Sempre no DOM: aparecer e sumir não pode empurrar o ícone. */}
          <span className="mb-dock__dot" />
          {a.badge > 0 && <span className="mb-dock__badge">{a.badge}</span>}
        </button>
      );
    })}
  </nav>
);

Object.assign(window, {
  Icon, Panel, KpiCard, PeriodChips, ProfFilter,
  StatusPill, DispoList, RelogioDoDia, DockNav,
});

// ============================================================================
// Desktop
// ============================================================================
// O rótulo diz a COISA; o período quem diz é o chip do topo. Repetir "hoje" em
// cada card era eco do filtro — e ficava ambíguo com a "Agenda de hoje" logo abaixo,
// que é o único lugar onde "hoje" informa, porque aquele painel ignora o filtro.
const KPI_LABELS = {
  agendamentos: "Agendamentos",
  ocupacao:     "Ocupação",
  slotsLivres:  "Horários livres",
  marcacoes:    "Novas marcações",
};


const PERIOD_LABELS = {
  hoje:  "Hoje, terça-feira · 20 mai",
  "7d":  "Últimos 7 dias",
  "15d": "Últimos 15 dias",
  "30d": "Últimos 30 dias",
};

const Desktop = () => {
  const [period, setPeriod] = useState("hoje");
  const [prof, setProf] = useState("all");
  const [aba, setAba] = useState("proximos");

  const profKey = prof === "all" ? "all" : prof;
  const kpis = (KPIS_BASE[period] ?? KPIS_BASE["30d"])[profKey] ?? (KPIS_BASE[period] ?? KPIS_BASE["30d"]).all;
  const marcacoes = (MARCACOES[period] ?? MARCACOES["30d"])[profKey] ?? (MARCACOES[period] ?? MARCACOES["30d"]).all;
  const agenda = useMemo(() => prof === "all" ? AGENDA_HOJE : AGENDA_HOJE.filter(a => a.profId === prof), [prof]);
  const ATIVOS = ["agendado", "confirmado", "reagendado", "em-atendimento"];
  const proximos = agenda.filter(a => ATIVOS.includes(a.status));
  const concluidos = agenda.filter(a => a.status === "concluido");
  const emAtendimento = agenda.filter(a => a.status === "em-atendimento");
  const cancelados = agenda.filter(a => a.status === "cancelado");
  const linhaDoTempo = [...agenda].sort((a, b) => a.hora.localeCompare(b.hora));

  const ABAS = [
    { id: "proximos",   label: "Próximos",       lista: proximos },
    { id: "linha",      label: "Linha do tempo", lista: linhaDoTempo },
    { id: "concluidos", label: "Concluídos",     lista: concluidos },
  ];
  const lista = ABAS.find(t => t.id === aba)?.lista ?? proximos;
  // Na linha do tempo, o corte entre o que já passou e o que vem.
  const iAgora = aba === "linha"
    ? linhaDoTempo.findIndex(a => a.status !== "concluido" && a.status !== "em-atendimento")
    : -1;
  const ocupFiltered = prof === "all" ? OCUPACAO_HOJE : OCUPACAO_HOJE.filter(o => o.profId === prof);

  return (
    <div className="db-shell">
      <header className="db-topbar db-topbar--calendar">
        <div className="db-topbar__brand">
          <span className="db-topbar__logo"><Icon name="scissors" size={14} /></span>
          <span className="db-topbar__brand-name">CALENDÁRIO</span>
          <span className="db-topbar__brand-sub">/ Dashboard</span>
        </div>
        <div className="db-topbar__calendar">
          <button className="db-topbar__today">Hoje</button>
          <button className="db-iconbtn db-iconbtn--compact" aria-label="Anterior"><Icon name="chevron-right" size={13} style={{ transform: "rotate(180deg)" }}/></button>
          <button className="db-iconbtn db-iconbtn--compact" aria-label="Próximo"><Icon name="chevron-right" size={13}/></button>
          {/* Já vem capitalizado da origem. O `text-transform: capitalize` do CSS
              saiu: em pt-BR ele produzia "Terça-Feira, 20 De Maio". */}
          <span className="db-topbar__date">Terça-feira, 20 de maio</span>
        </div>
        <div className="db-topbar__right">
          <button className="db-iconbtn"><Icon name="search" size={14}/></button>
          {/* Sino removido em 2026-08-01: não existe notificação em lugar nenhum
              do CALENDARIO, e o ponto em cima dele prometia não-lido de um
              sistema que não existe. */}
          <div className="db-avatar-me">VC</div>
        </div>
      </header>

      <div className="db-pagehead">
        <div className="db-pagehead__left">
          <h1 className="db-pagehead__title">Dashboard</h1>
          <p className="db-pagehead__sub"><span className="db-pulse" /> Resumo do calendário · {PERIOD_LABELS[period]} · atualizado há 24s</p>
        </div>
        {/* O filtro de profissional fica aqui porque governa MESMO a tela toda.
            O chip de período desceu para dentro da faixa de KPIs, que é a única
            coisa que ele muda. */}
        <div className="db-pagehead__filters">
          <ProfFilter value={prof} onChange={setProf} profs={PROFISSIONAIS} />
        </div>
      </div>

      {/* A faixa saiu da linguagem visual dos painéis — sem borda e sem sombra —
          para dizer sem uma palavra que ela é resumo e eles são trabalho. */}
      <section className="db-resumo">
        {/* Sem rótulo. "Resumo do período" dizia pela terceira vez o que o
            subtítulo da página ("Resumo do calendário · Hoje") e o próprio chip
            aceso já diziam — e ainda brigava com os chips pela mesma linha. O
            celular nunca teve rótulo aqui e nunca fez falta. Quem diz o escopo é
            a posição: colado nos cards, longe do filtro de profissional. */}
        <div className="db-resumo__head">
          <PeriodChips
            value={period}
            onChange={setPeriod}
            options={[
              { value: "hoje", label: "Hoje" },
              { value: "7d",   label: "7 dias" },
              { value: "15d",  label: "15 dias" },
              { value: "30d",  label: "30 dias" },
            ]}
          />
        </div>
        <div className="db-kpis">
          <KpiCard label={KPI_LABELS.agendamentos} value={kpis.agendamentos.value} sub={kpis.agendamentos.sub} />
          <KpiCard label={KPI_LABELS.ocupacao}     value={kpis.ocupacao.value}     sub={kpis.ocupacao.sub}     />
          <KpiCard label={KPI_LABELS.slotsLivres}  value={kpis.slotsLivres.value}  sub={kpis.slotsLivres.sub}  />
          <KpiCard label={KPI_LABELS.marcacoes}    value={marcacoes.value}         sub={marcacoes.sub} destaque />
        </div>
      </section>

      {/* A coluna da direita ganhou a folga: a disponibilidade precisa de largura
          para caber a janela de cada barbeiro sem espremer a célula. */}
      <div className="db-row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)" }}>
        <div style={{ position: "relative" }}>
          <Panel
            title="Agenda de hoje"
            meta={`${proximos.length} próximos · ${concluidos.length} concluídos · ${cancelados.length} cancelados`}
            actions={
              <div className="seg">
                {ABAS.map(t => (
                  <button
                    key={t.id}
                    className={`seg__btn${aba === t.id ? " seg__btn--on" : ""}`}
                    onClick={() => setAba(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
            padding="p-0"
            style={{ position: "absolute", inset: 0 }}
            bodyStyle={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <ul className="agenda" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {lista.length === 0 && (
                <li className="agenda__vazio">
                  {aba === "concluidos" ? "Nenhum atendimento concluído ainda hoje." : "Nada por aqui."}
                </li>
              )}
              {lista.map((a, i) => {
                const p = PROF_BY_ID[a.profId];
                const isAtendendo = a.status === "em-atendimento";
                return (
                  <React.Fragment key={i}>
                    {i === iAgora && <li className="agenda__agora"><span>agora</span></li>}
                    <li className={`agenda__row ${isAtendendo ? "is-active" : ""} ${a.status === "concluido" ? "is-done" : ""} ${a.status === "cancelado" ? "is-cancelado" : ""}`}>
                      <span className="agenda__bar" style={{ background: p.color, boxShadow: isAtendendo ? `0 0 12px ${p.color}88` : "none" }} />
                      <div className="agenda__time"><span className="agenda__hora">{a.hora}</span><span className="agenda__dur">{a.duracao}min</span></div>
                      <div className="agenda__client"><span className="agenda__name">{a.cliente}</span><span className="agenda__phone">{a.telefone}</span></div>
                      <div className="agenda__prof"><span className="agenda__profdot" style={{ background: p.color }} /><span className="agenda__profname">{p.short}</span></div>
                      <div className="agenda__meta"><StatusPill status={a.status} /></div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="db-stack">
          <Panel title="Próximos horários livres" padding="p-4">
            <ul className="firstfree">
              {ocupFiltered.map(o => {
                const p = PROF_BY_ID[o.profId];
                return (
                  <li key={o.profId} className="firstfree__row">
                    <span className="firstfree__dot" style={{ background: p.color }} />
                    <span className="firstfree__name">{p.short}</span>
                    <span className="firstfree__slots">
                      {o.proximosLivres.map((h, i) => (
                        <span key={i} className={`firstfree__when${i > 0 ? " is-segundo" : ""}`}>{h}</span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Disponibilidade em pé libera a largura que o relógio precisa. A
              coluna dela é fixa (cabe dia + dois barbeiros e não cresce mais que
              isso); o relógio fica com o resto. */}
          <div className="db-duo">
            <Panel title="Disponibilidade" padding="p-4">
              <DispoList profFilter={prof} comCapacidade larguraCol={84} colDia="76px" />
            </Panel>

            <Panel title="O dia" meta={`agora ${hhmm(AGORA)}`} padding="p-4">
              <RelogioDoDia profFilter={prof} />
            </Panel>
          </div>
        </div>
      </div>

    </div>
  );
};

Object.assign(window, { Desktop });

// ============================================================================
// Mobile
// ============================================================================
const Mobile = () => {
  const [period, setPeriod] = useState("hoje");
  const [prof, setProf] = useState("all");
  // Só existe a tela do dashboard aqui. A aba muda para o indicador poder ser
  // visto mudando de lugar — é barra em validação, não navegação de verdade.
  const [aba, setAba] = useState("dashboard");

  const profKey = prof === "all" ? "all" : prof;
  const kpis = (KPIS_BASE[period] ?? KPIS_BASE["30d"])[profKey] ?? (KPIS_BASE[period] ?? KPIS_BASE["30d"]).all;
  const marcacoes = (MARCACOES[period] ?? MARCACOES["30d"])[profKey] ?? (MARCACOES[period] ?? MARCACOES["30d"]).all;
  const agenda = useMemo(() => prof === "all" ? AGENDA_HOJE : AGENDA_HOJE.filter(a => a.profId === prof), [prof]);
  const proximos = agenda.filter(a => a.status !== "concluido").slice(0, 5);
  const emAtendimento = agenda.filter(a => a.status === "em-atendimento");
  const ocupFiltered = prof === "all" ? OCUPACAO_HOJE : OCUPACAO_HOJE.filter(o => o.profId === prof);

  return (
    <div className="mb-shell">
      <div className="mb-scroll">
        <header className="mb-topbar">
          {/* Sem hambúrguer nesta aba: a gaveta dele é do calendário (criar
              agendamento, visualização dia/semana/mês, configurar agenda) e
              nenhum item serve ao dashboard. */}
          <div className="mb-topbar__title">
            <span className="mb-topbar__name">Dashboard</span>
            <span className="mb-topbar__sub"><span className="db-pulse"/> Calendário · atualizado há 24s</span>
          </div>
          {/* À direita do topo do app mora o UserMenu — no celular ele é a ÚNICA
              porta para Perfil, Configurações e Sair. O protótipo tinha um sino
              no lugar dele: inventava notificação e escondia o que é real. */}
          <button className="mb-avatar" aria-label="Menu do usuário">VC</button>
        </header>

        {/* O filtro de profissional fica no nível da página porque ele governa
            MESMO tudo que vem abaixo: agenda, horários livres e disponibilidade
            todos obedecem. */}
        <div className="mb-topfilter">
          <ProfFilter value={prof} onChange={setProf} profs={PROFISSIONAIS} />
        </div>

        {/* O chip de período desceu para cá em 2026-08-01. Ele muda só os quatro
            KPIs — a agenda é sempre de hoje, e está certo que seja. No cabeçalho
            da página ele prometia governar a tela inteira; colado nos cards, a
            promessa fica do tamanho do que ele faz. */}
        <div className="mb-period">
          <PeriodChips
            value={period}
            onChange={setPeriod}
            options={[
              { value: "hoje", label: "Hoje" },
              { value: "7d",   label: "7 dias" },
              { value: "15d",  label: "15 dias" },
              { value: "30d",  label: "30 dias" },
            ]}
          />
        </div>

        <div className="mb-kpis">
          <KpiCard compact label="Agendamentos" value={kpis.agendamentos.value} sub={kpis.agendamentos.sub} />
          <KpiCard compact label="Ocupação"     value={kpis.ocupacao.value}     sub={kpis.ocupacao.sub}     />
          <KpiCard compact label="Horários livres" value={kpis.slotsLivres.value}  sub={kpis.slotsLivres.sub}  />
          <KpiCard compact label="Marcações"    value={marcacoes.value}         sub={marcacoes.sub} destaque />
        </div>

        {emAtendimento.length > 0 && (
          <div className="mb-now">
            <div className="mb-now__head">
              <span className="mb-now__pulse"/>
              <span>Em atendimento agora · {emAtendimento.length}</span>
              <span className="mb-now__time">{hhmm(AGORA)}</span>
            </div>
            <div className="mb-now__rows">
              {emAtendimento.map((a, i) => {
                const p = PROF_BY_ID[a.profId];
                return (
                  <div key={i} className="mb-now__row">
                    <span className="mb-now__bar" style={{ background: p.color }}/>
                    <span className="mb-now__cli">{a.cliente}</span>
                    <span className="mb-now__prof" style={{ color: p.color }}>{p.short}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Panel title="Próximos atendimentos" subtitle={`${proximos.length} pendentes hoje`} icon="calendar" padding="p-0">
          <ul className="agenda agenda--compact">
            {proximos.map((a, i) => {
              const p = PROF_BY_ID[a.profId];
              return (
                <li key={i} className="agenda__row">
                  <span className="agenda__bar" style={{ background: p.color }}/>
                  <div className="agenda__time">
                    <span className="agenda__hora">{a.hora}</span>
                    <span className="agenda__dur">{a.duracao}min</span>
                  </div>
                  <div className="agenda__client">
                    <span className="agenda__name">{a.cliente}</span>
                    <span className="agenda__phone">{p.short}</span>
                  </div>
                </li>
              );
            })}
            <li className="agenda__more">Ver todos os {agenda.length} <Icon name="chevron-right" size={11}/></li>
          </ul>
        </Panel>

        <Panel title="Próximos horários livres" subtitle="Os dois próximos encaixes de cada barbeiro" icon="sparkle">
          <ul className="firstfree">
            {ocupFiltered.map(o => {
              const p = PROF_BY_ID[o.profId];
              return (
                <li key={o.profId} className="firstfree__row">
                  <span className="firstfree__dot" style={{ background: p.color }}/>
                  <span className="firstfree__name">{p.short}</span>
                  <span className="firstfree__slots">
                    {o.proximosLivres.map((h, i) => (
                      <span key={i} className={`firstfree__when${i > 0 ? " is-segundo" : ""}`}>{h}</span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Disponibilidade" subtitle="Vagas livres · janela de cada barbeiro" icon="clock" padding="p-4">
          <DispoList profFilter={prof} />
        </Panel>

        {/* Respiro do dock: ele flutua POR CIMA da rolagem, então o último painel
            precisa de chão para não morrer embaixo dele. */}
        <div style={{ height: 104 }}/>
      </div>

      <DockNav atual={aba} onChange={setAba} />
    </div>
  );
};

Object.assign(window, { Mobile });

// ============================================================================
// Encoding fix (mojibake)
// ============================================================================
const _w1252rev = new Map([
  [0x20AC,0x80],[0x201A,0x82],[0x0192,0x83],[0x201E,0x84],[0x2026,0x85],
  [0x2020,0x86],[0x2021,0x87],[0x02C6,0x88],[0x2030,0x89],[0x0160,0x8A],
  [0x2039,0x8B],[0x0152,0x8C],[0x017D,0x8E],[0x2018,0x91],[0x2019,0x92],
  [0x201C,0x93],[0x201D,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],
  [0x02DC,0x98],[0x2122,0x99],[0x0161,0x9A],[0x203A,0x9B],[0x0153,0x9C],
  [0x017E,0x9E],[0x0178,0x9F],
]);
const _fixSeg = (seg) => {
  let out = seg;
  for (let p = 0; p < 4; p++) {
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const c = out.charCodeAt(i);
      bytes[i] = _w1252rev.has(c) ? _w1252rev.get(c) : (c & 0xFF);
    }
    try {
      const next = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (next === out) break;
      out = next;
    } catch { break; }
  }
  return out;
};
const repairMojibake = () => {
  const root = document.getElementById('root');
  if (!root) return;
  const fixText = (input) => {
    let result = '', i = 0;
    while (i < input.length) {
      if (input.charCodeAt(i) > 0x7F) {
        let j = i;
        while (j < input.length && input.charCodeAt(j) > 0x7F) j++;
        result += _fixSeg(input.slice(i, j));
        i = j;
      } else { result += input[i++]; }
    }
    return result;
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const value = node.nodeValue || '';
    if (!/[-ɏ]/.test(value)) return;
    const fixed = fixText(value);
    if (fixed !== value) node.nodeValue = fixed;
  });
};

// ============================================================================
// ScaledSurface / Preview shells
// ============================================================================
const ScaledSurface = ({ width, height, className = "", children, fit = "contain" }) => {
  const wrapRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const update = () => {
      const node = wrapRef.current;
      if (!node) return;
      const available = node.clientWidth;
      const verticalLimit = Math.max(420, window.innerHeight - 190);
      const widthScale = available / width;
      const nextScale = fit === "width"
        ? widthScale
        : Math.min(1, widthScale, verticalLimit / height);
      setScale(Number.isFinite(nextScale) ? nextScale : 1);
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer && wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener("resize", update);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [width]);
  return (
    <div ref={wrapRef} className={`scaled-surface ${className}`} style={{ height: Math.round(height * scale) }}>
      <div className="scaled-surface__stage" style={{ width: Math.round(width * scale), height: Math.round(height * scale) }}>
        <div className="scaled-surface__canvas" style={{ width, height, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const PreviewCard = ({ label, meta, children, tone = "dark" }) => (
  <section className={`preview-card preview-card--${tone}`}>
    <header className="preview-card__head">
      <div><h2>{label}</h2><p>{meta}</p></div>
    </header>
    <div className="preview-card__body">{children}</div>
  </section>
);

const PhonePreview = () => (
  <section className="phone-showcase">
    <ScaledSurface width={430} height={900} className="phone-showcase__scale">
      <div className="phone-frame">
        <div className="phone-frame__side phone-frame__side--left-1" />
        <div className="phone-frame__side phone-frame__side--left-2" />
        <div className="phone-frame__side phone-frame__side--right" />
        <div className="phone-frame__island" />
        <div className="phone-frame__status">
          <span>9:41</span>
          <span className="phone-frame__icons">
            <span className="phone-frame__signal" />
            <span className="phone-frame__wifi" />
            <span className="phone-frame__battery" />
          </span>
        </div>
        <div className="phone-frame__screen"><Mobile /></div>
      </div>
    </ScaledSurface>
    <div className="phone-showcase__caption">02 · DASHBOARD MOBILE</div>
  </section>
);

const DesktopPreview = () => (
  <PreviewCard label="Desktop web" meta="1440 x 940 - dashboard administrativo" tone="desktop">
    <section className="desktop-device">
      <div className="desktop-device__bar">
        <div className="desktop-device__lights"><span /><span /><span /></div>
        <div className="desktop-device__url">calendario.barbeariapraiagrande.com.br/dashboard</div>
        <div className="desktop-device__dots"><span /><span /><span /></div>
      </div>
      <div className="desktop-device__screen">
        <ScaledSurface width={1440} height={940} className="desktop-showcase" fit="width">
          <Desktop />
        </ScaledSurface>
      </div>
      <div className="desktop-device__base" />
    </section>
  </PreviewCard>
);

const MobilePreview = () => (
  <PreviewCard label="Mobile app" meta="390 x 844 - fluxo operacional no celular" tone="warm">
    <PhonePreview />
  </PreviewCard>
);

// ============================================================================
// Root
// ============================================================================
const ValidationApp = () => {
  const initialMode = new URLSearchParams(window.location.search).get("mode") === "mobile" ? "mobile" : "desktop";
  const [mode, setMode] = React.useState(initialMode);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    fetch("http://localhost:3333/profissionais")
      .then(r => r.json())
      .then(data => {
        let changed = false;
        data.forEach(prof => {
          const p = PROFISSIONAIS.find(p => p.id === prof.id);
          if (p && prof.cor && p.color !== prof.cor) {
            p.color = prof.cor;
            if (PROF_BY_ID[p.id]) PROF_BY_ID[p.id].color = prof.cor;
            changed = true;
          }
        });
        if (changed) forceUpdate();
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(repairMojibake);
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  return (
    <main className="validation-root">
      <header className="validation-toolbar">
        <div className="validation-toolbar__brand">
          <span className="validation-toolbar__mark"><Icon name="bar-chart" size={15} /></span>
          <div>
            <h1>Dashboard CALENDARIO</h1>
            <p>Visualizacao isolada para validar desktop e mobile antes de integrar.</p>
          </div>
        </div>
        <div className="validation-toolbar__seg" role="tablist" aria-label="Modo de visualizacao">
          {[["desktop", "Desktop"], ["mobile", "Mobile"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id}
              className={mode === id ? "is-active" : ""} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className={`validation-stage validation-stage--${mode}`}>
        {mode === "desktop" && <DesktopPreview />}
        {mode === "mobile"  && <MobilePreview />}
      </div>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<ValidationApp />);
