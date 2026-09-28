import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Plus } from "lucide-react";
import type { Event, Professional } from "../../types";
import DayView from "../DayView";

/* A pagina de um dia, no celular.

   Ela existe por dois motivos, os dois medidos na tela:

   - A tarja do mes no celular tem 14 px de altura. Numa celula com quatro
     agendamentos, o dedo nao acerta nenhum — e o que ele acerta abre um
     popover pensado para mouse. Aqui a celula inteira vira o alvo, e o detalhe
     acontece numa tela com espaco.
   - O caminho antigo mandava para o Kanban, que e uma tela do TURNO CORRENTE:
     ele abre na aba do relogio da maquina e oferece "concluir atendimento".
     Aplicado a um dia futuro, isso e um botao sem sentido. O Kanban nao esta
     errado; estava sendo usado para uma pergunta que nao e a dele.

   Por isso esta e uma sobreposicao com estado proprio, e nao uma `view` nova:
   o lugar "Dia" do celular continua sendo o Kanban, e ao fechar o mes volta
   exatamente onde estava. */

interface FolhaDoDiaProps {
  dateISO: string;
  events: Event[];
  professionals: Professional[];
  onFechar: () => void;
  onEventClick: (event: Event) => void;
  onCriar: (dateISO: string) => void;
}

const capitalizar = (texto: string) =>
  texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);

const emDecimal = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
};

const FolhaDoDia: React.FC<FolhaDoDiaProps> = ({
  dateISO,
  events,
  professionals,
  onFechar,
  onEventClick,
  onCriar,
}) => {
  const data = useMemo(() => new Date(`${dateISO}T12:00:00`), [dateISO]);

  const doDia = useMemo(
    () => events.filter((e) => e.date === dateISO),
    [events, dateISO]
  );

  /* Se e hoje, abre na hora atual; se nao, no primeiro agendamento; e num dia
     vazio, no comeco do expediente em vez das 05:00. */
  const horaInicialVisivel = useMemo(() => {
    const agora = new Date();
    if (agora.toLocaleDateString("en-CA") === dateISO) {
      return agora.getHours() + agora.getMinutes() / 60;
    }
    if (doDia.length === 0) return 8;
    return Math.min(...doDia.map((e) => emDecimal(e.startTime)));
  }, [doDia, dateISO]);

  const titulo = capitalizar(
    data.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  );

  const contagem =
    doDia.length === 1 ? "1 agendamento" : `${doDia.length} agendamentos`;

  return (
    <motion.div
      /* Entre o dock (z-index 100, em `10-mobile.css`) e o `EventModal`
         (z-[110]): a folha cobre a navegacao inferior, porque e uma pagina,
         e o modal de agendamento ainda abre por cima dela. */
      className="fixed inset-0 z-[105] flex flex-col bg-background"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <header className="flex items-center gap-3 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Voltar para o mês"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">
            {titulo}
          </p>
          <p className="text-[12px] text-white/50">{contagem}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <DayView
          currentDate={data}
          events={doDia}
          professionals={professionals}
          moldura={false}
          horaInicialVisivel={horaInicialVisivel}
          onEventClick={(evento) => onEventClick(evento)}
          onTimeslotClick={() => onCriar(dateISO)}
        />
      </div>

      <button
        type="button"
        onClick={() => onCriar(dateISO)}
        aria-label="Criar agendamento neste dia"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] right-5 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_rgba(86,80,249,0.45)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Plus size={26} />
      </button>
    </motion.div>
  );
};

export default FolhaDoDia;
