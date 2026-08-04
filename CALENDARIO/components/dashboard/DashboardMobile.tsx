/**
 * O dashboard no celular.
 *
 * Aqui NÃO é modal: é aba, tela cheia, como Agenda e Conversas. O dock já é a
 * navegação desta tela — pôr a navegação dentro de uma camada que se fecha seria
 * inventar duas formas de sair.
 *
 * O relógio do dia usa o MESMO `profs` filtrado do resto da tela — o filtro de
 * profissional no topo (`ProfFilter`, em `DashboardScreen`) já governa tudo
 * aqui embaixo, o anel incluso. Com "Todos profissionais" ele desenha os anéis
 * concêntricos, igual ao desktop; escolher um só profissional reduz a um anel.
 */
import React from "react";
import type { PeriodoDashboard } from "../../services/calendarApi";
import { KpiCard, Panel, PeriodChips } from "./primitivos";
import { DispoList } from "./Disponibilidade";
import { RelogioDoDia } from "./RelogioDoDia";
import { OPCOES_PERIODO, montarKpis } from "./kpis";
import { hhmm, proximosLivres, type DashboardVm } from "./modelo";
import type { FiltroProf } from "./primitivos";

interface Props {
  vm: DashboardVm;
  filtro: FiltroProf;
  periodo: PeriodoDashboard;
  onPeriodo: (p: PeriodoDashboard) => void;
  agregado: ReturnType<typeof montarKpis>;
  /** Leva de volta à agenda — o "Ver todos" precisa cumprir a promessa dele. */
  onVerAgenda: () => void;
}

export const DashboardMobile: React.FC<Props> = ({
  vm,
  filtro,
  periodo,
  onPeriodo,
  agregado,
  onVerAgenda,
}) => {
  const profs =
    filtro === "all" ? vm.profs : vm.profs.filter((p) => p.id === filtro);
  const porId = new Map(vm.profs.map((p) => [p.id, p]));
  const agenda =
    filtro === "all" ? vm.agenda : vm.agenda.filter((a) => a.profId === filtro);

  const proximos = agenda.filter((a) => a.status !== "concluido").slice(0, 5);
  const emAtendimento = agenda.filter((a) => a.status === "em-atendimento");

  return (
    <>
      <div className="mb-period">
        <PeriodChips
          value={periodo}
          onChange={onPeriodo}
          options={OPCOES_PERIODO}
        />
      </div>

      <div className="mb-kpis">
        {agregado.map((k) => (
          <KpiCard
            key={k.chave}
            compact
            label={k.chave === "marcacoes" ? "Marcações" : k.label}
            value={k.value}
            sub={k.sub}
            destaque={k.destaque}
          />
        ))}
      </div>

      {emAtendimento.length > 0 && (
        <div className="mb-now">
          <div className="mb-now__head">
            <span className="mb-now__pulse" />
            <span>Em atendimento agora · {emAtendimento.length}</span>
            <span className="mb-now__time">{hhmm(vm.agora)}</span>
          </div>
          <div className="mb-now__rows">
            {emAtendimento.map((a) => {
              const p = porId.get(a.profId);
              if (!p) return null;
              return (
                <div key={a.id} className="mb-now__row">
                  <span
                    className="mb-now__bar"
                    style={{ background: p.color }}
                  />
                  <span className="mb-now__cli">{a.cliente}</span>
                  <span className="mb-now__prof" style={{ color: p.color }}>
                    {p.short}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Panel
        title="Próximos atendimentos"
        subtitle={`${proximos.length} pendentes hoje`}
        padding="p-0"
      >
        <ul className="agenda agenda--compact">
          {proximos.length === 0 && (
            <li className="agenda__vazio">Nada pendente por hoje.</li>
          )}
          {proximos.map((a) => {
            const p = porId.get(a.profId);
            if (!p) return null;
            return (
              <li key={a.id} className="agenda__row">
                <span
                  className="agenda__bar"
                  style={{ background: p.color }}
                />
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
          {/* "Ver todos os N" caiu no primeiro teste com dado real: com uma
              linha só na agenda ele escrevia "Ver todos os 1". A frase sem
              número não tem plural para errar, e diz melhor para onde leva —
              o destino é a agenda, não uma lista maior aqui dentro. */}
          {agenda.length > 0 && (
            <li
              className="agenda__more"
              role="button"
              tabIndex={0}
              onClick={onVerAgenda}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onVerAgenda();
              }}
            >
              Ver o dia inteiro na agenda ›
            </li>
          )}
        </ul>
      </Panel>

      <Panel
        title="Próximos horários livres"
        subtitle="Os dois próximos encaixes de cada barbeiro"
      >
        <ul className="firstfree">
          {profs.map((p) => (
            <li key={p.id} className="firstfree__row">
              <span
                className="firstfree__dot"
                style={{ background: p.color }}
              />
              <span className="firstfree__name">{p.short}</span>
              <span className="firstfree__slots">
                {proximosLivres(p, vm.agora, vm.vagas[p.id]?.[1]).map((h, i) => (
                  <span
                    key={h}
                    className={`firstfree__when${i > 0 ? " is-segundo" : ""}`}
                  >
                    {h}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Disponibilidade"
        subtitle="Vagas livres · janela de cada barbeiro"
        padding="p-4"
      >
        <DispoList profs={profs} dias={vm.dias} vagas={vm.vagas} />
      </Panel>

      <Panel title="O dia" meta={`agora ${hhmm(vm.agora)}`} padding="p-4">
        <div style={{ height: 380 }}>
          <RelogioDoDia vm={vm} profs={profs} />
        </div>
      </Panel>

      {/* Respiro do dock: ele flutua POR CIMA da rolagem, então o último painel
          precisa de chão para não morrer embaixo dele. */}
      <div style={{ height: 104 }} />
    </>
  );
};

export default DashboardMobile;
