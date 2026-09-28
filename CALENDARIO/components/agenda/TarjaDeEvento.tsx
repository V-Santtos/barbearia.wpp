import React from "react";

/* A tarja de agendamento das grades de Semana e Mes.

   As duas telas parecem o mesmo problema, mas o dado que nao pode sumir e o
   oposto em cada uma:

   - No MES a celula nao tem eixo de tempo. A hora e a unica coisa que posiciona
     o agendamento dentro do dia, entao ela e a ancora, o nome entra ao lado
     quando a tarja mede o bastante, e o conjunto alinha A ESQUERDA — assim as
     horas de uma celula formam uma coluna, em vez de dancar conforme o
     comprimento de cada nome. Quando so a hora cabe, ela centraliza.
   - Na SEMANA a posicao vertical ja e a hora, e a calha da esquerda a repete.
     A tarja mostra SO o nome, CENTRALIZADO, porque ela ocupa a largura inteira
     da coluna e o nome costuma sobrar espaco.

   Quem decide se o nome cabe ao lado da hora e a propria tarja (`@container`),
   nao a janela: a coluna de secoes recolhe de 240 px para 64 px e o painel de
   conversas abre, entao a tarja muda de largura sem a janela mudar de tamanho.
   De quebra, o mes no celular continua so com a hora sem precisar perguntar se
   e celular — a celula de ~45 px simplesmente nao comporta nome. */

interface TarjaDeEventoProps {
  titulo: string;
  horaInicio: string;
  cor: string;
  ancora: "hora" | "nome";
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  larguraDaBorda?: number;
  /* Rastro de um atendimento que comecou numa hora anterior. Desenha apagada:
     ela existe para a celula nao parecer livre, nao para disputar atencao com
     o agendamento que de fato comeca ali. */
  atenuada?: boolean;
  tamanhoDaFonte?: number;
  /* A tarja vira desenho: nao recebe toque, nao recebe foco e some da arvore
     de acessibilidade, porque quem responde pelo conteudo passa a ser o
     elemento que a contem. */
  naoInterativa?: boolean;
}

/* Limiar em cima da CAIXA DE CONTEUDO da tarja (`inline-size` desconta o
   padding): abaixo disto o nome nasceria com duas letras e uma reticencia. */
const LARGURA_PARA_O_NOME = "@min-[78px]:inline";

/* O tamanho e o peso chegam por estilo inline, e nao por classe, porque
   `index.css` declara `button, input, textarea { font: inherit }` FORA de
   qualquer `@layer`. Regra sem camada vence a camada `utilities`, entao
   `text-[11px]` e `font-semibold` aplicados a um <button> sao silenciosamente
   ignorados neste projeto — o nome herdava os 16 px do corpo da pagina. Vale
   para qualquer botao do app; consertar na origem mexeria em tudo, e nao e
   desta rodada. */
const PROPORCAO_DA_HORA = 0.92;

const TarjaDeEvento: React.FC<TarjaDeEventoProps> = ({
  titulo,
  horaInicio,
  cor,
  ancora,
  onClick,
  className = "",
  style,
  larguraDaBorda = 3,
  atenuada = false,
  tamanhoDaFonte,
  naoInterativa = false,
}) => {
  const mostraHora = ancora === "hora";

  return (
    <button
      type="button"
      onClick={naoInterativa ? undefined : onClick}
      tabIndex={naoInterativa ? -1 : undefined}
      aria-hidden={naoInterativa || undefined}
      aria-label={
        atenuada
          ? `${titulo}, em andamento desde ${horaInicio}`
          : `${titulo}, às ${horaInicio}`
      }
      title={
        atenuada
          ? `${titulo} – em andamento desde ${horaInicio}`
          : `${titulo} – ${horaInicio}`
      }
      /* Sem utilitario de `position` aqui de proposito: quem posiciona e a
         grade que usa a tarja — a Semana a crava em `absolute` sobre a coluna
         do dia, o Mes a deixa no fluxo da celula. Um `relative` nesta base
         vencia o `absolute` de fora (o Tailwind emite `.relative` depois) e a
         Semana desenhava as tarjas fora da grade. */
      className={`@container group block overflow-hidden ${
        naoInterativa ? "pointer-events-none" : ""
      } text-left text-white transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70 ${
        atenuada
          ? "border border-dashed border-white/10 bg-[#1f1f1f]/40 hover:bg-[#1f1f1f]/70"
          : "border border-white/10 bg-[#1f1f1f] hover:border-white/20 hover:bg-[#262626]"
      } ${className}`}
      style={{
        boxShadow: atenuada
          ? `inset ${larguraDaBorda}px 0 0 ${cor}`
          : `inset ${larguraDaBorda}px 0 0 ${cor}, 0 3px 8px rgba(0,0,0,0.16)`,
        opacity: atenuada ? 0.45 : undefined,
        fontSize: tamanhoDaFonte,
        fontWeight: 600,
        ...style,
      }}
    >
      <span
        className={`flex h-full min-w-0 items-center gap-1 whitespace-nowrap ${
          /* Hora sozinha (a tarja estreita demais para o nome -- o Mês no
             celular e no tablet) vai CENTRALIZADA: sem nome ao lado, não há
             coluna a formar, e encostada à esquerda ela sobrava solta dentro
             da tarja (2026-09-26, a pedido do dono). Quando o nome cabe, volta
             para a esquerda, pelo mesmo limiar que faz o nome aparecer. */
          mostraHora ? "justify-center @min-[78px]:justify-start" : "justify-center"
        }`}
      >
        {mostraHora && (
          <>
            {/* Um ponto menor e menos pesado que o nome quando os dois
                aparecem: a hora ancora a leitura, mas nao precisa disputar
                tamanho com quem identifica o agendamento — e o que ela cede
                vira folga para o nome. */}
            <span
              className="shrink-0 font-semibold tabular-nums text-white/90"
              style={{
                fontSize: tamanhoDaFonte
                  ? Math.round(tamanhoDaFonte * PROPORCAO_DA_HORA)
                  : undefined,
              }}
            >
              {horaInicio}
            </span>
            {/* O traco acompanha o nome: quando a tarja e estreita demais para
                ele (a celula do mes no celular), sobra a hora sozinha e um
                traco solto nao faria sentido. */}
            <span
              aria-hidden="true"
              className={`hidden shrink-0 text-white/35 ${LARGURA_PARA_O_NOME}`}
            >
              –
            </span>
          </>
        )}
        <span
          className={`min-w-0 truncate ${
            atenuada ? "font-medium text-white/70" : "text-white/90"
          } ${mostraHora ? `hidden ${LARGURA_PARA_O_NOME}` : ""}`}
        >
          {titulo}
        </span>
      </span>
    </button>
  );
};

export default TarjaDeEvento;
