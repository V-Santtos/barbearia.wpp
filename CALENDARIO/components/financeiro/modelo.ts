/**
 * Vocabulário e cálculos da seção Financeiro.
 *
 * Este module traduz fatos que a interface já conhece (agenda, profissionais e
 * serviços) para uma leitura financeira operacional. Ele não é um contrato de
 * backend: enquanto não existe estado de pagamento, o número derivado da agenda
 * é sempre chamado de faturamento dos atendimentos concluídos, nunca recebido.
 */
import type { ConfiguredService } from "../../services/calendarApi";
import type { Event, Professional } from "../../types";

export type PeriodoFinanceiro =
  | "hoje"
  | "15-dias"
  | "mes"
  | "6-meses"
  | "ano";

export type TipoMovimentoFinanceiro = "receita" | "saida" | "ajuste";
export type OrigemMovimentoFinanceiro = "automatico" | "manual";
export type OrigemPrecoServico = "configurado" | "fallback" | "indisponivel";

export interface DetalhesAtendimentoFinanceiro {
  atendimentoId: number;
  cliente: string;
  profissional: string;
  profissionalId: number;
  servico: string;
  horario?: string;
  origemPreco: OrigemPrecoServico;
}

export interface MovimentoFinanceiro {
  id: string;
  tipo: TipoMovimentoFinanceiro;
  origem: OrigemMovimentoFinanceiro;
  /** Data local no formato YYYY-MM-DD. */
  data: string;
  descricao: string;
  categoria: string;
  /**
   * Receita e saída guardam magnitude positiva; o tipo define o impacto.
   * Ajustes preservam o sinal para poder corrigir o resultado nos dois sentidos.
   */
  valor: number;
  atendimento?: DetalhesAtendimentoFinanceiro;
  /** Identifica exclusivamente a massa visual; não deve ser persistido. */
  demonstrativo?: boolean;
}

export interface LancamentoManual {
  tipo: Exclude<TipoMovimentoFinanceiro, "receita">;
  categoria: string;
  valor: number;
  data: string;
  descricao: string;
}

export interface IntervaloFinanceiro {
  inicio: string;
  fim: string;
  rotulo: string;
}

export interface ResumoFinanceiro {
  faturamento: number;
  saidas: number;
  ajustes: number;
  resultado: number;
  atendimentos: number;
  ticketMedio: number;
}

export type TendenciaFinanceira = "alta" | "queda" | "estavel";

export interface ComparacaoMetricaFinanceira {
  atual: number;
  anterior: number;
  delta: number;
  /** Nulo quando a base anterior é zero e não existe percentual honesto. */
  percentual: number | null;
  tendencia: TendenciaFinanceira;
}

export interface ComparacaoFinanceira {
  intervalos: {
    atual: IntervaloFinanceiro;
    anterior: IntervaloFinanceiro;
  };
  resumos: {
    atual: ResumoFinanceiro;
    anterior: ResumoFinanceiro;
  };
  metricas: {
    faturamento: ComparacaoMetricaFinanceira;
    saidas: ComparacaoMetricaFinanceira;
    resultado: ComparacaoMetricaFinanceira;
    atendimentos: ComparacaoMetricaFinanceira;
    ticketMedio: ComparacaoMetricaFinanceira;
  };
}

export interface PontoSerieFinanceira {
  chave: string;
  rotulo: string;
  inicio: string;
  fim: string;
  faturamento: number;
  saidas: number;
  ajustes: number;
  resultado: number;
  atendimentos: number;
}

export interface ItemComposicaoFinanceira {
  id: string;
  nome: string;
  valor: number;
  quantidade: number;
  percentual: number;
}

export interface FiltrosFinanceiros {
  intervalo?: Pick<IntervaloFinanceiro, "inicio" | "fim">;
  tipos?: TipoMovimentoFinanceiro[];
  origens?: OrigemMovimentoFinanceiro[];
  categorias?: string[];
  servicos?: string[];
  profissionais?: number[];
  busca?: string;
}

export const ROTULOS_PERIODOS_FINANCEIROS: Readonly<
  Record<PeriodoFinanceiro, string>
> = {
  hoje: "Hoje",
  "15-dias": "15 dias",
  mes: "Mês",
  "6-meses": "6 meses",
  ano: "Ano",
};

/**
 * Só cobre os serviços conhecidos pelo calendário de demonstração. Um serviço
 * desconhecido e sem preço configurado continua com preço indisponível (zero),
 * em vez de inventarmos faturamento.
 */
export const PRECOS_FALLBACK_SERVICOS_CONHECIDOS: Readonly<
  Record<string, number>
> = {
  corte: 35,
  "corte + barba": 55,
  barba: 25,
  pezinho: 15,
  sobrancelha: 15,
  "corte + sobrancelha": 45,
};

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatadorMoedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatadorInteiro = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const formatadorPercentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatadorDiaMes = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const formatadorMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const formatadorMesAno = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
});

function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function somarDias(data: Date, quantidade: number): Date {
  const copia = inicioDoDia(data);
  copia.setDate(copia.getDate() + quantidade);
  return copia;
}

function inicioDoMes(data: Date, deslocamento = 0): Date {
  return new Date(data.getFullYear(), data.getMonth() + deslocamento, 1);
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

function dataLimitadaAoMes(ano: number, mes: number, dia: number): Date {
  return new Date(ano, mes, Math.min(dia, ultimoDiaDoMes(ano, mes)));
}

function paraIsoLocal(data: Date): string {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function deIsoLocal(valor: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? "").trim());
  if (!match) return null;

  const ano = Number(match[1]);
  const mes = Number(match[2]) - 1;
  const dia = Number(match[3]);
  const data = new Date(ano, mes, dia);
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes ||
    data.getDate() !== dia
  ) {
    return null;
  }
  return data;
}

function normalizarDataIso(valor: string | undefined): string | null {
  if (!valor) return null;
  const data = deIsoLocal(valor);
  return data ? paraIsoLocal(data) : null;
}

function semAcentos(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function chaveDeServico(valor: string): string {
  return semAcentos(valor)
    .replace(/\s+(?:e|&)\s+/g, "+")
    .replace(/[^a-z0-9]+/g, "");
}

function arredondarMoeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function paraCentavos(valor: number): number {
  return Math.round(arredondarMoeda(valor) * 100);
}

function deCentavos(valor: number): number {
  return valor / 100;
}

function precoConfiguradoEmReais(valor: string | undefined): number | null {
  const bruto = String(valor ?? "")
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!bruto) return null;

  const ultimaVirgula = bruto.lastIndexOf(",");
  const ultimoPonto = bruto.lastIndexOf(".");
  let normalizado = bruto;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? /\./g : /,/g;
    normalizado = bruto.replace(milhar, "").replace(decimal, ".");
  } else if (ultimaVirgula >= 0) {
    normalizado = bruto.replace(/\./g, "").replace(",", ".");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0
    ? arredondarMoeda(numero)
    : null;
}

function indiceDePrecos(servicos: ConfiguredService[]): Map<
  string,
  { valor: number; nome: string }
> {
  const indice = new Map<string, { valor: number; nome: string }>();

  for (const servico of servicos) {
    const valor = precoConfiguradoEmReais(servico.price);
    if (valor === null) continue;

    const registro = { valor, nome: servico.name };
    const chaves = [servico.name, servico.slug ?? ""]
      .map(chaveDeServico)
      .filter(Boolean);
    for (const chave of chaves) indice.set(chave, registro);
  }

  return indice;
}

function indiceDeFallback(): Map<string, { valor: number; nome: string }> {
  return new Map(
    Object.entries(PRECOS_FALLBACK_SERVICOS_CONHECIDOS).map(
      ([nome, valor]) => [chaveDeServico(nome), { nome, valor }],
    ),
  );
}

function resolverPreco(
  nomeServico: string,
  precosConfigurados: Map<string, { valor: number; nome: string }>,
  precosFallback: Map<string, { valor: number; nome: string }>,
): { valor: number; origem: OrigemPrecoServico } {
  const chave = chaveDeServico(nomeServico);
  const configurado = precosConfigurados.get(chave);
  if (configurado) return { valor: configurado.valor, origem: "configurado" };

  const fallback = precosFallback.get(chave);
  if (fallback) return { valor: fallback.valor, origem: "fallback" };

  return { valor: 0, origem: "indisponivel" };
}

function ordenarMovimentos(movimentos: MovimentoFinanceiro[]): MovimentoFinanceiro[] {
  return [...movimentos].sort((a, b) => {
    const porData = b.data.localeCompare(a.data);
    if (porData !== 0) return porData;
    const porHora = (b.atendimento?.horario ?? "").localeCompare(
      a.atendimento?.horario ?? "",
    );
    return porHora !== 0 ? porHora : b.id.localeCompare(a.id);
  });
}

/**
 * Cada evento concluído vira uma receita automática. Um preço desconhecido fica
 * em zero e leva `origemPreco: "indisponivel"`, permitindo que a interface conte
 * o atendimento sem atribuir a ele um valor inventado.
 */
export function converterEventosEmReceitas(
  eventos: Event[],
  profissionais: Professional[],
  servicos: ConfiguredService[],
): MovimentoFinanceiro[] {
  const profissionaisPorId = new Map(
    profissionais.map((profissional) => [profissional.id, profissional]),
  );
  const precosConfigurados = indiceDePrecos(servicos);
  const precosFallback = indiceDeFallback();

  const receitas = eventos.flatMap<MovimentoFinanceiro>((evento) => {
    if (String(evento.status ?? "").trim().toLocaleLowerCase("pt-BR") !== "concluido") {
      return [];
    }

    const data = normalizarDataIso(evento.dia_marcado ?? evento.date);
    if (!data) return [];

    const servico = String(evento.servico ?? "").trim() || "Serviço não informado";
    const cliente = String(evento.cliente ?? evento.title ?? "").trim() ||
      "Cliente não informado";
    const profissionalCadastrado = profissionaisPorId.get(evento.professionalId);
    const profissional = String(
      profissionalCadastrado?.name ??
        profissionalCadastrado?.nome ??
        evento.profissional ??
        "",
    ).trim() || "Profissional não informado";
    const preco = resolverPreco(servico, precosConfigurados, precosFallback);

    return [
      {
        id: `receita:atendimento:${evento.id}`,
        tipo: "receita",
        origem: "automatico",
        data,
        descricao: `${servico} · ${cliente}`,
        categoria: "Serviços",
        valor: preco.valor,
        atendimento: {
          atendimentoId: evento.id,
          cliente,
          profissional,
          profissionalId: evento.professionalId,
          servico,
          horario: evento.hora_marcada ?? evento.startTime ?? undefined,
          origemPreco: preco.origem,
        },
      },
    ];
  });

  return ordenarMovimentos(receitas);
}

interface MoldeDespesaDemonstrativa {
  id: string;
  descricao: string;
  categoria: string;
  dia: number;
  valores: readonly number[];
  aCadaMeses?: number;
}

interface MoldeReceitaDemonstrativa {
  servico: string;
  valor: number;
}

const MOLDES_RECEITAS: readonly MoldeReceitaDemonstrativa[] = [
  { servico: "Corte", valor: 35 },
  { servico: "Corte + Barba", valor: 55 },
  { servico: "Corte", valor: 35 },
  { servico: "Barba", valor: 25 },
  { servico: "Corte + Sobrancelha", valor: 45 },
  { servico: "Corte", valor: 35 },
  { servico: "Pezinho", valor: 15 },
  { servico: "Corte + Barba", valor: 55 },
  { servico: "Sobrancelha", valor: 15 },
];

const PROFISSIONAIS_RECEITAS = [
  { id: 1, nome: "Lucas Costa" },
  { id: 2, nome: "Rafael Dias" },
  { id: 3, nome: "Bruno Sales" },
] as const;

const CLIENTES_RECEITAS = [
  "André Lima",
  "Caio Mendes",
  "Daniel Rocha",
  "Eduardo Nunes",
  "Felipe Alves",
  "Gabriel Souza",
  "Henrique Martins",
  "Igor Ferreira",
  "João Ribeiro",
  "Leandro Gomes",
  "Marcelo Batista",
  "Otávio Freitas",
] as const;

const BASE_ATENDIMENTOS_POR_DIA = [0, 8, 10, 11, 12, 15, 17] as const;
const SAZONALIDADE_MENSAL = [0, -1, 0, 0, 1, 0, -1, 0, 1, 0, 1, 3] as const;

/**
 * Histórico exclusivamente visual do modo mock. Ele simula uma barbearia de
 * três profissionais com movimento maior às sextas, sábados e em dezembro.
 * São 24 meses para os filtros longos e suas comparações terem barras reais,
 * sem colocar milhares de agendamentos fictícios na agenda operacional.
 */
export function criarReceitasDemonstrativas(
  referencia = new Date(),
): MovimentoFinanceiro[] {
  const hoje = inicioDoDia(referencia);
  const inicio = inicioDoMes(hoje, -23);
  const movimentos: MovimentoFinanceiro[] = [];

  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, 1)) {
    const diaSemana = dia.getDay();
    if (diaSemana === 0) continue;

    const oscilacao = ((dia.getDate() * 7 + dia.getMonth() * 3) % 5) - 2;
    const quantidade = Math.max(
      5,
      BASE_ATENDIMENTOS_POR_DIA[diaSemana] +
        SAZONALIDADE_MENSAL[dia.getMonth()] +
        oscilacao,
    );
    const data = paraIsoLocal(dia);

    for (let indice = 0; indice < quantidade; indice += 1) {
      const molde = MOLDES_RECEITAS[
        (indice * 5 + dia.getDate() + dia.getMonth()) % MOLDES_RECEITAS.length
      ];
      const profissional = PROFISSIONAIS_RECEITAS[
        (indice + dia.getDate()) % PROFISSIONAIS_RECEITAS.length
      ];
      const cliente = CLIENTES_RECEITAS[
        (indice * 3 + dia.getDate() + dia.getMonth()) % CLIENTES_RECEITAS.length
      ];
      const minutos = 9 * 60 + ((indice * 47 + dia.getDate() * 11) % (10 * 60));
      const horario = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(
        minutos % 60,
      ).padStart(2, "0")}`;

      movimentos.push({
        id: `receita:demonstrativo:${data}:${indice}`,
        tipo: "receita",
        origem: "automatico",
        data,
        descricao: `${molde.servico} · ${cliente}`,
        categoria: "Serviços",
        valor: molde.valor,
        atendimento: {
          atendimentoId: 900000 + movimentos.length,
          cliente,
          profissional: profissional.nome,
          profissionalId: profissional.id,
          servico: molde.servico,
          horario,
          origemPreco: "fallback",
        },
        demonstrativo: true,
      });
    }
  }

  return ordenarMovimentos(movimentos);
}

const MOLDES_DESPESAS: readonly MoldeDespesaDemonstrativa[] = [
  {
    id: "aluguel",
    descricao: "Aluguel do ponto",
    categoria: "Estrutura",
    dia: 5,
    valores: [1850],
  },
  {
    id: "materiais",
    descricao: "Produtos e materiais de trabalho",
    categoria: "Materiais",
    dia: 9,
    valores: [580, 720, 640, 810, 690, 760],
  },
  {
    id: "contas",
    descricao: "Água, energia e internet",
    categoria: "Contas",
    dia: 14,
    valores: [390, 425, 410, 448, 405, 432],
  },
  {
    id: "divulgacao",
    descricao: "Divulgação local",
    categoria: "Marketing",
    dia: 18,
    valores: [160, 220, 180, 240],
  },
  {
    id: "manutencao",
    descricao: "Manutenção de máquinas e cadeiras",
    categoria: "Manutenção",
    dia: 21,
    valores: [280, 360, 240],
    aCadaMeses: 3,
  },
  {
    id: "equipamentos",
    descricao: "Investimento em equipamentos",
    categoria: "Investimentos",
    dia: 24,
    valores: [620, 890],
    aCadaMeses: 6,
  },
];

/**
 * Massa visual previsível: os últimos 24 meses, sempre relativos à referência.
 * O segundo ano existe para a comparação anual não cair em "sem base anterior".
 * Não há aleatoriedade nem datas futuras no mês corrente.
 */
export function criarDespesasDemonstrativas(
  referencia = new Date(),
): MovimentoFinanceiro[] {
  const hoje = inicioDoDia(referencia);
  const meses = Array.from({ length: 24 }, (_, indice) =>
    inicioDoMes(hoje, indice - 23),
  );
  const movimentos: MovimentoFinanceiro[] = [];

  for (const mes of meses) {
    const indiceAbsoluto = mes.getFullYear() * 12 + mes.getMonth();
    const mesCorrente =
      mes.getFullYear() === hoje.getFullYear() &&
      mes.getMonth() === hoje.getMonth();

    for (const molde of MOLDES_DESPESAS) {
      if (molde.aCadaMeses && indiceAbsoluto % molde.aCadaMeses !== 0) continue;
      if (mesCorrente && molde.dia > hoje.getDate()) continue;

      const dia = Math.min(
        molde.dia,
        ultimoDiaDoMes(mes.getFullYear(), mes.getMonth()),
      );
      const data = new Date(mes.getFullYear(), mes.getMonth(), dia);
      const valor = molde.valores[
        Math.abs(indiceAbsoluto) % molde.valores.length
      ];
      const chaveMes = paraIsoLocal(mes).slice(0, 7);

      movimentos.push({
        id: `manual:demonstrativo:${chaveMes}:${molde.id}`,
        tipo: "saida",
        origem: "manual",
        data: paraIsoLocal(data),
        descricao: molde.descricao,
        categoria: molde.categoria,
        valor,
        demonstrativo: true,
      });
    }
  }

  return ordenarMovimentos(movimentos);
}

export function criarMovimentoManual(
  lancamento: LancamentoManual,
  id = `manual:${lancamento.data}:${chaveDeServico(lancamento.descricao) || "lancamento"}`,
): MovimentoFinanceiro {
  return {
    id,
    tipo: lancamento.tipo,
    origem: "manual",
    data: normalizarDataIso(lancamento.data) ?? lancamento.data,
    descricao: lancamento.descricao.trim(),
    categoria: lancamento.categoria.trim(),
    valor:
      lancamento.tipo === "saida"
        ? Math.abs(arredondarMoeda(lancamento.valor))
        : arredondarMoeda(lancamento.valor),
  };
}

/** Monta a fonte única consumida por cartões, gráficos e tabela. */
export function montarMovimentosFinanceiros(
  eventos: Event[],
  profissionais: Professional[],
  servicos: ConfiguredService[],
  referencia = new Date(),
): MovimentoFinanceiro[] {
  return ordenarMovimentos([
    ...converterEventosEmReceitas(eventos, profissionais, servicos),
    ...criarDespesasDemonstrativas(referencia),
  ]);
}

function rotuloDeIntervalo(inicio: Date, fim: Date): string {
  if (paraIsoLocal(inicio) === paraIsoLocal(fim)) {
    return limparPontoDeMes(formatadorData.format(inicio));
  }
  const formatadorInicio = inicio.getFullYear() === fim.getFullYear()
    ? formatadorDiaMes
    : formatadorData;
  return `${limparPontoDeMes(formatadorInicio.format(inicio))} – ${limparPontoDeMes(
    formatadorData.format(fim),
  )}`;
}

function intervalo(inicio: Date, fim: Date): IntervaloFinanceiro {
  return {
    inicio: paraIsoLocal(inicio),
    fim: paraIsoLocal(fim),
    rotulo: rotuloDeIntervalo(inicio, fim),
  };
}

export function obterIntervaloAtual(
  periodo: PeriodoFinanceiro,
  referencia = new Date(),
  anoSelecionado = referencia.getFullYear(),
): IntervaloFinanceiro {
  const hoje = inicioDoDia(referencia);

  switch (periodo) {
    case "hoje":
      return intervalo(hoje, hoje);
    case "15-dias":
      return intervalo(somarDias(hoje, -14), hoje);
    case "mes":
      return intervalo(inicioDoMes(hoje), hoje);
    case "6-meses":
      return intervalo(inicioDoMes(hoje, -5), hoje);
    case "ano": {
      const ano = Math.min(anoSelecionado, hoje.getFullYear());
      const fim = ano === hoje.getFullYear() ? hoje : new Date(ano, 11, 31);
      return intervalo(new Date(ano, 0, 1), fim);
    }
  }
}

export function obterIntervaloAnterior(
  periodo: PeriodoFinanceiro,
  referencia = new Date(),
  anoSelecionado = referencia.getFullYear(),
): IntervaloFinanceiro {
  const hoje = inicioDoDia(referencia);

  switch (periodo) {
    case "hoje": {
      const ontem = somarDias(hoje, -1);
      return intervalo(ontem, ontem);
    }
    case "15-dias":
      return intervalo(somarDias(hoje, -29), somarDias(hoje, -15));
    case "mes": {
      const inicio = inicioDoMes(hoje, -1);
      const fim = dataLimitadaAoMes(
        inicio.getFullYear(),
        inicio.getMonth(),
        hoje.getDate(),
      );
      return intervalo(inicio, fim);
    }
    case "6-meses": {
      const inicio = inicioDoMes(hoje, -11);
      const mesFinal = inicioDoMes(hoje, -6);
      const fim = dataLimitadaAoMes(
        mesFinal.getFullYear(),
        mesFinal.getMonth(),
        hoje.getDate(),
      );
      return intervalo(inicio, fim);
    }
    case "ano": {
      const ano = Math.min(anoSelecionado, hoje.getFullYear());
      const anoAnterior = ano - 1;
      const inicio = new Date(anoAnterior, 0, 1);
      const fim = ano === hoje.getFullYear()
        ? dataLimitadaAoMes(anoAnterior, hoje.getMonth(), hoje.getDate())
        : new Date(anoAnterior, 11, 31);
      return intervalo(inicio, fim);
    }
  }
}

export function obterIntervalosFinanceiros(
  periodo: PeriodoFinanceiro,
  referencia = new Date(),
  anoSelecionado = referencia.getFullYear(),
): ComparacaoFinanceira["intervalos"] {
  return {
    atual: obterIntervaloAtual(periodo, referencia, anoSelecionado),
    anterior: obterIntervaloAnterior(periodo, referencia, anoSelecionado),
  };
}

/** Anos realmente consultáveis, mais o ano corrente para preservar o estado vazio. */
export function obterAnosFinanceirosDisponiveis(
  movimentos: MovimentoFinanceiro[],
  referencia = new Date(),
): number[] {
  const anoAtual = inicioDoDia(referencia).getFullYear();
  const anos = new Set<number>([anoAtual]);

  for (const movimento of movimentos) {
    const data = deIsoLocal(movimento.data);
    if (data && data.getFullYear() <= anoAtual) anos.add(data.getFullYear());
  }

  return [...anos].sort((a, b) => b - a);
}

function contemNormalizado(lista: string[], valor: string): boolean {
  const chave = semAcentos(valor);
  return lista.some((item) => semAcentos(item) === chave);
}

export function filtrarMovimentosFinanceiros(
  movimentos: MovimentoFinanceiro[],
  filtros: FiltrosFinanceiros = {},
): MovimentoFinanceiro[] {
  const busca = semAcentos(filtros.busca ?? "");

  return movimentos.filter((movimento) => {
    if (
      filtros.intervalo &&
      (movimento.data < filtros.intervalo.inicio ||
        movimento.data > filtros.intervalo.fim)
    ) {
      return false;
    }
    if (filtros.tipos?.length && !filtros.tipos.includes(movimento.tipo)) {
      return false;
    }
    if (filtros.origens?.length && !filtros.origens.includes(movimento.origem)) {
      return false;
    }
    if (
      filtros.categorias?.length &&
      !contemNormalizado(filtros.categorias, movimento.categoria)
    ) {
      return false;
    }
    if (
      filtros.servicos?.length &&
      !contemNormalizado(
        filtros.servicos,
        movimento.atendimento?.servico ?? "",
      )
    ) {
      return false;
    }
    if (
      filtros.profissionais?.length &&
      !filtros.profissionais.includes(
        movimento.atendimento?.profissionalId ?? Number.NaN,
      )
    ) {
      return false;
    }
    if (busca) {
      const texto = semAcentos(
        [
          movimento.descricao,
          movimento.categoria,
          movimento.atendimento?.cliente,
          movimento.atendimento?.profissional,
          movimento.atendimento?.servico,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (!texto.includes(busca)) return false;
    }
    return true;
  });
}

export function filtrarMovimentosPorPeriodo(
  movimentos: MovimentoFinanceiro[],
  periodo: PeriodoFinanceiro,
  referencia = new Date(),
): MovimentoFinanceiro[] {
  return filtrarMovimentosFinanceiros(movimentos, {
    intervalo: obterIntervaloAtual(periodo, referencia),
  });
}

export function resumirMovimentosFinanceiros(
  movimentos: MovimentoFinanceiro[],
): ResumoFinanceiro {
  let faturamento = 0;
  let saidas = 0;
  let ajustes = 0;
  let atendimentos = 0;

  for (const movimento of movimentos) {
    const centavos = paraCentavos(movimento.valor);
    if (movimento.tipo === "receita") {
      faturamento += Math.max(0, centavos);
      if (movimento.atendimento) atendimentos += 1;
    } else if (movimento.tipo === "saida") {
      saidas += Math.abs(centavos);
    } else {
      ajustes += centavos;
    }
  }

  const resultado = faturamento - saidas + ajustes;
  return {
    faturamento: deCentavos(faturamento),
    saidas: deCentavos(saidas),
    ajustes: deCentavos(ajustes),
    resultado: deCentavos(resultado),
    atendimentos,
    ticketMedio:
      atendimentos > 0 ? deCentavos(Math.round(faturamento / atendimentos)) : 0,
  };
}

function compararMetrica(
  atual: number,
  anterior: number,
): ComparacaoMetricaFinanceira {
  const delta = arredondarMoeda(atual - anterior);
  const percentual =
    anterior === 0
      ? atual === 0
        ? 0
        : null
      : arredondarMoeda((delta / Math.abs(anterior)) * 100);
  return {
    atual,
    anterior,
    delta,
    percentual,
    tendencia: delta > 0 ? "alta" : delta < 0 ? "queda" : "estavel",
  };
}

export function compararResumosFinanceiros(
  atual: ResumoFinanceiro,
  anterior: ResumoFinanceiro,
): ComparacaoFinanceira["metricas"] {
  return {
    faturamento: compararMetrica(atual.faturamento, anterior.faturamento),
    saidas: compararMetrica(atual.saidas, anterior.saidas),
    resultado: compararMetrica(atual.resultado, anterior.resultado),
    atendimentos: compararMetrica(atual.atendimentos, anterior.atendimentos),
    ticketMedio: compararMetrica(atual.ticketMedio, anterior.ticketMedio),
  };
}

export function compararPeriodoFinanceiro(
  movimentos: MovimentoFinanceiro[],
  periodo: PeriodoFinanceiro,
  referencia = new Date(),
  anoSelecionado = referencia.getFullYear(),
): ComparacaoFinanceira {
  const intervalos = obterIntervalosFinanceiros(
    periodo,
    referencia,
    anoSelecionado,
  );
  const atual = resumirMovimentosFinanceiros(
    filtrarMovimentosFinanceiros(movimentos, { intervalo: intervalos.atual }),
  );
  const anterior = resumirMovimentosFinanceiros(
    filtrarMovimentosFinanceiros(movimentos, { intervalo: intervalos.anterior }),
  );

  return {
    intervalos,
    resumos: { atual, anterior },
    metricas: compararResumosFinanceiros(atual, anterior),
  };
}

function limparPontoDeMes(valor: string): string {
  return valor.replace(/\.(?=\s|\/|$)/g, "");
}

function chaveMensal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function criarPontosVazios(
  periodo: PeriodoFinanceiro,
  intervaloSelecionado: IntervaloFinanceiro,
): PontoSerieFinanceira[] {
  const inicio = deIsoLocal(intervaloSelecionado.inicio);
  const fim = deIsoLocal(intervaloSelecionado.fim);
  if (!inicio || !fim || inicio > fim) return [];

  const mensal = periodo === "6-meses" || periodo === "ano";
  const cruzaAno = inicio.getFullYear() !== fim.getFullYear();
  const pontos: PontoSerieFinanceira[] = [];

  if (mensal) {
    for (
      let cursor = inicioDoMes(inicio);
      cursor <= fim;
      cursor = inicioDoMes(cursor, 1)
    ) {
      const inicioPonto = cursor < inicio ? inicio : cursor;
      const ultimo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const fimPonto = ultimo > fim ? fim : ultimo;
      pontos.push({
        chave: chaveMensal(cursor),
        rotulo: limparPontoDeMes(
          (cruzaAno ? formatadorMesAno : formatadorMes).format(cursor),
        ),
        inicio: paraIsoLocal(inicioPonto),
        fim: paraIsoLocal(fimPonto),
        faturamento: 0,
        saidas: 0,
        ajustes: 0,
        resultado: 0,
        atendimentos: 0,
      });
    }
    return pontos;
  }

  for (let cursor = inicio; cursor <= fim; cursor = somarDias(cursor, 1)) {
    const data = paraIsoLocal(cursor);
    pontos.push({
      chave: data,
      rotulo: limparPontoDeMes(formatadorDiaMes.format(cursor)),
      inicio: data,
      fim: data,
      faturamento: 0,
      saidas: 0,
      ajustes: 0,
      resultado: 0,
      atendimentos: 0,
    });
  }
  return pontos;
}

export function agruparSerieFinanceira(
  movimentos: MovimentoFinanceiro[],
  periodo: PeriodoFinanceiro,
  intervaloSelecionado = obterIntervaloAtual(periodo),
): PontoSerieFinanceira[] {
  const pontos = criarPontosVazios(periodo, intervaloSelecionado);
  const porChave = new Map(pontos.map((ponto) => [ponto.chave, ponto]));
  const mensal = periodo === "6-meses" || periodo === "ano";
  const filtrados = filtrarMovimentosFinanceiros(movimentos, {
    intervalo: intervaloSelecionado,
  });

  for (const movimento of filtrados) {
    const chave = mensal ? movimento.data.slice(0, 7) : movimento.data;
    const ponto = porChave.get(chave);
    if (!ponto) continue;

    if (movimento.tipo === "receita") {
      ponto.faturamento = arredondarMoeda(
        ponto.faturamento + Math.max(0, movimento.valor),
      );
      if (movimento.atendimento) ponto.atendimentos += 1;
    } else if (movimento.tipo === "saida") {
      ponto.saidas = arredondarMoeda(ponto.saidas + Math.abs(movimento.valor));
    } else {
      ponto.ajustes = arredondarMoeda(ponto.ajustes + movimento.valor);
    }
  }

  for (const ponto of pontos) {
    ponto.resultado = arredondarMoeda(
      ponto.faturamento - ponto.saidas + ponto.ajustes,
    );
  }
  return pontos;
}

function agruparComposicao(
  movimentos: MovimentoFinanceiro[],
  nomeDe: (movimento: MovimentoFinanceiro) => string,
): ItemComposicaoFinanceira[] {
  const grupos = new Map<string, { nome: string; centavos: number; quantidade: number }>();

  for (const movimento of movimentos) {
    const nome = nomeDe(movimento).trim() || "Outros";
    const id = semAcentos(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const atual = grupos.get(id) ?? { nome, centavos: 0, quantidade: 0 };
    atual.centavos += Math.abs(paraCentavos(movimento.valor));
    atual.quantidade += 1;
    grupos.set(id, atual);
  }

  const total = [...grupos.values()].reduce(
    (soma, grupo) => soma + grupo.centavos,
    0,
  );

  return [...grupos.entries()]
    .map(([id, grupo]) => ({
      id,
      nome: grupo.nome,
      valor: deCentavos(grupo.centavos),
      quantidade: grupo.quantidade,
      percentual: total > 0 ? (grupo.centavos / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function comporFaturamentoPorServico(
  movimentos: MovimentoFinanceiro[],
): ItemComposicaoFinanceira[] {
  return agruparComposicao(
    movimentos.filter((movimento) => movimento.tipo === "receita"),
    (movimento) => movimento.atendimento?.servico ?? "Serviço não informado",
  );
}

export function agruparDespesasPorCategoria(
  movimentos: MovimentoFinanceiro[],
): ItemComposicaoFinanceira[] {
  return agruparComposicao(
    movimentos.filter((movimento) => movimento.tipo === "saida"),
    (movimento) => movimento.categoria,
  );
}

export function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(Number.isFinite(valor) ? valor : 0);
}

export function formatarMoedaCompacta(valor: number): string {
  return formatadorMoedaCompacta.format(Number.isFinite(valor) ? valor : 0);
}

export function formatarNumero(valor: number): string {
  return formatadorInteiro.format(Number.isFinite(valor) ? valor : 0);
}

/** Recebe pontos percentuais: 12,4 vira "12,4%". */
export function formatarPercentual(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return "—";
  return formatadorPercentual.format(valor / 100);
}

export function formatarVariacaoPercentual(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return "sem base anterior";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${formatarPercentual(valor)}`;
}

export function formatarDataFinanceira(dataIso: string): string {
  const data = deIsoLocal(dataIso);
  return data ? limparPontoDeMes(formatadorData.format(data)) : dataIso;
}

export function formatarIntervaloFinanceiro(
  intervaloSelecionado: Pick<IntervaloFinanceiro, "inicio" | "fim">,
): string {
  const inicio = deIsoLocal(intervaloSelecionado.inicio);
  const fim = deIsoLocal(intervaloSelecionado.fim);
  return inicio && fim
    ? rotuloDeIntervalo(inicio, fim)
    : `${intervaloSelecionado.inicio} – ${intervaloSelecionado.fim}`;
}
