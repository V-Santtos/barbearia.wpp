import type { Event } from "../types";

/* Quem ocupa a mesma faixa de horario divide a largura da coluna — e a divisao
   so faz sentido se todos os envolvidos chegarem ao MESMO denominador.

   Duas formas erradas de fazer isso ja moraram neste projeto:

   - Perguntar a cada evento quantos vizinhos ele tem. A colide com B, B colide
     com C, mas A nao colide com C: A ve 2, B ve 3, C ve 2. Tres larguras
     diferentes para o mesmo espaco, e blocos passando por cima uns dos outros.
   - Usar o maior numero de colisoes do DIA INTEIRO como denominador (o que o
     `DayView` fazia). Basta um par sobreposto as 15h para todos os blocos do
     dia virarem meia largura, inclusive os que estao sozinhos as 09h.

   Aqui o grupo — a cadeia de eventos que se tocam — e descoberto antes de
   qualquer conta de largura, e e o grupo que responde "somos quantas
   colunas". */

export interface EventoPosicionado {
  evento: Event;
  coluna: number;
  colunasDoGrupo: number;
}

const emMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface OpcoesDeDisposicao {
  /* Um bloco tem altura minima de desenho, entao um atendimento curto OCUPA
     mais tempo na tela do que no relogio. Medindo a colisao pela extensao
     visivel, a garantia de que nada cobre nada vale para o que o olho ve. */
  duracaoVisualMinima?: number;
}

export function disporDia(
  eventos: Event[],
  opcoes: OpcoesDeDisposicao = {}
): EventoPosicionado[] {
  const duracaoVisualMinima = opcoes.duracaoVisualMinima ?? 0;

  const ordenados = [...eventos].sort((a, b) => {
    const porInicio = emMinutos(a.startTime) - emMinutos(b.startTime);
    if (porInicio !== 0) return porInicio;
    /* O mais longo primeiro: ele define a extensao do grupo, e assim as
       colunas da esquerda ficam com quem ocupa mais tempo. */
    return emMinutos(b.endTime) - emMinutos(a.endTime);
  });

  const posicionados: EventoPosicionado[] = [];
  let grupo: { evento: Event; coluna: number }[] = [];
  let fimPorColuna: number[] = [];
  let fimDoGrupo = -1;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    const colunasDoGrupo = Math.max(...grupo.map((g) => g.coluna + 1));
    grupo.forEach(({ evento, coluna }) =>
      posicionados.push({ evento, coluna, colunasDoGrupo })
    );
    grupo = [];
    fimPorColuna = [];
    fimDoGrupo = -1;
  };

  for (const evento of ordenados) {
    const inicio = emMinutos(evento.startTime);
    const fim = Math.max(
      emMinutos(evento.endTime),
      inicio + duracaoVisualMinima
    );

    /* Comecou depois que todo mundo do grupo anterior terminou: ninguem mais
       divide nada com ele, o grupo fecha e um novo comeca. */
    if (inicio >= fimDoGrupo) fecharGrupo();

    const livre = fimPorColuna.findIndex((fimDaColuna) => fimDaColuna <= inicio);
    const coluna = livre === -1 ? fimPorColuna.length : livre;

    fimPorColuna[coluna] = fim;
    grupo.push({ evento, coluna });
    fimDoGrupo = Math.max(fimDoGrupo, fim);
  }

  fecharGrupo();

  return posicionados;
}
