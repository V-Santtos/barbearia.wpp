/**
 * Uma linha por dia, uma coluna por barbeiro. O nome dele vive no CABEÇALHO da
 * coluna, uma vez — antes se repetia célula a célula: dois por linha, dez
 * linhas, vinte repetições para dizer a coisa menos variável da tela.
 *
 * Nasceu no celular, onde dez colunas não cabiam, e passou a valer também no
 * desktop: em pé o painel fica estreito e alto, e a largura que sobra na coluna
 * paga o relógio do dia ao lado.
 */
import React from "react";
import type { EstadoDoDia } from "../../services/calendarApi";
import {
  WD_LABEL,
  WD_LONGO,
  type DiaVm,
  type ProfVm,
} from "./modelo";

/**
 * Cada estado tem símbolo próprio, e nenhum é comunicado por opacidade — dia
 * lotado é informação, não ausência dela. O motivo de não dar é ESCRITO dentro
 * da célula, não escondido no `title`: tela de toque não tem hover, e no
 * desktop os três motivos desenhavam pixels idênticos lado a lado.
 */
const CelulaDispo: React.FC<{
  estado: EstadoDoDia;
  prof: ProfVm;
  hoje?: boolean;
}> = ({ estado, prof, hoje = false }) => {
  const cls = `dcell${hoje ? " is-today" : ""}`;

  if (estado.tipo === "fora") {
    return (
      <span
        className={`${cls} dcell--nao dcell--rot`}
        title={`Fora da janela de ${prof.short}`}
      >
        —
      </span>
    );
  }
  if (estado.tipo === "fechado") {
    return (
      <span
        className={`${cls} dcell--nao dcell--rot`}
        title={`${prof.short} não trabalha neste dia`}
      >
        folga
      </span>
    );
  }
  if (estado.tipo === "bloqueio") {
    return (
      <span
        className={`${cls} dcell--nao dcell--rot`}
        title={`${prof.short}: dia bloqueado`}
      >
        bloqueio
      </span>
    );
  }
  // Dia sem vaga é a melhor notícia do mês para o dono. O `0` em âmbar pintava
  // de alerta a vitória — e âmbar já significa "Reagendado" no painel colado.
  if (estado.tipo === "lotado") {
    return (
      <span className={`${cls} dcell--cheio`} title={`${prof.short}: sem vaga`}>
        cheio
      </span>
    );
  }
  return (
    <span
      className={`${cls} dcell--vagas`}
      title={`${prof.short}: ${estado.vagas} vaga${estado.vagas > 1 ? "s" : ""}`}
    >
      {estado.vagas}
    </span>
  );
};

interface Props {
  profs: ProfVm[];
  dias: DiaVm[];
  vagas: Record<number, EstadoDoDia[]>;
  /** Só no desktop: a coluna do celular tem 58px e não cabe "9 vagas/dia". */
  comCapacidade?: boolean;
  larguraCol?: number;
  /**
   * Fixo no desktop e `1fr` no celular. Com a coluna do dia elástica, a sobra de
   * largura do painel entra ali e joga o número para longe do rótulo. Fixa em
   * TODAS as linhas, nunca `auto` — cada linha é uma grade própria, e `auto`
   * daria trilhos diferentes para "Hoje 20" e "domingo 25".
   */
  colDia?: string;
}

export const DispoList: React.FC<Props> = ({
  profs,
  dias,
  vagas,
  comCapacidade = false,
  larguraCol = 58,
  colDia = "1fr",
}) => {
  if (!profs.length) return null;

  const janela = Math.max(...profs.map((p) => p.janela));
  const visiveis = dias.slice(0, janela);
  const cols: React.CSSProperties = {
    gridTemplateColumns: `${colDia} repeat(${profs.length}, ${larguraCol}px)`,
  };

  const estadoDe = (profId: number, i: number): EstadoDoDia =>
    vagas[profId]?.[i] ?? { tipo: "fora" };

  // Dia em que nenhum deles atende não merece linha de tamanho normal com duas
  // células vazias dentro: vira risco fino, que segura a sequência das datas sem
  // pesar como dia útil. O teste é por profissional EM CENA — filtrado num só, a
  // folga dele também vira risco.
  const ninguemAtende = (i: number) =>
    profs.every((p) => {
      const t = estadoDe(p.id, i).tipo;
      return t === "fechado" || t === "fora";
    });

  return (
    <div className="dlist">
      <div className="dlist__head" style={cols}>
        <span />
        {profs.map((p) => (
          <span key={p.id} className="dlist__prof">
            <span className="dlist__profname">
              <span className="dlist__dot" style={{ background: p.color }} />
              {p.short.split(" ")[1] ?? p.short}
            </span>
            {comCapacidade && (
              <span className="dlist__cap">{p.capacidade} vagas/dia</span>
            )}
          </span>
        ))}
      </div>

      {visiveis.map((d, i) =>
        ninguemAtende(i) ? (
          <div key={d.data} className="dlist__fechado">
            {WD_LONGO[d.wd]} {d.dd}
          </div>
        ) : (
          <div
            key={d.data}
            className={`dlist__row${d.hoje ? " is-today" : ""}`}
            style={cols}
          >
            <span className="dlist__day">
              <b>{d.hoje ? "Hoje" : WD_LABEL[d.wd]}</b> {d.dd}
            </span>
            {profs.map((p) => (
              <CelulaDispo
                key={p.id}
                estado={estadoDe(p.id, i)}
                prof={p}
                hoje={d.hoje}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
};

export default DispoList;
