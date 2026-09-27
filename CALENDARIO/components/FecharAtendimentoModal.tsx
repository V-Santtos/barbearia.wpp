import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { Event, Professional } from "../types";
import {
  getConfiguredServices,
  type ConcluirAtendimentoPayload,
  type ConfiguredService,
} from "../services/calendarApi";
import {
  calcularTotais,
  itensDoCatalogo,
  separarServicos,
  validarFechamento,
  type AjusteDeValor,
  type TipoAjuste,
} from "../lib/fechamento";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { CAMPO, FUNDO_CAMPO_MODAL } from "./ui/campo";
import { CurrencyField } from "./ui/CurrencyField";
import { SeletorDeServicos } from "./ui/SeletorDeServicos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const CAMPO_RESUMO = `${CAMPO} ${FUNDO_CAMPO_MODAL} px-3.5 py-3 text-base md:text-[15px]`;

interface FecharAtendimentoModalProps {
  /** `null` mantém fechado. */
  evento: Event | null;
  profissional?: Professional;
  onFechar: () => void;
  onConcluir: (evento: Event, payload: ConcluirAtendimentoPayload) => Promise<void>;
}

/**
 * Resumo do "Marcar como feito" (spec 2026-09-27-fechar-atendimento-design).
 * Agendado: vem com o serviço marcado, o barbeiro confere e conclui.
 * Presencial: vem vazio; escolher o serviço é obrigatório e o cliente é
 * opcional. Produto não entra aqui: vai em "Venda de produtos", no Financeiro.
 */
export default function FecharAtendimentoModal({
  evento,
  profissional,
  onFechar,
  onConcluir,
}: FecharAtendimentoModalProps) {
  const aberto = evento !== null;
  const eDesktop = useMediaQuery("(min-width: 768px)");
  const reduzir = useReducedMotion();
  const tituloId = useId();
  const painelRef = useRef<HTMLDivElement>(null);

  const [catalogo, setCatalogo] = useState<ConfiguredService[]>([]);
  const [erroCatalogo, setErroCatalogo] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>("desconto");
  const [centavosAjuste, setCentavosAjuste] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const presencial = evento?.source === "presencial";

  // Cada abertura começa do zero, a partir do card.
  useEffect(() => {
    if (!evento) return;
    setSelecionados(evento.source === "presencial" ? [] : separarServicos(evento.servico));
    setAjusteAberto(false);
    setTipoAjuste("desconto");
    setCentavosAjuste(null);
    setMotivo("");
    setNome("");
    setTelefone("");
    setErros({});
    setSalvando(false);

    let ativo = true;
    setErroCatalogo(false);
    getConfiguredServices()
      .then((lista) => {
        if (!ativo) return;
        setCatalogo(lista);
        // "Corte + barba" gravado vira o "Corte + Barba" da tabela, para marcar o item certo.
        setSelecionados((atuais) => itensDoCatalogo(atuais, lista).map((item) => item.nome));
      })
      .catch(() => ativo && setErroCatalogo(true));
    return () => {
      ativo = false;
    };
  }, [evento]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !salvando) onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onFechar, salvando]);

  const itens = useMemo(() => itensDoCatalogo(selecionados, catalogo), [selecionados, catalogo]);
  const ajuste: AjusteDeValor | null = ajusteAberto && centavosAjuste !== null
    ? { tipo: tipoAjuste, valor: centavosAjuste / 100, ...(motivo.trim() && { motivo: motivo.trim() }) }
    : null;
  const { subtotal, total } = calcularTotais(itens, ajuste);

  const concluir = async () => {
    if (!evento || salvando) return;
    const cliente = presencial ? { nome: nome.trim(), telefone } : null;
    const proximos = validarFechamento({ servicos: itens, ajuste, cliente });
    if (ajusteAberto && centavosAjuste === null) proximos.ajuste = "Informe o valor do ajuste.";
    setErros(proximos);
    if (Object.keys(proximos).length) return;

    setSalvando(true);
    try {
      await onConcluir(evento, { servicos: itens, ajuste, ...(presencial && { cliente }) });
    } catch (erro) {
      setErros({ geral: erro instanceof Error ? erro.message : "Não deu para concluir. Tente de novo." });
      setSalvando(false);
    }
  };

  const titulo = presencial ? "Presencial" : evento?.title || "Atendimento";

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          key="fechar-atendimento"
          className={`fixed inset-0 z-[120] flex bg-black/65 ${eDesktop ? "items-center justify-center p-6" : "items-end"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduzir ? 0 : 0.16 }}
          onMouseDown={(event) => event.target === event.currentTarget && !salvando && onFechar()}
        >
          <motion.div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className={`flex w-full flex-col overflow-hidden border border-white/10 bg-[#191919] text-white ${
              eDesktop ? "max-h-[88vh] max-w-[440px] rounded-[24px]" : "max-h-[90dvh] rounded-t-[28px]"
            }`}
            style={eDesktop ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={reduzir ? { opacity: 0 } : eDesktop ? { opacity: 0, scale: 0.98, y: 8 } : { y: "100%" }}
            animate={reduzir ? { opacity: 1 } : eDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={reduzir ? { opacity: 0 } : eDesktop ? { opacity: 0, scale: 0.98, y: 8 } : { y: "100%" }}
            transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-5">
              <div className="min-w-0">
                <h2 id={tituloId} className="truncate text-[17px] font-semibold">
                  Fechar atendimento · {titulo}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/50">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: profissional?.color ?? "#5650f9" }}
                  />
                  {profissional?.name ?? "Profissional"} · confira antes de concluir
                </p>
              </div>
              <button
                type="button"
                onClick={onFechar}
                disabled={salvando}
                aria-label="Fechar resumo"
                className="-mr-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <p className="px-2 pb-1 text-sm font-medium">
                {presencial ? "Qual serviço foi feito?" : "Serviços"}
              </p>
              {erroCatalogo && catalogo.length === 0 ? (
                <p className="px-2 py-3 text-[14px] text-white/50">
                  Não deu para carregar os serviços. Feche e abra de novo.
                </p>
              ) : (
                <SeletorDeServicos
                  opcoes={catalogo}
                  selecionados={selecionados}
                  onChange={(nomes) => {
                    setSelecionados(nomes);
                    setErros(({ servicos: _s, ...resto }) => resto);
                  }}
                />
              )}
              {erros.servicos && <p className="px-2 text-[13px] text-[#ffb7a8]">{erros.servicos}</p>}
              {catalogo.length > 0 && itens.some((item) => item.servicoId === undefined) && (
                <p className="px-2 pt-1 text-[13px] leading-snug text-[#f5c46b]">
                  Serviço fora da tabela entra valendo R$ 0,00. Desmarque e escolha o serviço certo.
                </p>
              )}

              <div className="mt-2 border-t border-white/[0.08] px-2 pt-3">
                <button
                  type="button"
                  aria-expanded={ajusteAberto}
                  onClick={() => setAjusteAberto((valor) => !valor)}
                  className="flex w-full items-center justify-between py-1.5 text-left text-sm font-medium"
                >
                  Ajuste de valor
                  <ChevronDown size={16} className={`text-white/50 transition-transform ${ajusteAberto ? "rotate-180" : ""}`} />
                </button>
                {ajusteAberto && (
                  <div className="space-y-2.5 pb-1 pt-2">
                    <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-2">
                      {([["acrescimo", "+ Acréscimo"], ["desconto", "− Desconto"]] as const).map(([tipo, rotulo]) => (
                        <button
                          key={tipo}
                          type="button"
                          role="radio"
                          aria-checked={tipoAjuste === tipo}
                          onClick={() => setTipoAjuste(tipo)}
                          className={`h-11 rounded-xl border text-[14px] font-medium transition ${
                            tipoAjuste === tipo
                              ? "border-accent bg-white/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
                          }`}
                        >
                          {rotulo}
                        </button>
                      ))}
                    </div>
                    <CurrencyField
                      id="fechar-ajuste"
                      name="ajuste"
                      centavos={centavosAjuste}
                      onChange={(valor) => {
                        setCentavosAjuste(valor);
                        setErros(({ ajuste: _a, ...resto }) => resto);
                      }}
                      ariaInvalid={Boolean(erros.ajuste)}
                      ariaDescribedBy={erros.ajuste ? "fechar-ajuste-erro" : undefined}
                      className={CAMPO_RESUMO}
                    />
                    <input
                      name="motivo"
                      maxLength={60}
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      placeholder="Motivo (opcional)"
                      aria-label="Motivo do ajuste"
                      className={CAMPO_RESUMO}
                    />
                    {erros.ajuste && (
                      <p id="fechar-ajuste-erro" className="text-[13px] text-[#ffb7a8]">{erros.ajuste}</p>
                    )}
                  </div>
                )}
              </div>

              {presencial && (
                <div className="mt-2 space-y-2.5 border-t border-white/[0.08] px-2 pb-1 pt-3">
                  <p className="text-sm font-medium">
                    Cliente <span className="font-normal text-white/45">(opcional)</span>
                  </p>
                  <input
                    name="cliente"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Nome e sobrenome"
                    aria-label="Nome do cliente"
                    autoComplete="off"
                    className={CAMPO_RESUMO}
                  />
                  <input
                    name="telefone"
                    type="tel"
                    inputMode="tel"
                    value={telefone}
                    onChange={(event) => {
                      setTelefone(event.target.value);
                      setErros(({ telefone: _t, ...resto }) => resto);
                    }}
                    placeholder="(11) 98888-7777"
                    aria-label="Telefone do cliente"
                    aria-invalid={Boolean(erros.telefone) || undefined}
                    className={CAMPO_RESUMO}
                  />
                  {erros.telefone && <p className="text-[13px] text-[#ffb7a8]">{erros.telefone}</p>}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-white/[0.08] px-5 pb-4 pt-3">
              <dl className="space-y-1 text-[14px] tabular-nums">
                <div className="flex justify-between text-white/55">
                  <dt>Subtotal</dt>
                  <dd>{moeda.format(subtotal)}</dd>
                </div>
                {ajuste && (
                  <div className="flex justify-between text-white/55">
                    <dt>{ajuste.tipo === "desconto" ? "Desconto" : "Acréscimo"}</dt>
                    <dd>
                      {ajuste.tipo === "desconto" ? "− " : "+ "}
                      {moeda.format(ajuste.valor)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between text-[16px] font-semibold text-white">
                  <dt>Total</dt>
                  <dd>{moeda.format(total)}</dd>
                </div>
              </dl>
              {erros.geral && <p className="mt-2 text-[13px] text-[#ffb7a8]">{erros.geral}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onFechar}
                  disabled={salvando}
                  className="h-12 rounded-xl border border-white/10 px-4 text-[14px] font-medium text-white/70 hover:bg-white/[0.06]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={concluir}
                  disabled={salvando}
                  className="h-12 flex-1 rounded-xl bg-accent text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {salvando ? "Concluindo..." : `Concluir · ${moeda.format(total)}`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
