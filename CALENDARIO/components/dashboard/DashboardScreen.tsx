/**
 * A casca do dashboard dentro do app.
 *
 * No desktop é uma camada por cima da agenda: o calendário fica atrás, borrado,
 * e sai pelo X, pelo `Esc` ou clicando no véu. Três saídas, nenhuma escondida —
 * e nenhuma delas navega para lugar nenhum, porque não se saiu de lugar nenhum.
 *
 * No celular é aba, tela cheia, e quem governa é o dock.
 *
 * Todo número vem de UMA chamada (`GET /dashboard/resumo`). Os agendamentos já
 * estão em memória no `App.tsx`, e mesmo assim não são usados aqui: misturar as
 * duas fontes é o que produziu, no protótipo, três respostas diferentes para
 * "quantos horários livres hoje" na mesma tela.
 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  getDashboardResumo,
  type DashboardResumo,
  type PeriodoDashboard,
} from "../../services/calendarApi";
import { usePolling } from "../../hooks/usePolling";
import { ProfFilter, type FiltroProf } from "./primitivos";
import { DashboardDesktop } from "./DashboardDesktop";
import { DashboardMobile } from "./DashboardMobile";
import { montarKpis, rotuloDoPeriodo } from "./kpis";
import { montarVm } from "./modelo";
import "./css/index.css";

/** Mais folgado que os 15s da agenda: esta tela custa mais e muda menos. */
const INTERVALO_MS = 30_000;

interface Props {
  aberto: boolean;
  isMobile: boolean;
  onFechar: () => void;
}

function useResumo(ativo: boolean) {
  const [dados, setDados] = React.useState<DashboardResumo | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  usePolling(
    async () => {
      const resposta = await getDashboardResumo();
      setDados(resposta);
      setErro(null);
    },
    { intervalMs: INTERVALO_MS, enabled: ativo },
    [ativo],
  );

  React.useEffect(() => {
    if (!ativo) return;
    // Só vira erro visível se NUNCA carregou. Falha depois do primeiro carregamento
    // mantém o último dado bom na tela — número velho de 30s é melhor que tela vazia.
    const id = setTimeout(() => {
      setDados((atual) => {
        if (!atual) setErro("Não foi possível carregar o resumo.");
        return atual;
      });
    }, 12_000);
    return () => clearTimeout(id);
  }, [ativo]);

  return { dados, erro };
}

/** "atualizado há 24s" — verdade medida, não texto fixo. */
function useIdade(geradoEm: number | undefined) {
  const [, forcar] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(forcar, 5_000);
    return () => clearInterval(id);
  }, []);
  if (!geradoEm) return null;
  const seg = Math.max(0, Math.round((Date.now() - geradoEm) / 1000));
  if (seg < 60) return `atualizado há ${seg}s`;
  return `atualizado há ${Math.round(seg / 60)}min`;
}

export const DashboardScreen: React.FC<Props> = ({
  aberto,
  isMobile,
  onFechar,
}) => {
  const [filtro, setFiltro] = React.useState<FiltroProf>("all");
  const [periodo, setPeriodo] = React.useState<PeriodoDashboard>("hoje");
  const { dados, erro } = useResumo(aberto);
  const idade = useIdade(dados ? new Date(dados.gerado_em).getTime() : undefined);

  // `Esc` fecha — mas só no desktop, onde ele é camada. No celular a saída é o
  // dock, e não existe teclado para pressionar.
  React.useEffect(() => {
    if (!aberto || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, isMobile, onFechar]);

  const vm = React.useMemo(() => (dados ? montarVm(dados) : null), [dados]);

  // Um profissional filtrado que sumiu (desativado enquanto a tela estava
  // aberta) deixaria a tela em branco sem dizer por quê.
  React.useEffect(() => {
    if (!vm || filtro === "all") return;
    if (!vm.profs.some((p) => p.id === filtro)) setFiltro("all");
  }, [vm, filtro]);

  if (!aberto) return null;

  const profsEmCena =
    vm && filtro !== "all"
      ? vm.profs.filter((p) => p.id === filtro)
      : (vm?.profs ?? []);

  const agregadoBruto = dados
    ? (dados.periodos[periodo]?.[String(filtro)] ??
      dados.periodos[periodo]?.all)
    : null;
  const kpis = agregadoBruto
    ? montarKpis(agregadoBruto, periodo, profsEmCena)
    : [];

  const cabecalho = (
    <div className="db-pagehead">
      <div className="db-pagehead__left">
        <h1 className="db-pagehead__title">Dashboard</h1>
        {/* `db-pagehead__sub` é `nowrap`, e no celular a linha inteira não cabe:
            no primeiro teste em 375px ela cortava no meio de "atualizado".
            "Resumo do calendário" é a parte que o título já implica, então é ela
            que sai — o período e a idade do dado ficam, porque nenhum dos dois
            está escrito em outro lugar. */}
        {/* No celular a linha perdeu o pulso verde e a idade do dado
            (2026-08-04). Os dois motivos são mecânicos:

            - O `.db-pulse` verde e o `.mb-now__pulse` do card "Em atendimento
              agora" piscavam ao mesmo tempo, a ~200px um do outro, dizendo a
              mesma coisa em cores diferentes. O que carrega informação é o do
              atendimento.
            - `idade` re-renderiza a cada 5s (`useIdade`), então a linha
              embaixo do título ficava SEMPRE se mexendo na visão periférica
              de quem está lendo os números. E ela fala quando não precisa e
              cala quando precisaria: o `useResumo` esconde falha de propósito
              depois do primeiro carregamento, e é justamente aí que saber a
              idade do dado importaria. Volta como aviso quando envelhecer de
              verdade, não como cronômetro.

            O que sobra é a única informação nova da linha: a data. O período
            some porque o chip logo abaixo já diz "Hoje" / "7 dias" -- eram a
            mesma palavra duas vezes, com 8px de distância. */}
        <p className="db-pagehead__sub">
          {!isMobile && <span className="db-pulse" />}
          {isMobile ? "" : "Resumo do calendário"}
          {vm
            ? `${isMobile ? "" : " · "}${rotuloDoPeriodo(periodo, vm.hoje)}`
            : ""}
          {!isMobile && idade ? ` · ${idade}` : ""}
        </p>
      </div>
      {/* O filtro de profissional fica no nível da página porque governa MESMO
          tudo abaixo. O chip de período mora dentro da faixa de KPIs, que é a
          única coisa que ele muda.

          No celular ele desce para uma linha própria (`mb-topfilter`): ao lado
          do título, em 375px, o botão saía pela borda direita. */}
      <div className="db-pagehead__filters">
        {vm && !isMobile && (
          <ProfFilter value={filtro} onChange={setFiltro} profs={vm.profs} />
        )}
        {!isMobile && (
          <button
            className="dash-fechar"
            onClick={onFechar}
            aria-label="Fechar dashboard"
            title="Fechar (Esc)"
          >
            <X size={19} />
          </button>
        )}
      </div>
    </div>
  );

  const filtroMobile = vm && isMobile && (
    <div className="mb-topfilter">
      <ProfFilter value={filtro} onChange={setFiltro} profs={vm.profs} />
    </div>
  );

  const miolo = (() => {
    if (erro && !vm) {
      return (
        <div className="db-resumo">
          <p style={{ color: "var(--text-muted)" }}>
            {erro} Verifique a conexão com a API.
          </p>
        </div>
      );
    }
    if (!vm || !kpis.length) {
      return (
        <div className="db-resumo">
          <p style={{ color: "var(--text-muted)" }}>Carregando o resumo…</p>
        </div>
      );
    }
    return isMobile ? (
      <DashboardMobile
        vm={vm}
        filtro={filtro}
        periodo={periodo}
        onPeriodo={setPeriodo}
        agregado={kpis}
        onVerAgenda={onFechar}
      />
    ) : (
      <DashboardDesktop
        vm={vm}
        filtro={filtro}
        periodo={periodo}
        onPeriodo={setPeriodo}
        agregado={kpis}
      />
    );
  })();

  if (isMobile) {
    return (
      <div className="dash-root dash-mobile">
        <div className="mb-shell">
          <div className="mb-scroll">
            {cabecalho}
            {filtroMobile}
            {miolo}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="dash-root dash-veu"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onMouseDown={(e) => {
          // Só o clique que NASCE no véu fecha. Sem isto, arrastar para
          // selecionar texto dentro e soltar fora fecharia a tela.
          if (e.target === e.currentTarget) onFechar();
        }}
      >
        <motion.div
          className="dash-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard"
          initial={{ opacity: 0, scale: 0.985, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.985, y: 8 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="dash-modal__corpo">
            {cabecalho}
            {miolo}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardScreen;
