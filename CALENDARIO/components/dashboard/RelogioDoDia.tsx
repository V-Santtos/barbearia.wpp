/**
 * O dia desenhado como relógio.
 *
 * Um dia É um círculo, e desenhado assim ele mostra o que a lista esconde: o
 * FORMATO do dia. "6 horários livres" é o mesmo número quando as vagas estão
 * espalhadas pelo meio da tarde e quando estão empilhadas depois das 18h — e as
 * duas situações pedem coisas opostas do dono.
 *
 * Anéis concêntricos, um por barbeiro. Dois mostradores lado a lado não caberiam
 * na coluna, e mesmo se coubessem seriam piores: concêntrico alinha o mesmo
 * horário no mesmo raio, então dois vãos alinhados = os dois livres na mesma
 * hora, que é buraco da barbearia inteira e não de uma cadeira. O anel de dentro
 * tem arco mais curto em pixels, mas o mesmo ÂNGULO — e num mostrador se lê
 * posição e abertura, nunca comprimento.
 */
import React from "react";
import { hhmm, statusDoDia, type DashboardVm, type ProfVm } from "./modelo";

/* Vão da costura, em graus: onde o fim do dia encosta no começo (a lateral
   esquerda do anel). Sem ele, `t=janelaDia.fim` e `t=janelaDia.ini` caem no MESMO ponto
   -- a volta fecha em círculo contínuo e sugere ciclo, quando na verdade é
   uma linha enrolada. A emenda fica longe das 12h para o mostrador seguir a
   orientação natural de um relógio. */
const CORTE_DEG = 3;

/* Sobra à esquerda do mostrador, em unidades do `viewBox`. A abertura e o
   fechamento dividem a emenda lateral e precisam caber fora do anel sem
   apertar nem cobrir os arcos. */
const FOLGA_ESQUERDA = 44;

const RAD = Math.PI / 180;

const pontoNoAnel = (c: number, r: number, a: number): [number, number] => [
  c + r * Math.cos(a * RAD),
  c + r * Math.sin(a * RAD),
];

interface Props {
  vm: DashboardVm;
  profs: ProfVm[];
}

export const RelogioDoDia: React.FC<Props> = ({ vm, profs }) => {
  if (!profs.length) return null;

  const { janelaDia, agora } = vm;
  const sozinho = profs.length === 1;

  const S = 288;
  const c = S / 2;
  const espessura = sozinho ? 30 : 22;
  const rExterno = S * 0.355;
  const raio = (i: number) => rExterno - i * (espessura + 6);
  const rBorda = rExterno + espessura / 2;
  const margem = 0.03; // respiro entre slots vizinhos

  const duracaoDia = janelaDia.fim - janelaDia.ini;

  // 360 - CORTE_DEG, não 360: a volta inteira (abertura -> fechamento) some
  // um pouco menos que o círculo cheio, deixando o vão da costura. Meio-dia é
  // a referência visual e cai exatamente no topo, como num relógio conhecido;
  // com a janela atual de 12h, 15h vai à direita, 18h embaixo e 9h à esquerda.
  const anguloDaHora = (t: number) =>
    ((t - 12) / duracaoDia) * (360 - CORTE_DEG) - 90;

  // A abertura vem logo depois da costura no sentido horário. Voltar metade
  // do vão encontra o eixo visual que separa começo e fim do expediente.
  const anguloDaCostura = anguloDaHora(janelaDia.ini) - CORTE_DEG / 2;

  const arcoDaFaixa = (r: number, t0: number, t1: number) => {
    const a0 = anguloDaHora(t0);
    let a1 = anguloDaHora(t1);
    // Volta fechada não desenha com `A` — o ponto final cai em cima do inicial e
    // o navegador não sabe para que lado ir.
    if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
    const [x0, y0] = pontoNoAnel(c, r, a0);
    const [x1, y1] = pontoNoAnel(c, r, a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${
      a1 - a0 > 180 ? 1 : 0
    } 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  // O MESMO número que o KPI "Horários livres" mostra, pela mesma conta — as
  // duas leituras saem de `livres`, que veio pronto do servidor. O card diz
  // quantos; o anel diz onde.
  const total = profs.reduce((s, p) => s + p.livres.length, 0);

  // Rótulo do meio a cada N horas, nunca de `h % 3` (que só acertava por
  // coincidência de a barbearia abrir às 8h) -- N escala com a duração pra o
  // mostrador nunca passar de ~6 rótulos. Abertura e fechamento são âncoras
  // à parte, sempre rotuladas, mesmo quando não caem em hora cheia.
  const passoRotulo = Math.max(2, Math.round(duracaoDia / 5));

  const horas: number[] = [];
  for (let h = Math.ceil(janelaDia.ini); h < janelaDia.fim; h++) {
    if (h === janelaDia.ini) continue; // a âncora "abre" cobre esta posição
    horas.push(h);
  }

  const resumo = profs
    .map(
      (p) =>
        `${p.short}: ${p.livres.map(hhmm).join(", ") || "sem vaga"}`,
    )
    .join(". ");

  return (
    <div className="relo">
      {/* O palco existe para o mostrador ser limitado pela ALTURA. O SVG tem
          `viewBox`, então o navegador deriva altura da largura e ele estourava o
          card, empurrando o rodapé para fora. */}
      <div className="relo__palco">
        <svg
          className="relo__dial"
          viewBox={`${-FOLGA_ESQUERDA} 0 ${S + FOLGA_ESQUERDA} ${S}`}
          role="img"
          aria-label={`Horários livres de hoje, ${statusDoDia(vm)}. ${resumo}`}
        >
          {profs.map((prof, i) => {
            const r = raio(i);
            const livres = new Set(prof.livres);

            return (
              <g key={prof.id}>
                {/* O dia inteiro existe para todo mundo; o que muda é quanto
                    dele cada um trabalha. Quem fecha mais cedo deixa trilho, não
                    buraco — ausência de expediente não é vaga. */}
                <path
                  className="relo__fora"
                  strokeWidth={espessura}
                  d={arcoDaFaixa(r, janelaDia.ini, janelaDia.fim)}
                />
                <path
                  className="relo__vago"
                  strokeWidth={espessura}
                  d={arcoDaFaixa(r, prof.expediente.inicio, prof.expediente.fim)}
                />

                {/* Intervalo com símbolo próprio. Apagar não serve: apagado já é
                    "fora do expediente", e os dois significam coisas diferentes. */}
                {prof.intervalo && (
                  <>
                    <path
                      className="relo__fora"
                      strokeWidth={espessura}
                      d={arcoDaFaixa(r, prof.intervalo.ini, prof.intervalo.fim)}
                    />
                    <path
                      className="relo__inter"
                      strokeWidth={espessura * 0.3}
                      d={arcoDaFaixa(r, prof.intervalo.ini, prof.intervalo.fim)}
                    />
                  </>
                )}

                {prof.slots.map((s) =>
                  livres.has(s.ini) ? (
                    // Vaga: fio de aviso. É o assunto do painel, não a falta dele.
                    <path
                      key={s.ini}
                      className="relo__livre"
                      strokeWidth={espessura * 0.26}
                      d={arcoDaFaixa(r, s.ini + margem, s.fim - margem)}
                    />
                  ) : (
                    // Ocupado na cor de identidade, a mesma da agenda e da
                    // disponibilidade. O que já passou NÃO apaga: opacidade não
                    // comunica estado nesta tela.
                    <path
                      key={s.ini}
                      stroke={prof.color}
                      strokeWidth={espessura}
                      fill="none"
                      d={arcoDaFaixa(r, s.ini + margem, s.fim - margem)}
                    />
                  ),
                )}
              </g>
            );
          })}

          {horas.map((h) => {
            const a = anguloDaHora(h);
            const rotulado = h % passoRotulo === 0;
            const [x0, y0] = pontoNoAnel(c, rBorda + 4, a);
            const [x1, y1] = pontoNoAnel(c, rBorda + (rotulado ? 9 : 6), a);
            const [lx, ly] = pontoNoAnel(c, rBorda + 20, a);
            return (
              <g key={h}>
                <path className="relo__tick" d={`M ${x0} ${y0} L ${x1} ${y1}`} />
                {rotulado && (
                  <text className="relo__hora" x={lx} y={ly + 3.5}>
                    {h}h
                  </text>
                )}
              </g>
            );
          })}

          {/* Costura: o traço mais forte exatamente no meio do vão de
              CORTE_DEG. Fica à esquerda; 12h permanece livre no topo. */}
          {(() => {
            const [x0, y0] = pontoNoAnel(
              c,
              raio(profs.length - 1) - espessura / 2 - 4,
              anguloDaCostura,
            );
            const [x1, y1] = pontoNoAnel(c, rBorda + 9, anguloDaCostura);
            return <path className="relo__costura" d={`M ${x0} ${y0} L ${x1} ${y1}`} />;
          })()}

          {/* Âncoras: abertura e fechamento, sempre rotuladas (mesmo fora de
              hora cheia), com peso maior e a palavra que diz o que aquele
              ponto é -- sem isso as duas pontas do expediente parecem apenas
              mais dois horários do mostrador. */}
          {/* Os dois rótulos ficam a apenas `CORTE_DEG` um do outro. Na emenda
              lateral, abertura sobe e fechamento desce; assim continuam ligados
              ao mesmo eixo sem se sobrepor. O `text-anchor` vem das classes CSS,
              porque a regra de `.relo__hora` venceria o atributo do SVG. */}
          {(
            [
              { hora: janelaDia.ini, palavra: "abre", deslocamentoY: -10 },
              { hora: janelaDia.fim, palavra: "fecha", deslocamentoY: 16 },
            ] as const
          ).map(({ hora, palavra, deslocamentoY }) => {
            const a = anguloDaHora(hora);
            const [x0, y0] = pontoNoAnel(c, rBorda + 4, a);
            const [x1, y1] = pontoNoAnel(c, rBorda + 9, a);
            return (
              <g key={palavra}>
                <path className="relo__tick relo__tick--ancora" d={`M ${x0} ${y0} L ${x1} ${y1}`} />
                <text
                  className={`relo__hora relo__hora--ancora relo__hora--${palavra}`}
                  x={c - rBorda - 11}
                  y={c + deslocamentoY}
                >
                  {hhmm(hora)}
                  <tspan className="relo__hora-palavra" dx="3">{palavra}</tspan>
                </text>
              </g>
            );
          })}

          {/* O ponteiro do agora. É ele que faz a peça ser lida como relógio na
              primeira olhada, e separa o buraco que ainda dá para encher do que
              já passou. Fora do expediente ele não some mais -- encosta na
              ponta correspondente, esmaecido, e o cabeçalho (statusDoDia) é
              quem passa a explicar o estado ("fechado desde ..."). */}
          {(() => {
            const dentro = agora > janelaDia.ini && agora < janelaDia.fim;
            const alvo = dentro ? agora : agora <= janelaDia.ini ? janelaDia.ini : janelaDia.fim;
            const a = anguloDaHora(alvo);
            const [x0, y0] = pontoNoAnel(
              c,
              raio(profs.length - 1) - espessura / 2 - 6,
              a,
            );
            const [x1, y1] = pontoNoAnel(c, rBorda + 4, a);
            return (
              <g className={dentro ? undefined : "relo__agora--fora"}>
                <path
                  className="relo__agora"
                  d={`M ${x0} ${y0} L ${x1} ${y1}`}
                />
                <circle className="relo__agora-bola" cx={x1} cy={y1} r={2.6} />
              </g>
            );
          })()}

          {sozinho && (
            <text className="relo__quem" x={c} y={c - 26}>
              {profs[0].short}
            </text>
          )}
          <text className="relo__total" x={c} y={c + (sozinho ? 12 : 6)}>
            {total}
          </text>
          <text className="relo__unid" x={c} y={c + (sozinho ? 32 : 26)}>
            {total === 1 ? "horário livre" : "horários livres"}
          </text>

          {/* UMA hora escrita, a do próximo encaixe, e só com um barbeiro em
              cena. Escrever todas quebrou no primeiro teste com cinco: 18:30,
              19:15 e 08:00 caem quase no mesmo ponto — a volta é 08:00→20:00,
              então o fim do dia encosta no começo. */}
          {sozinho &&
            (() => {
              const alvo = profs[0].livres
                .filter((ini) => ini >= agora)
                .sort((a, b) => a - b)[0];
              if (alvo === undefined) return null;
              const slot = profs[0].slots.find((s) => s.ini === alvo);
              if (!slot) return null;
              const [x, y] = pontoNoAnel(
                c,
                raio(0) - espessura * 0.95,
                anguloDaHora((slot.ini + slot.fim) / 2),
              );
              return (
                <text className="relo__vaga-hora" x={x} y={y + 3.5}>
                  {hhmm(slot.ini)}
                </text>
              );
            })()}
        </svg>
      </div>

      <div className="relo__rodape">
        <div className="relo__ident">
          {profs.map((p) => (
            <span key={p.id}>
              <span className="relo__dot" style={{ background: p.color }} />
              {p.short} · <b>{p.livres.length}</b>{" "}
              {p.livres.length === 1 ? "vaga" : "vagas"}
            </span>
          ))}
        </div>
        {/* Três tratamentos, não mais quatro: "fora do expediente" saiu da
            legenda (Frente 2) -- com a costura marcando a emenda e as âncoras
            abre/fecha nomeando as pontas, a faixa apagada já se explica pela
            posição, sem precisar de entrada própria. */}
        <div className="relo__chave">
          <span>
            <i
              className="relo__sw"
              style={
                profs.length === 1
                  ? { background: profs[0].color }
                  : {
                      background: `linear-gradient(90deg, ${profs
                        .map(
                          (p, i) =>
                            `${p.color} ${(i / profs.length) * 100}% ${
                              ((i + 1) / profs.length) * 100
                            }%`,
                        )
                        .join(", ")})`,
                    }
              }
            />
            ocupado
          </span>
          <span>
            <i className="relo__sw relo__sw--livre" />
            livre
          </span>
          <span>
            <i className="relo__sw relo__sw--inter" />
            intervalo
          </span>
        </div>
      </div>
    </div>
  );
};

export default RelogioDoDia;
