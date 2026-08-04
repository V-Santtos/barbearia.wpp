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
import { hhmm, type DashboardVm, type ProfVm } from "./modelo";

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

  const anguloDaHora = (t: number) =>
    ((t - janelaDia.ini) / (janelaDia.fim - janelaDia.ini)) * 360 - 90;

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

  const horas: number[] = [];
  for (let h = Math.ceil(janelaDia.ini); h < janelaDia.fim; h++) horas.push(h);

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
          viewBox={`0 0 ${S} ${S}`}
          role="img"
          aria-label={`Horários livres de hoje, agora ${hhmm(agora)}. ${resumo}`}
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
            const rotulado = h % 3 === 2;
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

          {/* O ponteiro do agora. É ele que faz a peça ser lida como relógio na
              primeira olhada, e separa o buraco que ainda dá para encher do que
              já passou. */}
          {agora > janelaDia.ini &&
            agora < janelaDia.fim &&
            (() => {
              const a = anguloDaHora(agora);
              const [x0, y0] = pontoNoAnel(
                c,
                raio(profs.length - 1) - espessura / 2 - 6,
                a,
              );
              const [x1, y1] = pontoNoAnel(c, rBorda + 4, a);
              return (
                <g>
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
        {/* Quatro tratamentos no anel e nenhum cabe escrito por dentro — ao
            contrário da Disponibilidade, onde `folga` e `bloqueio` couberam na
            célula e a legenda pôde sair. Aqui ela se paga. */}
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
          <span>
            <i className="relo__sw relo__sw--fora" />
            fora do expediente
          </span>
        </div>
      </div>
    </div>
  );
};

export default RelogioDoDia;
