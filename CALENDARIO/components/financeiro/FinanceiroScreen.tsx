/**
 * Financeiro V1 — uma leitura operacional de faturou / saiu / sobrou.
 * Herda a moldura e os tokens do painel; do Studio Admin entram apenas a
 * sequência, a geometria conectada dos KPIs e os padrões de drill-down.
 * Não há recebido, caixa, comissão, assinatura ou forma de pagamento aqui.
 */
import { MODO_DEMONSTRACAO } from "../../lib/modoDemonstracao";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck2,
  GitCompareArrows,
  Plus,
  Scale,
  WalletCards,
} from "lucide-react";
import type { Event, Professional } from "../../types";
import {
  getConfiguredServices,
  type ConfiguredService,
} from "../../services/calendarApi";
import { toast } from "../Toast";
import { SelectField } from "../ui/SelectField";
import {
  agruparDespesasPorCategoria,
  agruparPorSemana,
  agruparSerieFinanceira,
  compararPeriodoFinanceiro,
  comporFaturamentoPorServico,
  somarAjustesDeAtendimento,
  converterEventosEmReceitas,
  criarDespesasDemonstrativas,
  criarReceitasDemonstrativas,
  criarMovimentoManual,
  filtrarMovimentosFinanceiros,
  formatarDataFinanceira,
  formatarMoeda,
  formatarNumero,
  formatarVariacaoPercentual,
  obterAnosFinanceirosDisponiveis,
  ROTULOS_PERIODOS_FINANCEIROS,
  type ItemComposicaoFinanceira,
  type MovimentoFinanceiro,
  type PeriodoFinanceiro,
} from "./modelo";
import {
  ComposicaoServicos,
  DespesasPorCategoria,
  GraficoFluxo,
  ListaFluxo,
} from "./GraficosFinanceiros";
import {
  CompararPeriodosModal,
  ConfirmarExclusaoModal,
  DetalheKpiDrawer,
  DetalheMovimentoDrawer,
  NovoLancamentoModal,
  CATEGORIAS_PADRAO,
  type CategoriasPorTipo,
  type TipoComCategoria,
  type DetalheKpi,
  type LancamentoRascunho,
  type MetricaComparacao,
  type PeriodoComparacao,
  type MovimentoParaDetalhe,
} from "./SobreposicoesFinanceiras";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./financeiro.css";

interface Props {
  eventos: Event[];
  profissionais: Professional[];
  busca: string;
  solicitacaoNovoLancamento: number;
  chaveSessao: string;
  /** Substitui o `<h1>` — no celular é o seletor Dashboard/Financeiro. */
  titulo?: ReactNode;
}

type IdKpi = "faturamento" | "saidas" | "resultado" | "atendimentos";
type FiltroTabela = "todos" | "receita" | "entrada" | "saida";

const PERIODOS = Object.entries(ROTULOS_PERIODOS_FINANCEIROS) as Array<
  [PeriodoFinanceiro, string]
>;


function ordenar(movimentos: MovimentoFinanceiro[]) {
  return [...movimentos].sort((a, b) =>
    b.data.localeCompare(a.data) || b.id.localeCompare(a.id),
  );
}

function paraDetalhe(movimento: MovimentoFinanceiro): MovimentoParaDetalhe {
  return {
    id: movimento.id,
    tipo: movimento.tipo,
    origem: movimento.origem,
    data: movimento.data,
    hora: movimento.atendimento?.horario,
    descricao: movimento.descricao,
    categoria: movimento.categoria,
    valor: movimento.valor,
    cliente: movimento.atendimento?.cliente,
    profissional: movimento.atendimento?.profissional ?? movimento.profissional,
    profissionalId: movimento.profissionalId,
    servico: movimento.atendimento?.servico,
    atendimentoId: movimento.atendimento?.atendimentoId,
  };
}

function juntarComposicoes(
  atual: ItemComposicaoFinanceira[],
  anterior: ItemComposicaoFinanceira[],
  quantidade = false,
) {
  const nomes = new Set([...atual.map((i) => i.nome), ...anterior.map((i) => i.nome)]);
  return [...nomes]
    .map((nome) => ({
      nome,
      atual: quantidade
        ? atual.find((i) => i.nome === nome)?.quantidade ?? 0
        : atual.find((i) => i.nome === nome)?.valor ?? 0,
      anterior: quantidade
        ? anterior.find((i) => i.nome === nome)?.quantidade ?? 0
        : anterior.find((i) => i.nome === nome)?.valor ?? 0,
    }))
    .sort((a, b) => b.atual - a.atual)
    .slice(0, 5);
}

function consolidarComposicao(
  itens: ItemComposicaoFinanceira[],
  limite = 5,
): ItemComposicaoFinanceira[] {
  if (itens.length <= limite) return itens;

  const principais = itens.slice(0, limite - 1);
  const restantes = itens.slice(limite - 1);
  return [
    ...principais,
    {
      id: "outros",
      nome: "Outros",
      valor: restantes.reduce((total, item) => total + item.valor, 0),
      quantidade: restantes.reduce((total, item) => total + item.quantidade, 0),
      percentual: restantes.reduce((total, item) => total + item.percentual, 0),
    },
  ];
}

const movimentosManuaisPorSessao = new Map<string, MovimentoFinanceiro[]>();
// Categorias criadas pelo barbeiro; como os lançamentos, vivem só nesta sessão da prévia.
const categoriasPorSessao = new Map<string, CategoriasPorTipo>();
let ultimaSolicitacaoFinanceiraAtendida = 0;

export default function FinanceiroScreen({
  eventos,
  profissionais,
  busca,
  solicitacaoNovoLancamento,
  chaveSessao,
  titulo,
}: Props) {
  const referencia = useMemo(() => new Date(), []);
  const [servicos, setServicos] = useState<ConfiguredService[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoFinanceiro>("mes");
  const [anoSelecionado, setAnoSelecionado] = useState(() =>
    String(referencia.getFullYear()),
  );
  const [manuais, setManuais] = useState<MovimentoFinanceiro[]>(() =>
    movimentosManuaisPorSessao.get(chaveSessao) ??
      // Mesma condicao das receitas-exemplo, logo abaixo. Faltava aqui: as despesas
      // demonstrativas entravam SEMPRE, e com o banco real apareciam misturadas nas
      // Movimentacoes de verdade. Corrigido na integracao de 28/09/2026.
      (MODO_DEMONSTRACAO ? criarDespesasDemonstrativas(referencia) : []),
  );
  const [categorias, setCategorias] = useState<CategoriasPorTipo>(() =>
    categoriasPorSessao.get(chaveSessao) ?? CATEGORIAS_PADRAO,
  );
  const [novoAberto, setNovoAberto] = useState(false);
  const [comparacaoAberta, setComparacaoAberta] = useState(false);
  // A janela de comparar tem a própria escolha de período; abre com a da tela.
  const [periodoComparacao, setPeriodoComparacao] = useState<PeriodoComparacao>("mes");
  const [kpiAtivo, setKpiAtivo] = useState<IdKpi | null>(null);
  const [movimentoAtivo, setMovimentoAtivo] = useState<MovimentoParaDetalhe | null>(null);
  const [exclusaoAtiva, setExclusaoAtiva] = useState<MovimentoParaDetalhe | null>(null);
  const [filtroTabela, setFiltroTabela] = useState<FiltroTabela>("todos");
  const [limiteTabela, setLimiteTabela] = useState(6);
  const ultimaSolicitacao = useRef(ultimaSolicitacaoFinanceiraAtendida);
  const tabelaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ativo = true;
    void getConfiguredServices()
      .then((lista) => ativo && setServicos(lista))
      .catch(() => ativo && setServicos([]));
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    movimentosManuaisPorSessao.set(chaveSessao, manuais);
  }, [chaveSessao, manuais]);

  useEffect(() => {
    categoriasPorSessao.set(chaveSessao, categorias);
  }, [chaveSessao, categorias]);

  const barbeiros = useMemo(
    () => profissionais.map((profissional) => ({ id: profissional.id, nome: profissional.name })),
    [profissionais],
  );

  const criarCategoria = (tipo: TipoComCategoria, nome: string) =>
    setCategorias((atuais) =>
      atuais[tipo].includes(nome) ? atuais : { ...atuais, [tipo]: [...atuais[tipo], nome] },
    );

  useEffect(() => {
    if (
      solicitacaoNovoLancamento > 0 &&
      solicitacaoNovoLancamento !== ultimaSolicitacao.current
    ) {
      ultimaSolicitacao.current = solicitacaoNovoLancamento;
      ultimaSolicitacaoFinanceiraAtendida = solicitacaoNovoLancamento;
      setNovoAberto(true);
    }
  }, [solicitacaoNovoLancamento]);

  const receitas = useMemo(
    () => ordenar([
      ...converterEventosEmReceitas(eventos, profissionais, servicos),
      ...(MODO_DEMONSTRACAO ? criarReceitasDemonstrativas(referencia) : []),
    ]),
    [eventos, profissionais, servicos, referencia],
  );
  const movimentos = useMemo(() => ordenar([...receitas, ...manuais]), [receitas, manuais]);
  const opcoesAno = useMemo(
    () => obterAnosFinanceirosDisponiveis(movimentos, referencia).map((ano) => ({
      value: String(ano),
      label: String(ano),
    })),
    [movimentos, referencia],
  );
  const comparacao = useMemo(
    () => compararPeriodoFinanceiro(
      movimentos,
      periodo,
      referencia,
      Number(anoSelecionado),
    ),
    [movimentos, periodo, referencia, anoSelecionado],
  );
  const movimentosAtuais = useMemo(
    () => filtrarMovimentosFinanceiros(movimentos, { intervalo: comparacao.intervalos.atual }),
    [movimentos, comparacao.intervalos.atual],
  );
  const movimentosAnteriores = useMemo(
    () => filtrarMovimentosFinanceiros(movimentos, { intervalo: comparacao.intervalos.anterior }),
    [movimentos, comparacao.intervalos.anterior],
  );
  const serie = useMemo(
    () => agruparSerieFinanceira(movimentos, periodo, comparacao.intervalos.atual),
    [movimentos, periodo, comparacao.intervalos.atual],
  );
  // Celular e tablet trocam o gráfico vertical pela lista (`ListaFluxo`). O Mês
  // vira semanas ali: 31 linhas de dia seriam uma lista sem fim.
  const compacto = useMediaQuery("(max-width: 1023px)");
  const serieLista = useMemo(
    () =>
      (periodo === "mes" ? agruparPorSemana(serie) : serie).map((ponto) => ({
        ...ponto,
        diario: periodo === "7-dias" || periodo === "hoje",
      })),
    [serie, periodo],
  );
  const servicosAtuais = useMemo(
    () => comporFaturamentoPorServico(movimentosAtuais),
    [movimentosAtuais],
  );
  const despesasAtuais = useMemo(
    () => agruparDespesasPorCategoria(movimentosAtuais),
    [movimentosAtuais],
  );
  const ajustesAtendimento = useMemo(
    () => somarAjustesDeAtendimento(movimentosAtuais),
    [movimentosAtuais],
  );
  const servicosVisiveis = useMemo(
    () => consolidarComposicao(servicosAtuais),
    [servicosAtuais],
  );

  const tiposTabela =
    filtroTabela === "todos"
      ? undefined
      : filtroTabela === "receita"
        ? (["receita"] as const)
        : filtroTabela === "entrada"
          ? (["entrada"] as const)
          : (["saida"] as const);
  const movimentosTabela = useMemo(
    () => filtrarMovimentosFinanceiros(movimentos, {
      intervalo: comparacao.intervalos.atual,
      busca,
      tipos: tiposTabela ? [...tiposTabela] : undefined,
    }),
    [movimentos, comparacao.intervalos.atual, busca, filtroTabela],
  );
  const exibidos = movimentosTabela.slice(0, limiteTabela);
  const resumo = comparacao.resumos.atual;

  const kpis = [
    {
      id: "faturamento" as const,
      label: "Faturamento",
      value: formatarMoeda(resumo.faturamento),
      sub: `Ticket médio ${formatarMoeda(resumo.ticketMedio)}`,
      Icone: Banknote,
    },
    {
      id: "saidas" as const,
      label: "Saídas",
      value: formatarMoeda(resumo.saidas),
      sub: `${despesasAtuais.length} ${despesasAtuais.length === 1 ? "categoria" : "categorias"} no período`,
      Icone: WalletCards,
    },
    {
      id: "resultado" as const,
      label: "Resultado operacional",
      value: formatarMoeda(resumo.resultado),
      sub: "Faturamento − saídas",
      Icone: Scale,
    },
    {
      id: "atendimentos" as const,
      label: "Atendimentos concluídos",
      value: formatarNumero(resumo.atendimentos),
      sub: `${servicosAtuais.length} serviços no período`,
      Icone: CalendarCheck2,
    },
  ];

  const detalhesKpi = useMemo<Record<IdKpi, DetalheKpi>>(() => {
    const movimentosDetalhe = movimentosAtuais.map(paraDetalhe);
    const variacao = (id: IdKpi) =>
      `${formatarVariacaoPercentual(comparacao.metricas[id].percentual)} em relação a ${comparacao.intervalos.anterior.rotulo}`;
    return {
      faturamento: {
        titulo: "Faturamento",
        definicao: "Atendimentos concluídos na agenda mais entradas manuais, cada um com seu rótulo. Não representa dinheiro recebido nem saldo em caixa.",
        valor: formatarMoeda(resumo.faturamento),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("faturamento"),
        composicao: [
          { nome: "Atendimentos", valor: formatarMoeda(resumo.faturamentoAtendimentos) },
          ...(ajustesAtendimento !== 0
            ? [{
                nome: "dos quais ajustes de atendimento",
                valor: `${ajustesAtendimento < 0 ? "− " : "+ "}${formatarMoeda(Math.abs(ajustesAtendimento))}`,
              }]
            : []),
          { nome: "Entradas manuais", valor: formatarMoeda(resumo.entradasManuais) },
        ],
        movimentos: movimentosDetalhe.filter((m) => m.tipo === "receita" || m.tipo === "entrada"),
      },
      saidas: {
        titulo: "Saídas",
        definicao: "Custos e investimentos cadastrados manualmente.",
        valor: formatarMoeda(resumo.saidas),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("saidas"),
        composicao: despesasAtuais.slice(0, 5).map((i) => ({ nome: i.nome, valor: formatarMoeda(i.valor) })),
        movimentos: movimentosDetalhe.filter((m) => m.tipo === "saida"),
      },
      resultado: {
        titulo: "Resultado operacional",
        definicao: "Faturamento (atendimentos e entradas manuais) menos saídas.",
        valor: formatarMoeda(resumo.resultado),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("resultado"),
        composicao: [
          { nome: "Faturamento", valor: formatarMoeda(resumo.faturamento) },
          { nome: "Saídas", valor: `− ${formatarMoeda(resumo.saidas)}` },
        ],
        movimentos: movimentosDetalhe,
      },
      atendimentos: {
        titulo: "Atendimentos concluídos",
        definicao: "Serviços finalizados pela equipe no período.",
        valor: formatarNumero(resumo.atendimentos),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("atendimentos"),
        composicao: servicosAtuais.slice(0, 5).map((i) => ({ nome: i.nome, valor: `${i.quantidade} atend.` })),
        movimentos: movimentosDetalhe.filter((m) => m.tipo === "receita"),
      },
    };
  }, [comparacao, despesasAtuais, movimentosAtuais, resumo, servicosAtuais, ajustesAtendimento]);

  const comparacaoJanela = useMemo(() => {
    const resultado = compararPeriodoFinanceiro(
      movimentos,
      periodoComparacao,
      referencia,
      Number(anoSelecionado),
    );
    const atuais = filtrarMovimentosFinanceiros(movimentos, { intervalo: resultado.intervalos.atual });
    const anteriores = filtrarMovimentosFinanceiros(movimentos, { intervalo: resultado.intervalos.anterior });
    const { atual, anterior } = resultado.resumos;
    const servicosA = comporFaturamentoPorServico(atuais);
    const servicosB = comporFaturamentoPorServico(anteriores);
    return {
      resultado,
      decomposicao: {
        faturamento: [
          { nome: "Atendimentos", atual: atual.faturamentoAtendimentos, anterior: anterior.faturamentoAtendimentos },
          { nome: "Entradas manuais", atual: atual.entradasManuais, anterior: anterior.entradasManuais },
        ],
        saidas: juntarComposicoes(agruparDespesasPorCategoria(atuais), agruparDespesasPorCategoria(anteriores)),
        resultado: [
          { nome: "Faturamento", atual: atual.faturamento, anterior: anterior.faturamento },
          { nome: "Saídas", atual: atual.saidas, anterior: anterior.saidas },
        ],
        atendimentos: juntarComposicoes(servicosA, servicosB, true),
      },
    };
  }, [movimentos, periodoComparacao, referencia, anoSelecionado]);

  const abrirComparacao = () => {
    setPeriodoComparacao(periodo === "7-dias" || periodo === "ano" ? periodo : "mes");
    setComparacaoAberta(true);
  };

  const salvarNovo = (rascunho: LancamentoRascunho) => {
    const movimento = criarMovimentoManual(rascunho, `manual:${Date.now()}`);
    setManuais((atuais) => ordenar([movimento, ...atuais]));
    setNovoAberto(false);
    toast.info("Lançamento adicionado ao resultado operacional.");
  };

  const salvarEdicao = (detalhe: MovimentoParaDetalhe) => {
    setManuais((atuais) => atuais.map((item) =>
      item.id === detalhe.id
        ? {
            ...item,
            tipo: detalhe.tipo,
            data: detalhe.data,
            descricao: detalhe.descricao,
            categoria: detalhe.categoria,
            valor: detalhe.valor,
            profissionalId: detalhe.profissionalId,
            profissional: detalhe.profissionalId === undefined ? undefined : detalhe.profissional,
          }
        : item,
    ));
    setMovimentoAtivo(detalhe);
    toast.info("Lançamento atualizado.");
  };

  const pedirExclusao = (detalhe: MovimentoParaDetalhe) => {
    setMovimentoAtivo(null);
    setExclusaoAtiva(detalhe);
  };

  const confirmarExclusao = (detalhe: MovimentoParaDetalhe) => {
    setManuais((atuais) => atuais.filter((item) => item.id !== detalhe.id));
    setExclusaoAtiva(null);
    toast.info("Lançamento excluído desta prévia.");
  };

  const abrirTabelaDaComparacao = (metrica: MetricaComparacao) => {
    // A tabela passa a mostrar o mesmo período que estava sendo comparado.
    setPeriodo(periodoComparacao);
    setFiltroTabela(metrica === "faturamento" || metrica === "atendimentos" ? "receita" : metrica === "saidas" ? "saida" : "todos");
    setComparacaoAberta(false);
    requestAnimationFrame(() => tabelaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="fin-root">
      <div className="fin-scroll">
        <header className="fin-pagehead">
          <div>
            {titulo ?? <h1 className="fin-pagehead__title">Financeiro</h1>}
          </div>
          <div className="fin-pagehead__actions">
            <button className="fin-btn fin-btn--primary" type="button" onClick={() => setNovoAberto(true)}>
              <Plus size={15} /> Novo lançamento
            </button>
            <button className="fin-btn" type="button" onClick={abrirComparacao}>
              <GitCompareArrows size={15} /> Comparar períodos
            </button>
          </div>
        </header>

        <section className="fin-resumo" aria-label="Resumo financeiro">
          <div className="fin-toolbar">
            <div className="fin-controles-periodo">
              <div className="fin-periodos" aria-label="Período">
                {PERIODOS.map(([id, rotulo]) => (
                  <button key={id} type="button" aria-pressed={periodo === id} onClick={() => { setPeriodo(id); setLimiteTabela(6); }}>
                    {rotulo}
                  </button>
                ))}
              </div>
              {periodo === "ano" && (
                <div className="fin-ano">
                  <label htmlFor="fin-ano-selecionado">Visualizar</label>
                  <SelectField
                    id="fin-ano-selecionado"
                    name="ano-financeiro"
                    value={anoSelecionado}
                    options={opcoesAno}
                    onValueChange={(ano) => {
                      setAnoSelecionado(ano);
                      setLimiteTabela(6);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="fin-kpis">
            {kpis.map(({ id, label, value, sub, Icone }) => {
              const metrica = comparacao.metricas[id];
              const positivo = id === "saidas" ? metrica.delta <= 0 : metrica.delta >= 0;
              const DeltaIcon = metrica.delta >= 0 ? ArrowUpRight : ArrowDownRight;
              return (
                <button key={id} type="button" className={`fin-kpi${id === "resultado" ? " fin-kpi--resultado" : ""}`} onClick={() => setKpiAtivo(id)}>
                  <span className="fin-kpi__top"><span>{label}</span><Icone size={16} /></span>
                  <strong className="fin-kpi__value">{value}</strong>
                  <span className="fin-kpi__bottom">
                    <span className={`fin-delta${metrica.delta === 0 ? " fin-delta--neutro" : positivo ? "" : " fin-delta--negativo"}`}>
                      <DeltaIcon size={11} /> {formatarVariacaoPercentual(metrica.percentual)}
                    </span>
                    <span>{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="fin-grid">
          {/* Em Hoje, no compacto, o painel sai: um ponto só não é gráfico, e os
              cards de cima já dizem o dia. */}
          {!(compacto && periodo === "hoje") && (
            <section className="fin-panel fin-panel--fluxo">
              <div className="fin-panel__head">
                <div><h2>Faturamento e saídas</h2><p>{comparacao.intervalos.atual.rotulo}</p></div>
                <div className="fin-legenda-fluxo"><span><i /> Faturamento</span><span><i /> Saídas</span></div>
              </div>
              {compacto ? <ListaFluxo dados={serieLista} /> : <GraficoFluxo dados={serie} />}
            </section>
          )}

          <section className="fin-panel fin-panel--servicos">
            <div className="fin-panel__head">
              <div><h2>Serviços que mais faturaram</h2></div>
            </div>
            <ComposicaoServicos dados={servicosVisiveis} />
          </section>

          <section className="fin-panel fin-panel--despesas">
            <div className="fin-panel__head">
              <div><h2>Saídas por categoria</h2></div>
              <span className="fin-panel__total">{formatarMoeda(resumo.saidas)}</span>
            </div>
            <DespesasPorCategoria dados={despesasAtuais.slice(0, 6)} />
          </section>

          <section ref={tabelaRef} className="fin-panel fin-panel--movimentos">
            <div className="fin-panel__head">
              <div><h2>Movimentações</h2>{busca && <p>Resultados para “{busca}”</p>}</div>
              <div className="fin-segmentado" aria-label="Filtrar movimentações">
                {([['todos', 'Todos'], ['receita', 'Atendimentos'], ['entrada', 'Entradas'], ['saida', 'Saídas']] as Array<[FiltroTabela, string]>).map(([id, rotulo]) => (
                  <button key={id} type="button" aria-pressed={filtroTabela === id} onClick={() => { setFiltroTabela(id); setLimiteTabela(6); }}>{rotulo}</button>
                ))}
              </div>
            </div>
            {exibidos.length ? (
              <>
                <div className="fin-tabela-wrap">
                  <table className="fin-tabela">
                    <thead><tr><th>Movimentação</th><th>Data</th><th>Categoria</th><th>Origem</th><th>Valor</th></tr></thead>
                    <tbody>
                      {exibidos.map((movimento) => (
                        <tr key={movimento.id}>
                          <td>
                            <button className="fin-movimento__principal fin-movimento__botao" type="button" onClick={() => setMovimentoAtivo(paraDetalhe(movimento))}>
                              <span aria-hidden="true" className={`fin-movimento__icone${movimento.tipo === "saida" ? " fin-movimento__icone--saida" : ""}`}>
                                {movimento.tipo === "saida" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                              </span>
                              <span className="fin-movimento__texto"><strong>{movimento.descricao}</strong><span>{movimento.atendimento?.profissional ?? (movimento.tipo === "entrada" ? "Entrada manual" : movimento.profissional ? `Saída · ${movimento.profissional}` : "Saída cadastrada")}</span></span>
                            </button>
                          </td>
                          <td>{formatarDataFinanceira(movimento.data)}</td>
                          <td>{movimento.atendimento?.servico ?? movimento.categoria}</td>
                          <td><span className={`fin-origem${movimento.origem === "manual" ? " fin-origem--manual" : ""}`}>{movimento.origem === "automatico" ? "Agenda" : "Manual"}</span></td>
                          <td className={movimento.tipo === "saida" ? "fin-valor--saida" : "fin-valor--entrada"}>{movimento.tipo === "saida" ? "−" : "+"} {formatarMoeda(Math.abs(movimento.valor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="fin-tabela__rodape">
                  <span>Exibindo {exibidos.length} de {movimentosTabela.length}</span>
                  {movimentosTabela.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setLimiteTabela((atual) =>
                        atual >= movimentosTabela.length ? 6 : Math.min(atual + 20, movimentosTabela.length)
                      )}
                    >
                      {limiteTabela >= movimentosTabela.length ? "Mostrar menos" : "Mostrar mais"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="fin-tabela-vazia">Nenhuma movimentação encontrada neste período.</div>
            )}
          </section>
        </div>
      </div>

      <NovoLancamentoModal aberto={novoAberto} onFechar={() => setNovoAberto(false)} onSalvar={salvarNovo} profissionais={barbeiros} categorias={categorias} onCriarCategoria={criarCategoria} />
      <CompararPeriodosModal
        aberto={comparacaoAberta}
        onFechar={() => setComparacaoAberta(false)}
        periodo={periodoComparacao}
        onPeriodoChange={setPeriodoComparacao}
        atual={comparacaoJanela.resultado.resumos.atual}
        anterior={comparacaoJanela.resultado.resumos.anterior}
        rotuloAtual={comparacaoJanela.resultado.intervalos.atual.rotulo}
        rotuloAnterior={comparacaoJanela.resultado.intervalos.anterior.rotulo}
        decomposicao={comparacaoJanela.decomposicao}
        onVerMovimentacoes={abrirTabelaDaComparacao}
      />
      <DetalheKpiDrawer
        aberto={Boolean(kpiAtivo)}
        detalhe={kpiAtivo ? detalhesKpi[kpiAtivo] : null}
        onFechar={() => setKpiAtivo(null)}
        onAbrirMovimento={(movimento) => {
          setKpiAtivo(null);
          window.setTimeout(() => setMovimentoAtivo(movimento), 260);
        }}
      />
      <DetalheMovimentoDrawer movimento={movimentoAtivo} onFechar={() => setMovimentoAtivo(null)} onSalvar={salvarEdicao} onPedirExclusao={pedirExclusao} profissionais={barbeiros} categorias={categorias} onCriarCategoria={criarCategoria} />
      <ConfirmarExclusaoModal movimento={exclusaoAtiva} onFechar={() => setExclusaoAtiva(null)} onConfirmar={confirmarExclusao} />
    </div>
  );
}
