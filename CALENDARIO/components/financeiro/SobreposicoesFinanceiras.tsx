import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  PencilLine,
  Trash2,
  X,
} from "lucide-react";
import { CurrencyField } from "../ui/CurrencyField";
import { DateField } from "../ui/DateField";
import { SelectField } from "../ui/SelectField";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const EASE_PAINEL = [0.16, 1, 0.3, 1] as const;

/**
 * Celular e tablet (< 1024px, 2026-09-26, com o dono): toda janela do
 * Financeiro vira folha que sobe do rodapé. Antes os drawers entravam de lado
 * e os modais "cresciam" no meio da tela -- três entradas diferentes para o
 * mesmo tipo de coisa. No desktop cada um mantém a entrada que tinha.
 */
function useFolha() {
  return useMediaQuery("(max-width: 1023px)");
}

function animacaoDoPainel(
  reduzir: boolean | null,
  folha: boolean,
  entradaDesktop: Record<string, number | string>,
  saidaDesktop: Record<string, number | string>,
  duracaoDesktop: number,
) {
  const repouso = { opacity: 1, scale: 1, x: 0, y: 0 };
  if (reduzir) {
    return { initial: false as const, animate: repouso, exit: { opacity: 0 }, transition: { duration: 0 } };
  }
  if (folha) {
    return {
      initial: { y: "100%" },
      animate: repouso,
      exit: { y: "100%" },
      transition: { duration: 0.28, ease: EASE_PAINEL },
    };
  }
  return {
    initial: entradaDesktop,
    animate: repouso,
    exit: saidaDesktop,
    transition: { duration: duracaoDesktop, ease: EASE_PAINEL },
  };
}

export type TipoLancamentoManual = "entrada" | "saida";

export interface LancamentoRascunho {
  tipo: TipoLancamentoManual;
  categoria: string;
  valor: number;
  data: string;
  descricao: string;
  profissionalId?: number;
  profissional?: string;
}

export interface BarbeiroDoLancamento {
  id: number;
  nome: string;
}

export interface MovimentoParaDetalhe {
  id: string;
  tipo: "receita" | "entrada" | "saida";
  origem: "automatico" | "manual";
  data: string;
  hora?: string;
  descricao: string;
  categoria: string;
  valor: number;
  cliente?: string;
  profissional?: string;
  profissionalId?: number;
  servico?: string;
  atendimentoId?: number;
}

export interface ResumoComparavel {
  faturamento: number;
  saidas: number;
  resultado: number;
  atendimentos: number;
}

export type MetricaComparacao = keyof ResumoComparavel;

/** Janelas que a comparação oferece (2026-09-27, com o dono). */
export type PeriodoComparacao = "7-dias" | "mes" | "ano";

const PERIODOS_COMPARACAO: Array<[PeriodoComparacao, string]> = [
  ["7-dias", "Semana"],
  ["mes", "Mês"],
  ["ano", "Ano"],
];

export interface DetalheKpi {
  titulo: string;
  definicao: string;
  valor: string;
  contexto: string;
  variacao: string;
  composicao: Array<{ nome: string; valor: string }>;
  movimentos: MovimentoParaDetalhe[];
}

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataLonga = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export type TipoComCategoria = "entrada" | "saida";
export type CategoriasPorTipo = Record<TipoComCategoria, string[]>;

/**
 * Entrada e saída nascem só com o mínimo (2026-09-27, com o dono). O resto o
 * barbeiro cria no próprio campo, pelo "+ Nova categoria".
 */
export const CATEGORIAS_PADRAO: CategoriasPorTipo = {
  entrada: ["Venda de produtos", "Outras entradas"],
  saida: ["Comissão de barbeiro", "Produtos e materiais", "Contas mensais", "Marketing", "Outras saídas"],
};

/** Única categoria que pede o barbeiro: o repasse precisa dizer para quem foi. */
export const CATEGORIA_COMISSAO = "Comissão de barbeiro";

function opcoesDeBarbeiro(profissionais: BarbeiroDoLancamento[]) {
  return profissionais.map((profissional) => ({ value: String(profissional.id), label: profissional.nome }));
}

const NOVA_CATEGORIA = "__nova-categoria__";

/** Lançamentos antigos podem usar uma categoria que saiu da lista; ela continua visível. */
function opcoesDeCategoria(opcoes: string[], atual: string) {
  return atual && !opcoes.includes(atual) ? [...opcoes, atual] : opcoes;
}

function CampoCategoria({
  id,
  value,
  opcoes,
  onChange,
  onCriar,
  erro,
  dataAutofocus,
}: {
  id: string;
  value: string;
  opcoes: string[];
  onChange: (categoria: string) => void;
  /** Sem esta função o campo não oferece "Nova categoria". */
  onCriar?: (nome: string) => void;
  erro?: string;
  dataAutofocus?: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState("");
  const idErro = `${id}-erro`;

  const cancelar = () => {
    setCriando(false);
    setNome("");
    setErroNome("");
  };

  const confirmar = () => {
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (!limpo) {
      setErroNome("Dê um nome para a categoria.");
      return;
    }
    const existente = opcoes.find(
      (opcao) => opcao.toLocaleLowerCase("pt-BR") === limpo.toLocaleLowerCase("pt-BR"),
    );
    if (!existente) onCriar?.(limpo);
    onChange(existente ?? limpo);
    cancelar();
  };

  // Enter não envia o lançamento e Esc não fecha a janela: os dois ficam com a categoria.
  const aoTeclar = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmar();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelar();
    }
  };

  const mensagem = criando ? erroNome : erro;

  return (
    <>
      {criando ? (
        <div className="fin-categoria-nova">
          <input
            id={id}
            name="nova-categoria"
            autoFocus
            maxLength={40}
            placeholder="Nome da categoria"
            value={nome}
            aria-invalid={Boolean(erroNome) || undefined}
            aria-describedby={erroNome ? idErro : undefined}
            onChange={(event) => { setNome(event.target.value); setErroNome(""); }}
            onKeyDown={aoTeclar}
          />
          <button className="fin-btn fin-btn--primary" type="button" onClick={confirmar}>Adicionar</button>
          <button className="fin-btn fin-btn--ghost" type="button" onClick={cancelar} aria-label="Cancelar nova categoria">
            <X size={15} />
          </button>
        </div>
      ) : (
        <SelectField
          id={id}
          name="categoria"
          dataAutofocus={dataAutofocus}
          value={value}
          options={[
            ...opcoes.map((opcao) => ({ value: opcao, label: opcao })),
            ...(onCriar ? [{ value: NOVA_CATEGORIA, label: "+ Nova categoria" }] : []),
          ]}
          ariaInvalid={Boolean(erro)}
          ariaDescribedBy={erro ? idErro : undefined}
          onValueChange={(proxima) => (proxima === NOVA_CATEGORIA ? setCriando(true) : onChange(proxima))}
        />
      )}
      {mensagem && <span id={idErro} className="fin-campo__erro">{mensagem}</span>}
    </>
  );
}

function hojeIso() {
  return new Date().toLocaleDateString("en-CA");
}

function formatarDataLongaSegura(dataIso: string) {
  const data = new Date(`${dataIso}T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? "Data não informada" : dataLonga.format(data);
}

function useFocoProtegido(
  aberto: boolean,
  referencia: RefObject<HTMLElement | null>,
  onFechar: () => void,
) {
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    if (!aberto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const primeiro = referencia.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        referencia.current?.querySelector<HTMLElement>(
          "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
      primeiro?.focus();
    });

    const aoPressionar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onFecharRef.current();
        return;
      }
      if (event.key !== "Tab" || !referencia.current) return;
      const focaveis = Array.from(
        referencia.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((item) => item.offsetParent !== null);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoPressionar);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", aoPressionar);
      focoAnterior?.focus();
    };
  }, [aberto, referencia]);
}

function Portal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}

export function NovoLancamentoModal({
  aberto,
  onFechar,
  onSalvar,
  profissionais,
  categorias,
  onCriarCategoria,
}: {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (lancamento: LancamentoRascunho) => void;
  profissionais: BarbeiroDoLancamento[];
  categorias: CategoriasPorTipo;
  onCriarCategoria: (tipo: TipoComCategoria, nome: string) => void;
}) {
  const reduzir = useReducedMotion();
  const folha = useFolha();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [tipo, setTipo] = useState<TipoLancamentoManual>("saida");
  const [categoria, setCategoria] = useState("");
  const [centavos, setCentavos] = useState<number | null>(null);
  const [data, setData] = useState(hojeIso);
  const [descricao, setDescricao] = useState("");
  const [profissionalId, setProfissionalId] = useState<number | undefined>();
  const [erros, setErros] = useState<Record<string, string>>({});

  useFocoProtegido(aberto, dialogRef, onFechar);

  useEffect(() => {
    if (!aberto) return;
    setTipo("saida");
    setCategoria("");
    setCentavos(null);
    setData(hojeIso());
    setDescricao("");
    setProfissionalId(undefined);
    setErros({});
  }, [aberto]);

  const salvar = (event: FormEvent) => {
    event.preventDefault();
    const numero = (centavos ?? 0) / 100;
    const proximosErros: Record<string, string> = {};
    if (!categoria) proximosErros.categoria = "Escolha uma categoria.";
    if (numero <= 0) proximosErros.valor = "Informe um valor maior que zero.";
    if (!data) proximosErros.data = "Informe a data do lançamento.";
    else if (data > hojeIso()) proximosErros.data = "Use uma data de hoje ou anterior.";
    const eComissao = categoria === CATEGORIA_COMISSAO;
    if (eComissao && profissionalId === undefined) proximosErros.profissional = "Escolha o barbeiro.";
    setErros(proximosErros);
    if (Object.keys(proximosErros).length) return;
    onSalvar({
      tipo,
      categoria,
      valor: numero,
      data,
      // Descrição é opcional; sem ela a categoria vira o texto da linha.
      descricao: descricao.trim() || categoria,
      ...(eComissao && {
        profissionalId,
        profissional: profissionais.find((item) => item.id === profissionalId)?.nome,
      }),
    });
  };

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className={`fin-root fin-overlay${folha ? " fin-overlay--folha" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className={`fin-dialog fin-dialog--lancamento${folha ? " fin-dialog--folha" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              {...animacaoDoPainel(reduzir, folha, { opacity: 0, scale: 0.985, y: 10 }, { opacity: 0, scale: 0.985, y: 8 }, 0.22)}
            >
              <div className="fin-dialog__head">
                <div>
                  <h2 id={tituloId}>Novo lançamento</h2>
                  <p>Registre movimentos que não vêm da agenda. Nesta prévia, eles não permanecem após recarregar.</p>
                </div>
                <button className="fin-fechar" type="button" onClick={onFechar} aria-label="Fechar novo lançamento">
                  <X size={17} />
                </button>
              </div>
              <form onSubmit={salvar} noValidate>
                <div className="fin-dialog__body fin-form">
                  <div className="fin-campo">
                    <span className="fin-campo__label">Tipo de lançamento</span>
                    <RadioGroupPrimitive.Root
                      className="fin-tipo-lancamento"
                      name="tipo"
                      value={tipo}
                      onValueChange={(value) => { setTipo(value as TipoLancamentoManual); setCategoria(""); }}
                      aria-label="Tipo de lançamento"
                    >
                      <RadioGroupPrimitive.Item value="entrada">
                        <ArrowUpRight aria-hidden="true" size={16} />
                        <span>Entrada</span>
                        <RadioGroupPrimitive.Indicator className="fin-tipo-lancamento__indicador" />
                      </RadioGroupPrimitive.Item>
                      <RadioGroupPrimitive.Item value="saida">
                        <CircleDollarSign aria-hidden="true" size={16} />
                        <span>Saída</span>
                        <RadioGroupPrimitive.Indicator className="fin-tipo-lancamento__indicador" />
                      </RadioGroupPrimitive.Item>
                    </RadioGroupPrimitive.Root>
                    <span className="fin-ajuda">
                      {tipo === "entrada"
                        ? "Soma ao resultado; o faturamento continua vindo dos atendimentos."
                        : "Custos da barbearia reduzem o resultado."}
                    </span>
                  </div>

                  <div className="fin-form__grid">
                    <div className="fin-campo">
                      <label htmlFor="fin-categoria">Categoria</label>
                      <CampoCategoria
                        key={tipo}
                        id="fin-categoria"
                        dataAutofocus
                        value={categoria}
                        opcoes={categorias[tipo]}
                        onCriar={(nome) => onCriarCategoria(tipo, nome)}
                        erro={erros.categoria}
                        onChange={setCategoria}
                      />
                    </div>
                    <div className="fin-campo">
                      <label htmlFor="fin-valor">Valor</label>
                      <CurrencyField
                        id="fin-valor"
                        name="valor"
                        centavos={centavos}
                        ariaInvalid={Boolean(erros.valor)}
                        ariaDescribedBy={erros.valor ? "fin-valor-erro" : undefined}
                        onChange={setCentavos}
                      />
                      {erros.valor && <span id="fin-valor-erro" className="fin-campo__erro">{erros.valor}</span>}
                    </div>
                    <div className="fin-campo">
                      <label htmlFor="fin-data">Data</label>
                      <DateField
                        id="fin-data"
                        name="data"
                        max={hojeIso()}
                        value={data}
                        ariaInvalid={Boolean(erros.data)}
                        ariaDescribedBy={erros.data ? "fin-data-erro" : undefined}
                        onChange={setData}
                      />
                      {erros.data && <span id="fin-data-erro" className="fin-campo__erro">{erros.data}</span>}
                    </div>
                    {categoria === CATEGORIA_COMISSAO && (
                      <div className="fin-campo">
                        <label htmlFor="fin-barbeiro">Barbeiro</label>
                        <SelectField
                          id="fin-barbeiro"
                          name="barbeiro"
                          value={profissionalId === undefined ? "" : String(profissionalId)}
                          options={opcoesDeBarbeiro(profissionais)}
                          ariaInvalid={Boolean(erros.profissional)}
                          ariaDescribedBy={erros.profissional ? "fin-barbeiro-erro" : undefined}
                          onValueChange={(valor) => setProfissionalId(Number(valor))}
                        />
                        {erros.profissional && <span id="fin-barbeiro-erro" className="fin-campo__erro">{erros.profissional}</span>}
                      </div>
                    )}
                    <div className="fin-campo fin-campo--inteiro">
                      <label htmlFor="fin-descricao">Descrição <span className="fin-campo__opcional">(opcional)</span></label>
                      <textarea
                        id="fin-descricao"
                        name="descricao"
                        placeholder="Ex.: compra de lâminas e toalhas"
                        value={descricao}
                        aria-invalid={Boolean(erros.descricao)}
                        aria-describedby={erros.descricao ? "fin-descricao-erro" : undefined}
                        onChange={(event) => setDescricao(event.target.value)}
                      />
                      {erros.descricao && <span id="fin-descricao-erro" className="fin-campo__erro">{erros.descricao}</span>}
                    </div>
                  </div>
                </div>
                <div className="fin-dialog__actions">
                  <button className="fin-btn" type="button" onClick={onFechar}>Cancelar</button>
                  <button className="fin-btn fin-btn--primary" type="submit">Salvar lançamento</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

const METRICAS: Array<{ value: MetricaComparacao; label: string }> = [
  { value: "faturamento", label: "Faturamento" },
  { value: "saidas", label: "Saídas" },
  { value: "resultado", label: "Resultado operacional" },
  { value: "atendimentos", label: "Atendimentos concluídos" },
];

export function CompararPeriodosModal({
  aberto,
  onFechar,
  atual,
  anterior,
  rotuloAtual,
  rotuloAnterior,
  decomposicao,
  onVerMovimentacoes,
  periodo,
  onPeriodoChange,
}: {
  aberto: boolean;
  onFechar: () => void;
  periodo: PeriodoComparacao;
  onPeriodoChange: (periodo: PeriodoComparacao) => void;
  atual: ResumoComparavel;
  anterior: ResumoComparavel;
  rotuloAtual: string;
  rotuloAnterior: string;
  decomposicao: Record<
    MetricaComparacao,
    Array<{ nome: string; atual: number; anterior: number }>
  >;
  onVerMovimentacoes: (metrica: MetricaComparacao) => void;
}) {
  const reduzir = useReducedMotion();
  const folha = useFolha();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [metrica, setMetrica] = useState<MetricaComparacao>("faturamento");
  useFocoProtegido(aberto, dialogRef, onFechar);

  const valorAtual = atual[metrica];
  const valorAnterior = anterior[metrica];
  const diferenca = valorAtual - valorAnterior;
  const percentual = valorAnterior === 0
    ? valorAtual === 0 ? 0 : null
    : (diferenca / Math.abs(valorAnterior)) * 100;
  const maior = Math.max(1, Math.abs(valorAtual), Math.abs(valorAnterior));
  const eQuantidade = metrica === "atendimentos";
  const formatar = (valor: number) => eQuantidade ? `${Math.round(valor)}` : moeda.format(valor);
  // Na folha (celular e tablet) os dois valores ficam lado a lado e as barras
  // saem -- elas só repetiam os números.

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className={`fin-root fin-overlay${folha ? " fin-overlay--folha" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className={`fin-dialog fin-dialog--largo${folha ? " fin-dialog--folha" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              {...animacaoDoPainel(reduzir, folha, { opacity: 0, scale: 0.985, y: 10 }, { opacity: 0, scale: 0.985, y: 8 }, 0.22)}
            >
              <div className="fin-dialog__head">
                <div>
                  <h2 id={tituloId}>Comparar períodos</h2>
                </div>
                <button className="fin-fechar" type="button" onClick={onFechar} aria-label="Fechar comparação">
                  <X size={17} />
                </button>
              </div>
              <div className="fin-dialog__body">
                <div className="fin-campo" style={{ marginBottom: 14 }}>
                  <span className="fin-campo__label" id="fin-periodo-comparacao">Comparar</span>
                  <div className="fin-segmentado fin-segmentado--cheio" role="group" aria-labelledby="fin-periodo-comparacao">
                    {PERIODOS_COMPARACAO.map(([id, rotulo]) => (
                      <button key={id} type="button" aria-pressed={periodo === id} onClick={() => onPeriodoChange(id)}>
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fin-campo" style={{ marginBottom: 18 }}>
                  <label htmlFor="fin-metrica-comparacao">Métrica</label>
                  <SelectField<MetricaComparacao>
                    id="fin-metrica-comparacao"
                    name="metrica"
                    dataAutofocus
                    value={metrica}
                    options={METRICAS}
                    onValueChange={setMetrica}
                  />
                </div>
                <div className="fin-comparacao-grid">
                  <div className="fin-comparacao-card">
                    <span>{rotuloAnterior}</span>
                    <strong>{formatar(valorAnterior)}</strong>
                    <small>Período de referência</small>
                  </div>
                  {!folha && <div className="fin-comparacao-seta"><ArrowRight size={18} /></div>}
                  <div className="fin-comparacao-card">
                    <span>{rotuloAtual}</span>
                    <strong>{formatar(valorAtual)}</strong>
                    <small>{`${diferenca > 0 ? "+" : diferenca < 0 ? "−" : ""}${formatar(Math.abs(diferenca))} · ${percentual === null ? "sem base anterior" : `${percentual > 0 ? "+" : ""}${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}`}</small>
                  </div>
                </div>

                {!folha && <div className="fin-comparacao-grafico" aria-label="Comparação visual dos dois períodos">
                  <div className="fin-comparacao-barras">
                    <span className="fin-comparacao-barra" style={{ height: `${Math.max(3, Math.abs(valorAnterior) / maior * 100)}%` }} />
                    <span className="fin-comparacao-barra fin-comparacao-barra--atual" style={{ height: `${Math.max(3, Math.abs(valorAtual) / maior * 100)}%` }} />
                  </div>
                  <div className="fin-comparacao-legendas"><span>Anterior</span><span>Atual</span></div>
                </div>}

                <div className="fin-detalhe-bloco">
                  <h3>O que compõe esta comparação</h3>
                  <ul className="fin-detalhe-lista">
                    {decomposicao[metrica].slice(0, 5).map((item) => (
                      <li key={item.nome}>
                        <span>{item.nome}</span>
                        <strong>{`${formatar(item.anterior)} → ${formatar(item.atual)}`}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="fin-dialog__actions">
                <button className="fin-btn" type="button" onClick={onFechar}>Fechar</button>
                <button className="fin-btn fin-btn--primary" type="button" onClick={() => onVerMovimentacoes(metrica)}>
                  Ver movimentações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function DetalheKpiDrawer({
  aberto,
  detalhe,
  onFechar,
  onAbrirMovimento,
}: {
  aberto: boolean;
  detalhe: DetalheKpi | null;
  onFechar: () => void;
  onAbrirMovimento: (movimento: MovimentoParaDetalhe) => void;
}) {
  const reduzir = useReducedMotion();
  const folha = useFolha();
  const drawerRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useFocoProtegido(aberto, drawerRef, onFechar);

  return (
    <Portal>
      <AnimatePresence>
        {aberto && detalhe && (
          <motion.div
            className={`fin-root fin-overlay fin-drawer-wrap${folha ? " fin-overlay--folha" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.aside
              ref={drawerRef}
              className={`fin-drawer${folha ? " fin-drawer--folha" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              {...animacaoDoPainel(reduzir, folha, { x: 36, opacity: 0 }, { x: 30, opacity: 0 }, 0.24)}
            >
              <div className="fin-drawer__head">
                <div><h2 id={tituloId}>{detalhe.titulo}</h2><p>{detalhe.definicao}</p></div>
                <button className="fin-fechar" data-autofocus type="button" onClick={onFechar} aria-label={`Fechar ${detalhe.titulo}`}><X size={17} /></button>
              </div>
              <div className="fin-drawer__body">
                <div className="fin-detalhe-valor">
                  <span>{detalhe.contexto}</span>
                  <strong>{detalhe.valor}</strong>
                  <span>{detalhe.variacao}</span>
                </div>
                <div className="fin-detalhe-bloco">
                  <h3>Composição</h3>
                  <ul className="fin-detalhe-lista">
                    {detalhe.composicao.map((item) => <li key={item.nome}><span>{item.nome}</span><strong>{item.valor}</strong></li>)}
                  </ul>
                </div>
                <div className="fin-detalhe-bloco">
                  <h3>Movimentações que formam o valor</h3>
                  <ul className="fin-detalhe-lista">
                    {detalhe.movimentos.slice(0, 8).map((movimento) => (
                      <li key={movimento.id}>
                        <button className="fin-btn fin-btn--ghost" type="button" onClick={() => onAbrirMovimento(movimento)}>
                          {movimento.descricao}
                        </button>
                        <strong>{moeda.format(movimento.valor)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function DetalheMovimentoDrawer({
  movimento,
  onFechar,
  onSalvar,
  onPedirExclusao,
  profissionais,
  categorias,
  onCriarCategoria,
}: {
  movimento: MovimentoParaDetalhe | null;
  onFechar: () => void;
  onSalvar: (movimento: MovimentoParaDetalhe) => void;
  onPedirExclusao: (movimento: MovimentoParaDetalhe) => void;
  profissionais: BarbeiroDoLancamento[];
  categorias: CategoriasPorTipo;
  onCriarCategoria: (tipo: TipoComCategoria, nome: string) => void;
}) {
  const aberto = Boolean(movimento);
  const reduzir = useReducedMotion();
  const folha = useFolha();
  const drawerRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<MovimentoParaDetalhe | null>(movimento);
  const [errosEdicao, setErrosEdicao] = useState<Record<string, string>>({});
  useFocoProtegido(aberto, drawerRef, onFechar);

  useEffect(() => {
    setRascunho(movimento);
    setEditando(false);
    setErrosEdicao({});
  }, [movimento]);

  if (!rascunho) return null;
  const automatico = rascunho.origem === "automatico";
  const salvarRascunho = () => {
    const proximosErros: Record<string, string> = {};
    if (!rascunho.categoria.trim()) proximosErros.categoria = "Escolha uma categoria.";
    const eComissao = rascunho.categoria === CATEGORIA_COMISSAO;
    if (eComissao && rascunho.profissionalId === undefined) proximosErros.profissional = "Escolha o barbeiro.";
    if (!Number.isFinite(rascunho.valor) || rascunho.valor <= 0) {
      proximosErros.valor = "Informe um valor maior que zero.";
    }
    if (!rascunho.data) proximosErros.data = "Informe a data.";
    else if (rascunho.data > hojeIso()) proximosErros.data = "Use uma data de hoje ou anterior.";
    setErrosEdicao(proximosErros);
    if (Object.keys(proximosErros).length) return;
    onSalvar({
      ...rascunho,
      descricao: rascunho.descricao.trim() || rascunho.categoria.trim(),
      categoria: rascunho.categoria.trim(),
      profissionalId: eComissao ? rascunho.profissionalId : undefined,
      profissional: eComissao
        ? profissionais.find((item) => item.id === rascunho.profissionalId)?.nome ?? rascunho.profissional
        : undefined,
    });
    setEditando(false);
  };

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className={`fin-root fin-overlay fin-drawer-wrap${folha ? " fin-overlay--folha" : ""}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.aside
              ref={drawerRef}
              className={`fin-drawer${folha ? " fin-drawer--folha" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              {...animacaoDoPainel(reduzir, folha, { x: 36, opacity: 0 }, { x: 30, opacity: 0 }, 0.24)}
            >
              <div className="fin-drawer__head">
                <div>
                  <h2 id={tituloId}>Detalhe da movimentação</h2>
                  <p>{automatico ? "Gerada automaticamente pela agenda." : "Lançamento manual."}</p>
                </div>
                <button className="fin-fechar" data-autofocus type="button" onClick={onFechar} aria-label="Fechar detalhe"><X size={17} /></button>
              </div>
              <div className="fin-drawer__body">
                <div className="fin-detalhe-valor">
                  <span>{rascunho.tipo === "receita" ? "Faturamento" : rascunho.tipo === "entrada" ? "Entrada manual" : "Saída"}</span>
                  <strong>{moeda.format(rascunho.valor)}</strong>
                  <span>{formatarDataLongaSegura(rascunho.data)}</span>
                </div>

                {automatico ? (
                  <div className="fin-detalhe-bloco">
                    <h3>Atendimento de origem</h3>
                    <ul className="fin-detalhe-lista">
                      <li><span>Cliente</span><strong>{rascunho.cliente || "Não informado"}</strong></li>
                      <li><span>Barbeiro</span><strong>{rascunho.profissional || "Não informado"}</strong></li>
                      <li><span>Serviço</span><strong>{rascunho.servico || rascunho.categoria}</strong></li>
                      <li><span>Horário</span><strong>{rascunho.hora || "Não informado"}</strong></li>
                      <li><span>Atendimento</span><strong>{rascunho.atendimentoId ? `#${rascunho.atendimentoId}` : "Não informado"}</strong></li>
                    </ul>
                    <p style={{ marginTop: 16 }}>Para corrigir esta receita, altere o atendimento que a originou. Ela não pode ser apagada aqui.</p>
                  </div>
                ) : editando ? (
                  <div className="fin-form" style={{ paddingTop: 20 }}>
                    <div className="fin-campo">
                      <label htmlFor="fin-editar-descricao">Descrição <span className="fin-campo__opcional">(opcional)</span></label>
                      <input
                        id="fin-editar-descricao"
                        name="descricao"
                        value={rascunho.descricao}
                        aria-invalid={Boolean(errosEdicao.descricao)}
                        aria-describedby={errosEdicao.descricao ? "fin-editar-descricao-erro" : undefined}
                        onChange={(event) => setRascunho({ ...rascunho, descricao: event.target.value })}
                      />
                      {errosEdicao.descricao && <span id="fin-editar-descricao-erro" className="fin-campo__erro">{errosEdicao.descricao}</span>}
                    </div>
                    <div className="fin-form__grid">
                      <div className="fin-campo">
                        <label htmlFor="fin-editar-categoria">Categoria</label>
                        <CampoCategoria
                          id="fin-editar-categoria"
                          value={rascunho.categoria}
                          opcoes={opcoesDeCategoria(
                            rascunho.tipo === "receita" ? [] : categorias[rascunho.tipo],
                            rascunho.categoria,
                          )}
                          onCriar={rascunho.tipo === "receita"
                            ? undefined
                            : (nome) => onCriarCategoria(rascunho.tipo as TipoComCategoria, nome)}
                          erro={errosEdicao.categoria}
                          onChange={(categoria) => setRascunho({ ...rascunho, categoria })}
                        />
                      </div>
                      <div className="fin-campo">
                        <label htmlFor="fin-editar-valor">Valor</label>
                        <CurrencyField
                          id="fin-editar-valor"
                          name="valor"
                          centavos={Math.round(rascunho.valor * 100) || null}
                          ariaInvalid={Boolean(errosEdicao.valor)}
                          ariaDescribedBy={errosEdicao.valor ? "fin-editar-valor-erro" : undefined}
                          onChange={(proximo) => setRascunho({ ...rascunho, valor: (proximo ?? 0) / 100 })}
                        />
                        {errosEdicao.valor && <span id="fin-editar-valor-erro" className="fin-campo__erro">{errosEdicao.valor}</span>}
                      </div>
                      <div className="fin-campo">
                        <label htmlFor="fin-editar-data">Data</label>
                        <DateField
                          id="fin-editar-data"
                          name="data"
                          max={hojeIso()}
                          value={rascunho.data}
                          ariaInvalid={Boolean(errosEdicao.data)}
                          ariaDescribedBy={errosEdicao.data ? "fin-editar-data-erro" : undefined}
                          onChange={(data) => setRascunho({ ...rascunho, data })}
                        />
                        {errosEdicao.data && <span id="fin-editar-data-erro" className="fin-campo__erro">{errosEdicao.data}</span>}
                      </div>
                      {rascunho.categoria === CATEGORIA_COMISSAO && (
                        <div className="fin-campo">
                          <label htmlFor="fin-editar-barbeiro">Barbeiro</label>
                          <SelectField
                            id="fin-editar-barbeiro"
                            name="barbeiro"
                            value={rascunho.profissionalId === undefined ? "" : String(rascunho.profissionalId)}
                            options={opcoesDeBarbeiro(profissionais)}
                            ariaInvalid={Boolean(errosEdicao.profissional)}
                            ariaDescribedBy={errosEdicao.profissional ? "fin-editar-barbeiro-erro" : undefined}
                            onValueChange={(valor) => setRascunho({ ...rascunho, profissionalId: Number(valor) })}
                          />
                          {errosEdicao.profissional && <span id="fin-editar-barbeiro-erro" className="fin-campo__erro">{errosEdicao.profissional}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="fin-detalhe-bloco">
                    <h3>Informações</h3>
                    <ul className="fin-detalhe-lista">
                      <li><span>Descrição</span><strong>{rascunho.descricao}</strong></li>
                      <li><span>Categoria</span><strong>{rascunho.categoria}</strong></li>
                      {rascunho.profissional && <li><span>Barbeiro</span><strong>{rascunho.profissional}</strong></li>}
                      <li><span>Origem</span><strong>Manual</strong></li>
                    </ul>
                  </div>
                )}
              </div>
              {!automatico && (
                <div className="fin-drawer__footer fin-dialog__actions">
                  {editando ? (
                    <>
                      <button className="fin-btn" type="button" onClick={() => { setRascunho(movimento); setEditando(false); }}>Cancelar</button>
                      <button className="fin-btn fin-btn--primary" type="button" onClick={salvarRascunho}>Salvar alterações</button>
                    </>
                  ) : (
                    <>
                      <button className="fin-btn fin-btn--danger" type="button" onClick={() => onPedirExclusao(rascunho)}><Trash2 size={15} /> Excluir</button>
                      <button className="fin-btn" type="button" onClick={() => setEditando(true)}><PencilLine size={15} /> Editar</button>
                    </>
                  )}
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function ConfirmarExclusaoModal({
  movimento,
  onFechar,
  onConfirmar,
}: {
  movimento: MovimentoParaDetalhe | null;
  onFechar: () => void;
  onConfirmar: (movimento: MovimentoParaDetalhe, motivo: string) => void;
}) {
  const aberto = Boolean(movimento);
  const reduzir = useReducedMotion();
  const folha = useFolha();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  useFocoProtegido(aberto, dialogRef, onFechar);

  useEffect(() => { if (aberto) { setMotivo(""); setErro(""); } }, [aberto]);

  const confirmar = () => {
    if (!motivo.trim()) { setErro("Informe por que este lançamento será excluído."); return; }
    if (movimento) onConfirmar(movimento, motivo.trim());
  };

  return (
    <Portal>
      <AnimatePresence>
        {aberto && movimento && (
          <motion.div
            className={`fin-root fin-overlay${folha ? " fin-overlay--folha" : ""}`}
            /* Por cima do detalhe da movimentação, de onde ela abre (110). */
            style={{ zIndex: 115 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.14 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className={`fin-dialog${folha ? " fin-dialog--folha" : ""}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              {...animacaoDoPainel(reduzir, folha, { opacity: 0, scale: 0.98 }, { opacity: 0 }, 0.18)}
            >
              <div className="fin-dialog__head">
                <div><h2 id={tituloId}>Excluir lançamento?</h2><p>Esta ação remove “{movimento.descricao}” do resultado operacional.</p></div>
                <button className="fin-fechar" type="button" onClick={onFechar} aria-label="Fechar confirmação"><X size={17} /></button>
              </div>
              <div className="fin-dialog__body">
                <div className="fin-campo fin-alerta-motivo">
                  <label htmlFor="fin-motivo-exclusao">Motivo da exclusão</label>
                  <textarea
                    id="fin-motivo-exclusao"
                    name="motivo"
                    data-autofocus
                    value={motivo}
                    aria-invalid={Boolean(erro)}
                    aria-describedby={erro ? "fin-motivo-exclusao-erro" : undefined}
                    onChange={(event) => setMotivo(event.target.value)}
                    placeholder="Ex.: lançamento duplicado"
                  />
                  {erro && <span id="fin-motivo-exclusao-erro" className="fin-campo__erro">{erro}</span>}
                </div>
              </div>
              <div className="fin-dialog__actions">
                <button className="fin-btn" type="button" onClick={onFechar}>Cancelar</button>
                <button className="fin-btn fin-btn--danger" type="button" onClick={confirmar}>Excluir lançamento</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
