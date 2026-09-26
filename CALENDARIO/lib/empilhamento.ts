import type { Event } from "../types";

/* Como a grade da Semana arruma os agendamentos de um dia.

   A versao anterior tratava a coluna do dia como um eixo continuo: cada tarja
   nascia no minuto exato e, quando dois horarios se tocavam, eles dividiam a
   largura. Duas consequencias, as duas ruins:

   - Minuto exato nao alinha com minuto exato. Cada profissional corre num
     ritmo proprio (40, 30 e 45 min), entao nao existe uma grade de slots comum
     — as tarjas nasciam tortas umas em relacao as outras, por construcao.
   - Dividir a largura em duas dava 48 px por tarja, e "Natalia Coutinho" virava
     "N...". O empilhamento horizontal era a causa do nome ilegivel.

   Aqui a unidade passa a ser a CELULA DE UMA HORA, e o empilhamento e vertical:
   dentro da celula as tarjas se enfileiram de cima para baixo, cada uma com a
   largura inteira da coluna. O alinhamento deixa de depender do minuto, e o
   nome recupera o espaco — o que importa, porque `15:40 Natalia Coutinho` mede
   132 px e a tarja tem 77 px: hora e nome nao cabem juntos, e o nome e quem
   identifica o agendamento.

   A hora nao some da leitura, ela muda de lugar: a linha dentro da celula e a
   FATIA DA HORA em que o horario cai (com duas linhas, antes ou depois de
   :30). A posicao continua dizendo quando, so que por aproximacao, e sem
   gastar texto. */

export interface TarjaEmpilhada {
  evento: Event;
  hora: number;
  linha: number;
  /* Esta tarja nao e o comeco do atendimento: e o rastro dele numa hora
     seguinte, para a celula nao parecer livre quando nao esta. */
  continuacao: boolean;
  /* A celula estourou e reservou a calha da direita para a tarja `+N`, entao
     esta tarja nao ocupa a largura cheia. */
  divideAlinhaComExcedente: boolean;
}

export interface ExcedenteDaHora {
  hora: number;
  linha: number;
  eventos: Event[];
}

export interface PilhaDoDia {
  tarjas: TarjaEmpilhada[];
  excedentes: ExcedenteDaHora[];
}

interface Candidata {
  evento: Event;
  inicio: number;
  continuacao: boolean;
}

const emMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function empilharPorHora(
  eventos: Event[],
  capacidade: number
): PilhaDoDia {
  const fatia = 60 / capacidade;
  const porHora = new Map<number, Candidata[]>();

  const inscrever = (hora: number, candidata: Candidata) => {
    const lista = porHora.get(hora);
    if (lista) lista.push(candidata);
    else porHora.set(hora, [candidata]);
  };

  for (const evento of eventos) {
    const inicio = emMinutos(evento.startTime);
    const fim = emMinutos(evento.endTime);
    const horaInicial = Math.floor(inicio / 60);

    inscrever(horaInicial, { evento, inicio, continuacao: false });

    /* 16% dos atendimentos atravessam a hora (`17:40-18:20`), e sem isto a
       celula seguinte apareceria vazia — a grade mentindo sobre horario livre,
       que e o unico tipo de erro que custa dinheiro aqui. Terminar EM CIMA da
       linha (`17:30-18:00`) nao atravessa: por isso o `>` e nao o `>=`. */
    for (let hora = horaInicial + 1; fim > hora * 60; hora += 1) {
      inscrever(hora, { evento, inicio, continuacao: true });
    }
  }

  const tarjas: TarjaEmpilhada[] = [];
  const excedentes: ExcedenteDaHora[] = [];

  for (const [hora, candidatas] of porHora) {
    /* A continuacao vem primeiro: ela comecou antes de a celula existir, e
       ocupa o topo. Depois, ordem cronologica. */
    const ordenadas = [...candidatas].sort((a, b) => {
      if (a.continuacao !== b.continuacao) return a.continuacao ? -1 : 1;
      return a.inicio - b.inicio;
    });

    const ocupadas: (Candidata | null)[] = Array(capacidade).fill(null);
    const escorregaram: Candidata[] = [];

    for (const candidata of ordenadas) {
      const preferida = candidata.continuacao
        ? 0
        : Math.min(capacidade - 1, Math.floor((candidata.inicio % 60) / fatia));

      if (ocupadas[preferida] === null) ocupadas[preferida] = candidata;
      else escorregaram.push(candidata);
    }

    /* Duas marcacoes na mesma fatia da hora — 4 casos em 162 na agenda de
       teste. A segunda escorrega para a linha livre: a ordem cronologica se
       mantem, o que se perde e a leitura de metade da hora, naquele caso. */
    const sobrando: Event[] = [];
    for (const candidata of escorregaram) {
      const livre = ocupadas.indexOf(null);
      if (livre === -1) sobrando.push(candidata.evento);
      else ocupadas[livre] = candidata;
    }

    const ultimaOcupada = ocupadas.reduce(
      (ultima, candidata, i) => (candidata ? i : ultima),
      0
    );

    ocupadas.forEach((candidata, linha) => {
      if (!candidata) return;
      tarjas.push({
        evento: candidata.evento,
        hora,
        linha,
        continuacao: candidata.continuacao,
        /* A `+N` divide a ultima linha com a tarja que estiver nela: assim a
           celula continua mostrando o maximo de nomes que cabe, em vez de
           gastar uma linha inteira so para dizer que ha mais. */
        divideAlinhaComExcedente: sobrando.length > 0 && linha === ultimaOcupada,
      });
    });

    if (sobrando.length > 0) {
      excedentes.push({ hora, linha: ultimaOcupada, eventos: sobrando });
    }
  }

  return { tarjas, excedentes };
}
