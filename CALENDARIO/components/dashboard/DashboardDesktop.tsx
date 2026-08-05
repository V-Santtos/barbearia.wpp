/**
 * O dashboard no desktop.
 *
 * A `db-topbar` do protótipo NÃO veio: marca, navegação de data e avatar são do
 * app e continuam existindo atrás do modal. Repeti-las aqui era o protótipo
 * fingindo ser aplicativo — e o bloco de data, além de repetido, não navegava
 * nada, porque esta tela é sempre hoje.
 */
import React from "react";
import type { PeriodoDashboard } from "../../services/calendarApi";
import { KpiCard, Panel, PeriodChips, StatusPill, type FiltroProf } from "./primitivos";
import { DispoList } from "./Disponibilidade";
import { RelogioDoDia } from "./RelogioDoDia";
import { montarKpis, OPCOES_PERIODO } from "./kpis";
import { proximosLivres, statusDoDia, type DashboardVm } from "./modelo";

const ATIVOS = ["agendado", "confirmado", "reagendado", "em-atendimento"];

interface Props {
  vm: DashboardVm;
  filtro: FiltroProf;
  periodo: PeriodoDashboard;
  onPeriodo: (p: PeriodoDashboard) => void;
  agregado: ReturnType<typeof montarKpis>;
}

export const DashboardDesktop: React.FC<Props> = ({
  vm,
  filtro,
  periodo,
  onPeriodo,
  agregado,
}) => {
  const [aba, setAba] = React.useState<"proximos" | "linha" | "concluidos">(
    "proximos",
  );

  const profs =
    filtro === "all" ? vm.profs : vm.profs.filter((p) => p.id === filtro);
  const porId = new Map(vm.profs.map((p) => [p.id, p]));
  const agenda =
    filtro === "all" ? vm.agenda : vm.agenda.filter((a) => a.profId === filtro);

  const proximos = agenda.filter((a) => ATIVOS.includes(a.status));
  const concluidos = agenda.filter((a) => a.status === "concluido");
  const cancelados = agenda.filter((a) => a.status === "cancelado");
  const linhaDoTempo = [...agenda].sort((a, b) => a.hora.localeCompare(b.hora));

  const ABAS = [
    { id: "proximos" as const, label: "Próximos", lista: proximos },
    { id: "linha" as const, label: "Linha do tempo", lista: linhaDoTempo },
    { id: "concluidos" as const, label: "Concluídos", lista: concluidos },
  ];
  const lista = ABAS.find((t) => t.id === aba)?.lista ?? proximos;

  // Na linha do tempo, o corte entre o que já passou e o que vem.
  const iAgora =
    aba === "linha"
      ? linhaDoTempo.findIndex(
          (a) => a.status !== "concluido" && a.status !== "em-atendimento",
        )
      : -1;

  return (
    <>
      {/* A faixa saiu da linguagem visual dos painéis — sem borda e sem sombra —
          para dizer sem uma palavra que ela é resumo e eles são trabalho. */}
      <section className="db-resumo">
        <div className="db-resumo__head">
          <PeriodChips
            value={periodo}
            onChange={onPeriodo}
            options={OPCOES_PERIODO}
          />
        </div>
        <div className="db-kpis">
          {agregado.map((k) => (
            <KpiCard
              key={k.chave}
              label={k.label}
              value={k.value}
              sub={k.sub}
              destaque={k.destaque}
            />
          ))}
        </div>
      </section>

      <div
        className="db-row"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)" }}
      >
        <div style={{ position: "relative" }}>
          <Panel
            title="Agenda de hoje"
            meta={`${proximos.length} próximos · ${concluidos.length} concluídos · ${cancelados.length} cancelados`}
            actions={
              <div className="seg">
                {ABAS.map((t) => (
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
            bodyStyle={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ul
              className="agenda"
              style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
            >
              {lista.length === 0 && (
                <li className="agenda__vazio">
                  {aba === "concluidos"
                    ? "Nenhum atendimento concluído ainda hoje."
                    : "Nada por aqui."}
                </li>
              )}
              {lista.map((a, i) => {
                const p = porId.get(a.profId);
                if (!p) return null;
                const atendendo = a.status === "em-atendimento";
                return (
                  <React.Fragment key={a.id}>
                    {i === iAgora && (
                      <li className="agenda__agora">
                        <span>agora</span>
                      </li>
                    )}
                    <li
                      className={`agenda__row ${atendendo ? "is-active" : ""} ${
                        a.status === "concluido" ? "is-done" : ""
                      } ${a.status === "cancelado" ? "is-cancelado" : ""}`}
                    >
                      <span
                        className="agenda__bar"
                        style={{
                          background: p.color,
                          boxShadow: atendendo ? `0 0 12px ${p.color}88` : "none",
                        }}
                      />
                      <div className="agenda__time">
                        <span className="agenda__hora">{a.hora}</span>
                        <span className="agenda__dur">{a.duracao}min</span>
                      </div>
                      <div className="agenda__client">
                        <span className="agenda__name">{a.cliente}</span>
                        <span className="agenda__phone">{a.telefone}</span>
                      </div>
                      <div className="agenda__prof">
                        <span
                          className="agenda__profdot"
                          style={{ background: p.color }}
                        />
                        <span className="agenda__profname">{p.short}</span>
                      </div>
                      <div className="agenda__meta">
                        <StatusPill status={a.status} />
                      </div>
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
              {profs.map((p) => (
                <li key={p.id} className="firstfree__row">
                  <span
                    className="firstfree__dot"
                    style={{ background: p.color }}
                  />
                  <span className="firstfree__name">{p.short}</span>
                  <span className="firstfree__slots">
                    {proximosLivres(p, vm.agora, vm.vagas[p.id]?.[1]).map(
                      (h, i) => (
                        <span
                          key={h}
                          className={`firstfree__when${i > 0 ? " is-segundo" : ""}`}
                        >
                          {h}
                        </span>
                      ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Disponibilidade em pé libera a largura que o relógio precisa. A
              coluna dela é `auto` (cabe dia + barbeiros e não cresce mais que
              isso); toda a sobra vai para o mostrador. */}
          <div className="db-duo">
            <Panel title="Disponibilidade" padding="p-4">
              <DispoList
                profs={profs}
                dias={vm.dias}
                vagas={vm.vagas}
                comCapacidade
                larguraCol={84}
                colDia="76px"
              />
            </Panel>

            <Panel title="O dia" meta={statusDoDia(vm)} padding="p-4">
              <RelogioDoDia vm={vm} profs={profs} />
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardDesktop;
