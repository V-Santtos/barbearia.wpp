import { useState } from "react";

export interface PontoFluxo {
  chave: string;
  rotulo: string;
  /** Ponto de um dia só: a lista escreve o dia da semana ("sáb 26 set"). */
  diario?: boolean;
  faturamento: number;
  entradasManuais?: number;
  saidas: number;
  resultado?: number;
}

export interface ItemComposicao {
  nome: string;
  valor: number;
  quantidade?: number;
  percentual: number;
}

const CORES_SERVICOS = ["#7772fb", "#9a96fc", "#c1befd", "#e5e4ff", "#6b7280"];

const moedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CENTRO_ROSCA = 75;
const RAIO_EXTERNO_ROSCA = 66;
const RAIO_INTERNO_ROSCA = 47;

function caminhoBarra(
  x: number,
  y: number,
  largura: number,
  altura: number,
  direcao: "cima" | "baixo",
) {
  const raio = Math.min(5, largura / 2, altura / 2);
  const direita = x + largura;
  const base = y + altura;

  if (direcao === "cima") {
    return [
      `M ${x} ${base}`,
      `V ${y + raio}`,
      `Q ${x} ${y} ${x + raio} ${y}`,
      `H ${direita - raio}`,
      `Q ${direita} ${y} ${direita} ${y + raio}`,
      `V ${base}`,
      "Z",
    ].join(" ");
  }

  return [
    `M ${x} ${y}`,
    `V ${base - raio}`,
    `Q ${x} ${base} ${x + raio} ${base}`,
    `H ${direita - raio}`,
    `Q ${direita} ${base} ${direita} ${base - raio}`,
    `V ${y}`,
    "Z",
  ].join(" ");
}

function pontoPolar(raio: number, angulo: number) {
  const radianos = ((angulo - 90) * Math.PI) / 180;
  return {
    x: CENTRO_ROSCA + raio * Math.cos(radianos),
    y: CENTRO_ROSCA + raio * Math.sin(radianos),
  };
}

/**
 * Setor anular com quatro cantos arredondados. Um `conic-gradient` separa as
 * cores, mas sempre termina cada fatia em uma aresta reta; o SVG permite que o
 * respiro entre categorias seja parte real da geometria.
 */
function arcoArredondado(inicio: number, fim: number) {
  const abertura = fim - inicio;
  const aberturaRad = (abertura * Math.PI) / 180;
  const canto = Math.min(4.5, (aberturaRad * RAIO_INTERNO_ROSCA) / 2.4);
  const recuoExterno = (canto / RAIO_EXTERNO_ROSCA) * (180 / Math.PI);
  const recuoInterno = (canto / RAIO_INTERNO_ROSCA) * (180 / Math.PI);
  const arcoLongo = abertura - recuoExterno * 2 > 180 ? 1 : 0;

  const externoInicio = pontoPolar(RAIO_EXTERNO_ROSCA, inicio + recuoExterno);
  const externoFim = pontoPolar(RAIO_EXTERNO_ROSCA, fim - recuoExterno);
  const cantoExternoFim = pontoPolar(RAIO_EXTERNO_ROSCA, fim);
  const faceExternaFim = pontoPolar(RAIO_EXTERNO_ROSCA - canto, fim);
  const faceInternaFim = pontoPolar(RAIO_INTERNO_ROSCA + canto, fim);
  const cantoInternoFim = pontoPolar(RAIO_INTERNO_ROSCA, fim);
  const internoFim = pontoPolar(RAIO_INTERNO_ROSCA, fim - recuoInterno);
  const internoInicio = pontoPolar(RAIO_INTERNO_ROSCA, inicio + recuoInterno);
  const cantoInternoInicio = pontoPolar(RAIO_INTERNO_ROSCA, inicio);
  const faceInternaInicio = pontoPolar(RAIO_INTERNO_ROSCA + canto, inicio);
  const faceExternaInicio = pontoPolar(RAIO_EXTERNO_ROSCA - canto, inicio);
  const cantoExternoInicio = pontoPolar(RAIO_EXTERNO_ROSCA, inicio);

  return [
    `M ${externoInicio.x} ${externoInicio.y}`,
    `A ${RAIO_EXTERNO_ROSCA} ${RAIO_EXTERNO_ROSCA} 0 ${arcoLongo} 1 ${externoFim.x} ${externoFim.y}`,
    `Q ${cantoExternoFim.x} ${cantoExternoFim.y} ${faceExternaFim.x} ${faceExternaFim.y}`,
    `L ${faceInternaFim.x} ${faceInternaFim.y}`,
    `Q ${cantoInternoFim.x} ${cantoInternoFim.y} ${internoFim.x} ${internoFim.y}`,
    `A ${RAIO_INTERNO_ROSCA} ${RAIO_INTERNO_ROSCA} 0 ${arcoLongo} 0 ${internoInicio.x} ${internoInicio.y}`,
    `Q ${cantoInternoInicio.x} ${cantoInternoInicio.y} ${faceInternaInicio.x} ${faceInternaInicio.y}`,
    `L ${faceExternaInicio.x} ${faceExternaInicio.y}`,
    `Q ${cantoExternoInicio.x} ${cantoExternoInicio.y} ${externoInicio.x} ${externoInicio.y}`,
    "Z",
  ].join(" ");
}

export function GraficoFluxo({ dados }: { dados: PontoFluxo[] }) {
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  const largura = 860;
  const altura = 250;
  const esquerda = 38;
  const direita = 16;
  const topo = 18;
  const base = 116;
  const fundo = 214;
  const larguraUtil = largura - esquerda - direita;
  const maior = Math.max(
    1,
    ...dados.flatMap((ponto) => [ponto.faturamento, ponto.saidas]),
  );
  const passo = dados.length ? larguraUtil / dados.length : larguraUtil;
  const larguraBarra = Math.max(8, Math.min(46, passo * 0.78));
  const amplitude = Math.min(base - topo - 10, fundo - base - 10);
  const escala = amplitude / maior;
  const saltoRotulo = Math.max(1, Math.ceil(dados.length / 8));
  const pontoAtivo = indiceAtivo === null ? null : dados[indiceAtivo] ?? null;
  const centroAtivo = indiceAtivo === null
    ? 0
    : esquerda + passo * indiceAtivo + passo / 2;
  const ladoTooltip = centroAtivo > largura / 2 ? "is-left" : "is-right";

  if (!dados.length) {
    return (
      <div className="fin-grafico-vazio">
        Não há movimentações suficientes para desenhar este período.
      </div>
    );
  }

  return (
    <div className={`fin-fluxo${pontoAtivo ? " fin-fluxo--ativo" : ""}`}>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        preserveAspectRatio="none"
      >
        <desc>Faturamento acima da linha central e saídas abaixo dela</desc>
        {[topo, (topo + base) / 2, base, (base + fundo) / 2, fundo].map((y) => (
          <line
            key={y}
            x1={esquerda}
            x2={largura - direita}
            y1={y}
            y2={y}
            className={y === base ? "fin-fluxo__eixo" : "fin-fluxo__grade"}
          />
        ))}
        <text x="0" y={topo + 4} className="fin-fluxo__escala">
          {moedaCompacta.format(maior)}
        </text>
        <text x="21" y={base + 4} className="fin-fluxo__escala">
          0
        </text>
        <text x="0" y={fundo + 4} className="fin-fluxo__escala">
          −{moedaCompacta.format(maior)}
        </text>

        {pontoAtivo && (
          <rect
            x={centroAtivo - passo / 2 + 2}
            y={topo - 7}
            width={Math.max(0, passo - 4)}
            height={fundo - topo + 14}
            rx="8"
            className="fin-fluxo__faixa"
          />
        )}

        {dados.map((ponto, indice) => {
          const centro = esquerda + passo * indice + passo / 2;
          const alturaEntrada = ponto.faturamento * escala;
          const alturaSaida = ponto.saidas * escala;
          const resultado = ponto.resultado ?? ponto.faturamento - ponto.saidas;
          const ativo = indiceAtivo === indice;
          return (
            <g
              key={ponto.chave}
              className={`fin-fluxo__grupo${ativo ? " is-active" : ""}`}
              role="img"
              tabIndex={0}
              aria-label={`${ponto.rotulo}. Faturamento ${moeda.format(ponto.faturamento)}. Entradas manuais ${moeda.format(ponto.entradasManuais ?? 0)}. Saídas ${moeda.format(ponto.saidas)}. Resultado ${moeda.format(resultado)}.`}
              onPointerEnter={() => setIndiceAtivo(indice)}
              onPointerLeave={() => setIndiceAtivo(null)}
              onFocus={() => setIndiceAtivo(indice)}
              onBlur={() => setIndiceAtivo(null)}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") {
                  setIndiceAtivo(null);
                  evento.currentTarget.blur();
                }
              }}
            >
              {ponto.faturamento > 0 && (
                <path
                  d={caminhoBarra(
                    centro - larguraBarra / 2,
                    base - alturaEntrada,
                    larguraBarra,
                    alturaEntrada,
                    "cima",
                  )}
                  className="fin-fluxo__barra fin-fluxo__entrada"
                />
              )}
              {ponto.saidas > 0 && (
                <path
                  d={caminhoBarra(
                    centro - larguraBarra / 2,
                    base,
                    larguraBarra,
                    alturaSaida,
                    "baixo",
                  )}
                  className="fin-fluxo__barra fin-fluxo__saida"
                />
              )}
              {(indice % saltoRotulo === 0 || indice === dados.length - 1) && (
                <text x={centro} y="240" textAnchor="middle" className="fin-fluxo__rotulo">
                  {ponto.rotulo}
                </text>
              )}
              <rect
                x={centro - passo / 2}
                y={topo - 7}
                width={passo}
                height={fundo - topo + 28}
                className="fin-fluxo__hitbox"
              />
            </g>
          );
        })}
      </svg>

      {pontoAtivo && (
        <div
          className={`fin-fluxo__tooltip ${ladoTooltip}`}
          role="tooltip"
        >
          <strong>{pontoAtivo.rotulo}</strong>
          <div className="fin-fluxo__tooltip-linha">
            <i className="fin-fluxo__tooltip-cor fin-fluxo__tooltip-cor--entrada" />
            <span>Faturamento</span>
            <b>{moeda.format(pontoAtivo.faturamento)}</b>
          </div>
          <div className="fin-fluxo__tooltip-linha">
            <i className="fin-fluxo__tooltip-cor fin-fluxo__tooltip-cor--saida" />
            <span>Saídas</span>
            <b>{moeda.format(pontoAtivo.saidas)}</b>
          </div>
          {Boolean(pontoAtivo.entradasManuais) && (
            <div className="fin-fluxo__tooltip-linha">
              <span>Entradas manuais (no faturamento)</span>
              <b>{moeda.format(pontoAtivo.entradasManuais ?? 0)}</b>
            </div>
          )}
          <div className="fin-fluxo__tooltip-resultado">
            <span>Resultado</span>
            <b className={(pontoAtivo.resultado ?? pontoAtivo.faturamento - pontoAtivo.saidas) < 0 ? "is-negative" : ""}>
              {moeda.format(pontoAtivo.resultado ?? pontoAtivo.faturamento - pontoAtivo.saidas)}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComposicaoServicos({ dados }: { dados: ItemComposicao[] }) {
  const total = dados.reduce((soma, item) => soma + item.valor, 0);
  const totalFormatado = moedaCompacta.format(total);
  const totalAtendimentos = dados.reduce(
    (soma, item) => soma + (item.quantidade ?? 0),
    0,
  );
  let cursor = 0;
  const segmentos = dados.map((item, indice) => {
    const abertura = (item.valor / total) * 360;
    const respiro = Math.min(5, abertura * 0.22);
    const inicio = cursor + respiro / 2;
    const fim = cursor + abertura - respiro / 2;
    cursor += abertura;
    return {
      ...item,
      cor: CORES_SERVICOS[indice % CORES_SERVICOS.length],
      caminho: arcoArredondado(inicio, fim),
    };
  });

  if (!dados.length) {
    return <div className="fin-grafico-vazio">Nenhum serviço concluído no período.</div>;
  }

  return (
    <div className="fin-composicao">
      <div className="fin-rosca" aria-hidden="true">
        <svg className="fin-rosca__svg" viewBox="0 0 150 150">
          {segmentos.map((segmento) => (
            <path
              key={segmento.nome}
              d={segmento.caminho}
              fill={segmento.cor}
            />
          ))}
        </svg>
        <div className="fin-rosca__miolo">
          <strong className={totalFormatado.length > 10 ? "is-compact" : undefined}>
            {totalFormatado}
          </strong>
          <span>{totalAtendimentos} atendimentos</span>
        </div>
      </div>

      <div className="fin-ranking" aria-label="Ranking de serviços">
        {dados.map((item, indice) => (
          <div className="fin-ranking__item" key={item.nome}>
            <div className="fin-ranking__linha">
              <span
                className="fin-ranking__cor"
                style={{ background: CORES_SERVICOS[indice % CORES_SERVICOS.length] }}
              />
              <span className="fin-ranking__nome">{item.nome}</span>
              <span className="fin-ranking__quantidade">
                {item.quantidade ?? 0} atend.
              </span>
              <strong>{moeda.format(item.valor)}</strong>
            </div>
            <div className="fin-ranking__trilho">
              <span
                style={{
                  width: `${Math.max(2, item.percentual)}%`,
                  background: CORES_SERVICOS[indice % CORES_SERVICOS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const formatadorDiaSemana = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "sáb., 26 de set." -> "sáb 26 set": o dia da semana é o que importa em 7 dias. */
function rotuloDoDia(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return formatadorDiaSemana
    .format(new Date(ano, mes - 1, dia))
    .replace(/\./g, "")
    .replace(/,?\s+de\s+/g, " ")
    .replace(",", "");
}

/**
 * Faturamento e saídas no celular e no tablet (2026-09-26, com o dono).
 *
 * O gráfico vertical (`GraficoFluxo`) só entrega o valor no hover, e com 31
 * dias em 300px as colunas tinham 8px -- não dava para ler nem para tocar.
 * Aqui cada período é uma linha com os dois valores ESCRITOS, então não há
 * nada a tocar para ler. Barra roxa e salmão numa escala só (o maior valor da
 * lista), do mais recente para o mais antigo. Quem escolhe o agrupamento (dia,
 * semana, mês) é a tela, não esta lista.
 */
export function ListaFluxo({ dados }: { dados: PontoFluxo[] }) {
  const maior = Math.max(1, ...dados.flatMap((p) => [p.faturamento, p.saidas]));
  const linhas = [...dados].reverse();

  return (
    <ul className="fin-lista-fluxo">
      {linhas.map((ponto) => (
        <li
          key={ponto.chave}
          className="fin-lista-fluxo__item"
          aria-label={`${ponto.rotulo}: faturamento ${moeda.format(ponto.faturamento)}, saídas ${moeda.format(ponto.saidas)}`}
        >
          <span className="fin-lista-fluxo__rotulo" aria-hidden="true">
            {ponto.diario ? rotuloDoDia(ponto.chave) : ponto.rotulo}
          </span>
          <span className="fin-lista-fluxo__trilho" aria-hidden="true">
            <span
              className="fin-lista-fluxo__barra fin-lista-fluxo__barra--entrada"
              style={{ width: `${(ponto.faturamento / maior) * 100}%` }}
            />
          </span>
          <strong aria-hidden="true">{moeda.format(ponto.faturamento)}</strong>
          <span className="fin-lista-fluxo__trilho" aria-hidden="true">
            <span
              className="fin-lista-fluxo__barra fin-lista-fluxo__barra--saida"
              style={{ width: `${(ponto.saidas / maior) * 100}%` }}
            />
          </span>
          <span className="fin-lista-fluxo__saida" aria-hidden="true">
            {ponto.saidas ? `− ${moeda.format(ponto.saidas)}` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DespesasPorCategoria({ dados }: { dados: ItemComposicao[] }) {
  const maior = Math.max(1, ...dados.map((item) => item.valor));

  if (!dados.length) {
    return <div className="fin-grafico-vazio">Nenhuma saída cadastrada no período.</div>;
  }

  return (
    <div className="fin-despesas-lista">
      {dados.map((item) => (
        <div className="fin-despesas-lista__item" key={item.nome}>
          <div className="fin-despesas-lista__linha">
            <span>{item.nome}</span>
            <span>{item.percentual.toFixed(0)}%</span>
            <strong>{moeda.format(item.valor)}</strong>
          </div>
          <div className="fin-despesas-lista__trilho">
            <span style={{ width: `${(item.valor / maior) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
