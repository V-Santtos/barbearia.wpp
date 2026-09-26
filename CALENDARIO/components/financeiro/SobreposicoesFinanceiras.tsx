import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import {
  ArrowRight,
  CircleDollarSign,
  PencilLine,
  Trash2,
  X,
} from "lucide-react";
import { DateField } from "../ui/DateField";
import { SelectField } from "../ui/SelectField";

export type TipoLancamentoManual = "saida" | "ajuste";

export interface LancamentoRascunho {
  tipo: TipoLancamentoManual;
  categoria: string;
  valor: number;
  data: string;
  descricao: string;
}

export interface MovimentoParaDetalhe {
  id: string;
  tipo: "receita" | "saida" | "ajuste";
  origem: "automatico" | "manual";
  data: string;
  hora?: string;
  descricao: string;
  categoria: string;
  valor: number;
  cliente?: string;
  profissional?: string;
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

const CATEGORIAS = [
  "Materiais",
  "Estrutura",
  "Contas",
  "Manutenção",
  "Investimentos",
  "Marketing",
  "Retirada",
  "Outros",
].map((categoria) => ({ value: categoria, label: categoria }));

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
}: {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (lancamento: LancamentoRascunho) => void;
}) {
  const reduzir = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [tipo, setTipo] = useState<TipoLancamentoManual>("saida");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeIso);
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useFocoProtegido(aberto, dialogRef, onFechar);

  useEffect(() => {
    if (!aberto) return;
    setTipo("saida");
    setCategoria("");
    setValor("");
    setData(hojeIso());
    setDescricao("");
    setErros({});
  }, [aberto]);

  const salvar = (event: FormEvent) => {
    event.preventDefault();
    const numero = Number(valor.replace(",", "."));
    const proximosErros: Record<string, string> = {};
    if (!categoria) proximosErros.categoria = "Escolha uma categoria.";
    if (!Number.isFinite(numero) || (tipo === "saida" ? numero <= 0 : numero === 0)) {
      proximosErros.valor = tipo === "saida"
        ? "Informe um valor maior que zero."
        : "Informe um ajuste diferente de zero.";
    }
    if (!data) proximosErros.data = "Informe a data do lançamento.";
    else if (data > hojeIso()) proximosErros.data = "Use uma data de hoje ou anterior.";
    if (!descricao.trim()) proximosErros.descricao = "Descreva o motivo do lançamento.";
    setErros(proximosErros);
    if (Object.keys(proximosErros).length) return;
    onSalvar({ tipo, categoria, valor: numero, data, descricao: descricao.trim() });
  };

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className="fin-root fin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className="fin-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reduzir ? false : { opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduzir ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 8 }}
              transition={{ duration: reduzir ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="fin-dialog__head">
                <div>
                  <h2 id={tituloId}>Novo lançamento</h2>
                  <p>Registre somente o que não nasce automaticamente da agenda.</p>
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
                      onValueChange={(value) => setTipo(value as TipoLancamentoManual)}
                      aria-label="Tipo de lançamento"
                    >
                      <RadioGroupPrimitive.Item value="saida">
                        <CircleDollarSign aria-hidden="true" size={16} />
                        <span>Saída</span>
                        <RadioGroupPrimitive.Indicator className="fin-tipo-lancamento__indicador" />
                      </RadioGroupPrimitive.Item>
                      <RadioGroupPrimitive.Item value="ajuste">
                        <PencilLine aria-hidden="true" size={16} />
                        <span>Ajuste</span>
                        <RadioGroupPrimitive.Indicator className="fin-tipo-lancamento__indicador" />
                      </RadioGroupPrimitive.Item>
                    </RadioGroupPrimitive.Root>
                    <span className="fin-ajuda">
                      {tipo === "saida"
                        ? "Receitas concluídas entram automaticamente."
                        : "Valor positivo soma; negativo reduz o resultado."}
                    </span>
                  </div>

                  <div className="fin-form__grid">
                    <div className="fin-campo">
                      <label htmlFor="fin-categoria">Categoria</label>
                      <SelectField
                        id="fin-categoria"
                        name="categoria"
                        dataAutofocus
                        value={categoria}
                        options={CATEGORIAS}
                        ariaInvalid={Boolean(erros.categoria)}
                        ariaDescribedBy={erros.categoria ? "fin-categoria-erro" : undefined}
                        onValueChange={setCategoria}
                      />
                      {erros.categoria && <span id="fin-categoria-erro" className="fin-campo__erro">{erros.categoria}</span>}
                    </div>
                    <div className="fin-campo">
                      <label htmlFor="fin-valor">Valor</label>
                      <input
                        id="fin-valor"
                        name="valor"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={valor}
                        aria-invalid={Boolean(erros.valor)}
                        aria-describedby={erros.valor ? "fin-valor-erro" : undefined}
                        onChange={(event) => setValor(event.target.value)}
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
                    <div className="fin-campo fin-campo--inteiro">
                      <label htmlFor="fin-descricao">Descrição</label>
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
}: {
  aberto: boolean;
  onFechar: () => void;
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

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className="fin-root fin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className="fin-dialog fin-dialog--largo"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reduzir ? false : { opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduzir ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 8 }}
              transition={{ duration: reduzir ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="fin-dialog__head">
                <div>
                  <h2 id={tituloId}>Comparar períodos</h2>
                  <p>Veja o número e o que explica a mudança.</p>
                </div>
                <button className="fin-fechar" type="button" onClick={onFechar} aria-label="Fechar comparação">
                  <X size={17} />
                </button>
              </div>
              <div className="fin-dialog__body">
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
                  <div className="fin-comparacao-seta"><ArrowRight size={18} /></div>
                  <div className="fin-comparacao-card">
                    <span>{rotuloAtual}</span>
                    <strong>{formatar(valorAtual)}</strong>
                    <small>{`${diferenca > 0 ? "+" : diferenca < 0 ? "−" : ""}${formatar(Math.abs(diferenca))} · ${percentual === null ? "sem base anterior" : `${percentual > 0 ? "+" : ""}${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}`}</small>
                  </div>
                </div>

                <div className="fin-comparacao-grafico" aria-label="Comparação visual dos dois períodos">
                  <div className="fin-comparacao-barras">
                    <span className="fin-comparacao-barra" style={{ height: `${Math.max(3, Math.abs(valorAnterior) / maior * 100)}%` }} />
                    <span className="fin-comparacao-barra fin-comparacao-barra--atual" style={{ height: `${Math.max(3, Math.abs(valorAtual) / maior * 100)}%` }} />
                  </div>
                  <div className="fin-comparacao-legendas"><span>Anterior</span><span>Atual</span></div>
                </div>

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useFocoProtegido(aberto, drawerRef, onFechar);

  return (
    <Portal>
      <AnimatePresence>
        {aberto && detalhe && (
          <motion.div
            className="fin-root fin-overlay fin-drawer-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.aside
              ref={drawerRef}
              className="fin-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reduzir ? false : { x: 36, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduzir ? { opacity: 0 } : { x: 30, opacity: 0 }}
              transition={{ duration: reduzir ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
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
}: {
  movimento: MovimentoParaDetalhe | null;
  onFechar: () => void;
  onSalvar: (movimento: MovimentoParaDetalhe) => void;
  onPedirExclusao: (movimento: MovimentoParaDetalhe) => void;
}) {
  const aberto = Boolean(movimento);
  const reduzir = useReducedMotion();
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
    if (!rascunho.descricao.trim()) proximosErros.descricao = "Informe uma descrição.";
    if (!rascunho.categoria.trim()) proximosErros.categoria = "Escolha uma categoria.";
    if (!Number.isFinite(rascunho.valor) || (rascunho.tipo === "saida" ? rascunho.valor <= 0 : rascunho.valor === 0)) {
      proximosErros.valor = rascunho.tipo === "saida"
        ? "Informe um valor maior que zero."
        : "Informe um ajuste diferente de zero.";
    }
    if (!rascunho.data) proximosErros.data = "Informe a data.";
    else if (rascunho.data > hojeIso()) proximosErros.data = "Use uma data de hoje ou anterior.";
    setErrosEdicao(proximosErros);
    if (Object.keys(proximosErros).length) return;
    onSalvar({
      ...rascunho,
      descricao: rascunho.descricao.trim(),
      categoria: rascunho.categoria.trim(),
    });
    setEditando(false);
  };

  return (
    <Portal>
      <AnimatePresence>
        {aberto && (
          <motion.div
            className="fin-root fin-overlay fin-drawer-wrap"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.16 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.aside
              ref={drawerRef}
              className="fin-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reduzir ? false : { x: 36, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduzir ? { opacity: 0 } : { x: 30, opacity: 0 }}
              transition={{ duration: reduzir ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
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
                  <span>{rascunho.tipo === "receita" ? "Faturamento" : rascunho.tipo === "saida" ? "Saída" : "Ajuste"}</span>
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
                      <label htmlFor="fin-editar-descricao">Descrição</label>
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
                        <SelectField
                          id="fin-editar-categoria"
                          name="categoria"
                          value={rascunho.categoria}
                          options={CATEGORIAS}
                          ariaInvalid={Boolean(errosEdicao.categoria)}
                          ariaDescribedBy={errosEdicao.categoria ? "fin-editar-categoria-erro" : undefined}
                          onValueChange={(categoria) => setRascunho({ ...rascunho, categoria })}
                        />
                        {errosEdicao.categoria && <span id="fin-editar-categoria-erro" className="fin-campo__erro">{errosEdicao.categoria}</span>}
                      </div>
                      <div className="fin-campo">
                        <label htmlFor="fin-editar-valor">Valor</label>
                        <input
                          id="fin-editar-valor"
                          name="valor"
                          type="number"
                          min={rascunho.tipo === "saida" ? "0.01" : undefined}
                          step="0.01"
                          value={rascunho.valor}
                          aria-invalid={Boolean(errosEdicao.valor)}
                          aria-describedby={errosEdicao.valor ? "fin-editar-valor-erro" : undefined}
                          onChange={(event) => setRascunho({ ...rascunho, valor: Number(event.target.value) })}
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
                    </div>
                  </div>
                ) : (
                  <div className="fin-detalhe-bloco">
                    <h3>Informações</h3>
                    <ul className="fin-detalhe-lista">
                      <li><span>Descrição</span><strong>{rascunho.descricao}</strong></li>
                      <li><span>Categoria</span><strong>{rascunho.categoria}</strong></li>
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
            className="fin-root fin-overlay"
            style={{ zIndex: 90 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.14 }}
            onMouseDown={(event) => event.target === event.currentTarget && onFechar()}
          >
            <motion.div
              ref={dialogRef}
              className="fin-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reduzir ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
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
