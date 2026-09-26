/**
 * Financeiro V1 — uma leitura operacional de faturou / saiu / sobrou.
 * Herda a moldura e os tokens do painel; do Studio Admin entram apenas a
 * sequência, a geometria conectada dos KPIs e os padrões de drill-down.
 * Não há recebido, caixa, comissão, assinatura ou forma de pagamento aqui.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck2,
  GitCompareArrows,
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
  agruparSerieFinanceira,
  compararPeriodoFinanceiro,
  comporFaturamentoPorServico,
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
} from "./GraficosFinanceiros";
import {
  CompararPeriodosModal,
  ConfirmarExclusaoModal,
  DetalheKpiDrawer,
  DetalheMovimentoDrawer,
  NovoLancamentoModal,
  type DetalheKpi,
  type LancamentoRascunho,
  type MetricaComparacao,
  type MovimentoParaDetalhe,
} from "./SobreposicoesFinanceiras";
import "./financeiro.css";

interface Props {
  eventos: Event[];
  profissionais: Professional[];
  busca: string;
  solicitacaoNovoLancamento: number;
  chaveSessao: string;
}

type IdKpi = "faturamento" | "saidas" | "resultado" | "atendimentos";
type FiltroTabela = "todos" | "receita" | "saida";

const PERIODOS = Object.entries(ROTULOS_PERIODOS_FINANCEIROS) as Array<
  [PeriodoFinanceiro, string]
>;

const MODO_DEMONSTRACAO = (import.meta.env.VITE_MOCK ?? "").trim() === "1";

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
    profissional: movimento.atendimento?.profissional,
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
let ultimaSolicitacaoFinanceiraAtendida = 0;

export default function FinanceiroScreen({
  eventos,
  profissionais,
  busca,
  solicitacaoNovoLancamento,
  chaveSessao,
}: Props) {
  const referencia = useMemo(() => new Date(), []);
  const [servicos, setServicos] = useState<ConfiguredService[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoFinanceiro>("mes");
  const [anoSelecionado, setAnoSelecionado] = useState(() =>
    String(referencia.getFullYear()),
  );
  const [manuais, setManuais] = useState<MovimentoFinanceiro[]>(() =>
    movimentosManuaisPorSessao.get(chaveSessao) ?? criarDespesasDemonstrativas(referencia),
  );
  const [novoAberto, setNovoAberto] = useState(false);
  const [comparacaoAberta, setComparacaoAberta] = useState(false);
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
  const servicosAtuais = useMemo(
    () => comporFaturamentoPorServico(movimentosAtuais),
    [movimentosAtuais],
  );
  const despesasAtuais = useMemo(
    () => agruparDespesasPorCategoria(movimentosAtuais),
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
        : (["saida", "ajuste"] as const);
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
      sub: "Faturamento − saídas + ajustes",
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
        definicao: "Soma dos preços dos atendimentos concluídos. Não representa dinheiro recebido nem saldo em caixa.",
        valor: formatarMoeda(resumo.faturamento),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("faturamento"),
        composicao: servicosAtuais.slice(0, 5).map((i) => ({ nome: i.nome, valor: formatarMoeda(i.valor) })),
        movimentos: movimentosDetalhe.filter((m) => m.tipo === "receita"),
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
        definicao: "Faturamento menos saídas, considerando ajustes.",
        valor: formatarMoeda(resumo.resultado),
        contexto: comparacao.intervalos.atual.rotulo,
        variacao: variacao("resultado"),
        composicao: [
          { nome: "Faturamento", valor: formatarMoeda(resumo.faturamento) },
          { nome: "Saídas", valor: `− ${formatarMoeda(resumo.saidas)}` },
          { nome: "Ajustes", valor: formatarMoeda(resumo.ajustes) },
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
  }, [comparacao, despesasAtuais, movimentosAtuais, resumo, servicosAtuais]);

  const servicosAnteriores = comporFaturamentoPorServico(movimentosAnteriores);
  const despesasAnteriores = agruparDespesasPorCategoria(movimentosAnteriores);
  const decomposicaoComparacao = {
    faturamento: juntarComposicoes(servicosAtuais, servicosAnteriores),
    saidas: juntarComposicoes(despesasAtuais, despesasAnteriores),
    resultado: [
      { nome: "Faturamento", atual: resumo.faturamento, anterior: comparacao.resumos.anterior.faturamento },
      { nome: "Saídas", atual: resumo.saidas, anterior: comparacao.resumos.anterior.saidas },
      { nome: "Ajustes", atual: resumo.ajustes, anterior: comparacao.resumos.anterior.ajustes },
    ],
    atendimentos: juntarComposicoes(servicosAtuais, servicosAnteriores, true),
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
        ? { ...item, tipo: detalhe.tipo, data: detalhe.data, descricao: detalhe.descricao, categoria: detalhe.categoria, valor: detalhe.valor }
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
    setFiltroTabela(metrica === "faturamento" || metrica === "atendimentos" ? "receita" : metrica === "saidas" ? "saida" : "todos");
    setComparacaoAberta(false);
    requestAnimationFrame(() => tabelaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="fin-root">
      <div className="fin-scroll">
        <header className="fin-pagehead">
          <div>
            <h1 className="fin-pagehead__title">Financeiro</h1>
            <p className="fin-pagehead__sub">Visão operacional · atendimentos concluídos e saídas demonstrativas</p>
          </div>
          <div className="fin-pagehead__actions">
            <button className="fin-btn" type="button" onClick={() => setComparacaoAberta(true)}>
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
            <span className="fin-definicao">Faturamento = atendimentos concluídos, não dinheiro recebido · Resultado = faturamento − saídas + ajustes</span>
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
          <section className="fin-panel fin-panel--fluxo">
            <div className="fin-panel__head">
              <div><h2>Faturamento e saídas</h2><p>{comparacao.intervalos.atual.rotulo}</p></div>
              <div className="fin-legenda-fluxo"><span><i /> Faturamento</span><span><i /> Saídas</span></div>
            </div>
            <GraficoFluxo dados={serie} />
          </section>

          <section className="fin-panel fin-panel--servicos">
            <div className="fin-panel__head">
              <div><h2>Serviços que mais faturaram</h2><p>Participação e quantidade concluída</p></div>
            </div>
            <ComposicaoServicos dados={servicosVisiveis} />
          </section>

          <section className="fin-panel fin-panel--despesas">
            <div className="fin-panel__head">
              <div><h2>Saídas por categoria</h2><p>Onde o dinheiro foi aplicado</p></div>
              <span className="fin-panel__total">{formatarMoeda(resumo.saidas)}</span>
            </div>
            <DespesasPorCategoria dados={despesasAtuais.slice(0, 6)} />
          </section>

          <section ref={tabelaRef} className="fin-panel fin-panel--movimentos">
            <div className="fin-panel__head">
              <div><h2>Movimentações</h2><p>{busca ? `Resultados para “${busca}”` : "Automáticas e manuais no mesmo histórico"}</p></div>
              <div className="fin-segmentado" aria-label="Filtrar movimentações">
                {([['todos', 'Todos'], ['receita', 'Faturamento'], ['saida', 'Saídas']] as Array<[FiltroTabela, string]>).map(([id, rotulo]) => (
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
                              <span aria-hidden="true" className={`fin-movimento__icone${movimento.tipo === "saida" || (movimento.tipo === "ajuste" && movimento.valor < 0) ? " fin-movimento__icone--saida" : ""}`}>
                                {movimento.tipo === "saida" || (movimento.tipo === "ajuste" && movimento.valor < 0) ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                              </span>
                              <span className="fin-movimento__texto"><strong>{movimento.descricao}</strong><span>{movimento.atendimento?.profissional ?? (movimento.tipo === "ajuste" ? "Ajuste manual" : "Saída cadastrada")}</span></span>
                            </button>
                          </td>
                          <td>{formatarDataFinanceira(movimento.data)}</td>
                          <td>{movimento.atendimento?.servico ?? movimento.categoria}</td>
                          <td><span className={`fin-origem${movimento.origem === "manual" ? " fin-origem--manual" : ""}`}>{movimento.origem === "automatico" ? "Agenda" : "Manual"}</span></td>
                          <td className={movimento.tipo === "saida" || (movimento.tipo === "ajuste" && movimento.valor < 0) ? "fin-valor--saida" : "fin-valor--entrada"}>{movimento.tipo === "saida" || (movimento.tipo === "ajuste" && movimento.valor < 0) ? "−" : "+"} {formatarMoeda(Math.abs(movimento.valor))}</td>
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

      <NovoLancamentoModal aberto={novoAberto} onFechar={() => setNovoAberto(false)} onSalvar={salvarNovo} />
      <CompararPeriodosModal
        aberto={comparacaoAberta}
        onFechar={() => setComparacaoAberta(false)}
        atual={comparacao.resumos.atual}
        anterior={comparacao.resumos.anterior}
        rotuloAtual={comparacao.intervalos.atual.rotulo}
        rotuloAnterior={comparacao.intervalos.anterior.rotulo}
        decomposicao={decomposicaoComparacao}
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
      <DetalheMovimentoDrawer movimento={movimentoAtivo} onFechar={() => setMovimentoAtivo(null)} onSalvar={salvarEdicao} onPedirExclusao={pedirExclusao} />
      <ConfirmarExclusaoModal movimento={exclusaoAtiva} onFechar={() => setExclusaoAtiva(null)} onConfirmar={confirmarExclusao} />
    </div>
  );
}
