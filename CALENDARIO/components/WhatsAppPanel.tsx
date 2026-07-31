import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send } from "lucide-react";
import { motion } from "framer-motion";
import {
  ApiError,
  getWhatsAppMessages,
  sendWhatsAppMessage,
} from "../services/calendarApi";
import { usePolling } from "../hooks/usePolling";

export interface Conversation {
  id: number;
  name: string;
  /** `wa_id` do contato, só dígitos, como a Meta manda. */
  phone: string;
  preview: string;
  /** Quem mandou a mensagem do preview. Decide de que lado ela abre. */
  previewFromMe: boolean;
  time: string;
  unread: number;
  color: string;
}

/**
 * O telefone como o dono lê, não como a Meta manda.
 *
 * Só formata o que reconhece — número brasileiro com DDI 55, DDD e 8 ou 9 dígitos.
 * Qualquer outra coisa sai crua de propósito: um número estrangeiro picado em
 * grupos de dois seria mais difícil de ler que o original, e este é o campo que o
 * dono usa pra achar o cliente na agenda dele.
 */
function formatarTelefone(phone: string): string {
  const grupos = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  if (!grupos) return phone;

  return `+55 (${grupos[1]}) ${grupos[2]}-${grupos[3]}`;
}

interface Message {
  id: number;
  text: string;
  fromMe: boolean;
  time: string;
}

/**
 * O histórico já carregado de cada conversa, guardado FORA do componente.
 *
 * O Sidebar renderiza o painel condicionalmente, então fechar a conversa desmonta
 * tudo e o estado morre junto. Sem isto, cada reabertura recomeçava do zero: uma
 * bolha sozinha na tela durante a ida e volta do fetch, e só então o diálogo
 * inteiro. Reabrir uma conversa já vista agora pinta ela completa no primeiro
 * quadro, e o polling apenas reconcilia por baixo.
 *
 * Vive enquanto a aba viver — é memória de sessão, não cache persistente. Um F5
 * limpa, e isso está certo: o custo de estar desatualizado é maior que o de uma
 * carga a mais.
 */
const historico = new Map<number, Message[]>();

/**
 * Por que a mensagem não saiu, na língua de quem vai ler.
 *
 * "Não foi possível enviar" servia para tudo e não ajudava em nada: janela de 24h
 * fechada e Meta fora do ar pedem reações opostas — na primeira não adianta tentar
 * de novo nunca, só o cliente reabre a janela; na segunda, tentar de novo é
 * exatamente o certo.
 */
function motivoDaFalha(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Não foi possível enviar a mensagem. Verifique sua conexão e tente de novo.";
  }

  if (err.status === 403) {
    return "Passaram-se mais de 24h desde a última mensagem do cliente, e o WhatsApp não deixa mais escrever nesta conversa. Ela volta a aceitar mensagem quando ele te chamar de novo.";
  }

  if (err.status === 503) {
    return "O envio pelo painel ainda não está configurado nesta instalação.";
  }

  // Inclui o 502 do bot: a Meta recusou. Tentar de novo faz sentido.
  return err.message || "Não foi possível enviar a mensagem. Tente de novo.";
}

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

/**
 * O texto da bolha com o negrito do WhatsApp resolvido.
 *
 * O bot escreve `*assim*` porque é o que a Meta renderiza no celular do cliente; aqui
 * os asteriscos apareciam crus, e o dono lia uma frase diferente da que foi enviada.
 * As quebras de linha são outra metade do mesmo problema e ficam por conta do
 * `whitespace-pre-line` da <p>: sem ele, as opções de uma lista saem todas grudadas
 * numa linha só.
 *
 * Sem `dangerouslySetInnerHTML` — esta mesma bolha mostra texto que o cliente digitou.
 *
 * ponytail: só negrito. Gatilho de upgrade: o bot passar a usar _itálico_ ou ~riscado~.
 */
function comNegrito(texto: string): React.ReactNode[] {
  // O grupo de captura faz o `split` intercalar: índice par é texto solto, ímpar é o
  // miolo de um par de asteriscos.
  //
  // O `\S` nas pontas é a regra do próprio WhatsApp, e não capricho: sem ela, um
  // cliente que escreve "2 * 3 = 6 e *isso* conta" tem o asterisco solto casado com o
  // seguinte, e o dono lê "2 3 = 6 e isso conta" em negrito no meio. Quebra de linha
  // também não atravessa — negrito é dentro da linha.
  return texto
    .split(/\*(\S|\S[^*\n]*\S)\*/g)
    .map((pedaco, i) => (i % 2 === 1 ? <strong key={i}>{pedaco}</strong> : pedaco));
}

const WhatsAppPanel: React.FC<Props> = ({ conversation, onClose }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(
    () => historico.get(conversation.id) ?? [],
  );
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Qual conversa está na tela AGORA. Serve pra descartar a resposta de um fetch que
  // saiu antes de o dono trocar de conversa: ela chega depois, com o painel já
  // mostrando outra pessoa, e pintaria o diálogo errado.
  const idNaTela = useRef(conversation.id);
  idNaTela.current = conversation.id;

  // Trocar de conversa pula direto pro fim, sem animação: rolar suavemente uma
  // conversa que acabou de aparecer é o mesmo tranco visual que estamos tirando.
  // Mensagem nova numa conversa já aberta continua deslizando.
  const conversaAnterior = useRef<number | undefined>(undefined);
  useEffect(() => {
    const trocou = conversaAnterior.current !== conversation.id;
    conversaAnterior.current = conversation.id;
    messagesEndRef.current?.scrollIntoView({
      behavior: trocou ? "auto" : "smooth",
    });
  }, [conversation.id, messages.length]);

  // Ao trocar de conversa (sem fechar o painel), mostra o que já foi carregado dela.
  // Nada em cache: fica vazio por um instante em vez de piscar uma bolha solta — o
  // preview só entra em cena se a carga FALHAR, logo abaixo.
  useEffect(() => {
    setMessages(historico.get(conversation.id) ?? []);
  }, [conversation.id]);

  usePolling(
    async () => {
      const id = conversation.id;

      try {
        const data = await getWhatsAppMessages(id);
        const carregadas = data.map((message) => ({
          id: message.id,
          text: message.body || `[${message.message_type}]`,
          fromMe: message.direction === "outbound",
          time: new Date(message.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        historico.set(id, carregadas);
        if (idNaTela.current === id) setMessages(carregadas);
      } catch (err) {
        // Tela vazia por falha de carga, nunca. Sem nada pintado ainda, o preview
        // (a última mensagem, que o Sidebar já tem em mãos) segura o lugar. Com algo
        // pintado, não se toca: erro transitório não apaga o que já está lendo.
        if (idNaTela.current === id) {
          setMessages((prev) =>
            prev.length > 0
              ? prev
              : [
                  {
                    id: 1,
                    text: conversation.preview,
                    fromMe: conversation.previewFromMe,
                    time: conversation.time,
                  },
                ],
          );
        }
        // Relançado de propósito: é o hook que decide o backoff, e um 429 traz o
        // Retry-After junto.
        throw err;
      }
    },
    { intervalMs: 5000 },
    [conversation.id],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    // Otimista: mostra já; o polling reconcilia com a versão do banco.
    //
    // A memória de sessão anda junto com a tela nos dois caminhos, senão fechar e
    // reabrir logo depois de mandar mostraria a conversa sem a mensagem recém-enviada
    // — o mesmo pisca, só que por outra porta.
    const tempId = -Date.now();
    const comOtimista = [
      ...messages,
      {
        id: tempId,
        text,
        fromMe: true,
        time: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
    setMessages(comOtimista);
    historico.set(conversation.id, comOtimista);
    try {
      await sendWhatsAppMessage(conversation.id, text);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      window.alert(motivoDaFalha(err));
      const semOtimista = comOtimista.filter((m) => m.id !== tempId);
      setMessages(semOtimista);
      historico.set(conversation.id, semOtimista);
      setInput(text); // devolve o texto pro campo
    } finally {
      setSending(false);
    }
  };

  const initials = conversation.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const panel = (
    <motion.div
      key={`panel-${conversation.id}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed top-0 bottom-0 left-72 z-30 flex flex-col w-[360px] border-r border-white/[0.07] shadow-[4px_0_32px_rgba(0,0,0,0.5)]"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-[#202020] flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
          style={{ backgroundColor: conversation.color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {conversation.name}
          </p>
          {/*
            Aqui dizia "online", em verde, fixo no código — não havia (nem há) sinal
            de presença vindo da Meta. Era enfeite que o dono podia ler como
            "o cliente está com o WhatsApp aberto agora". O telefone é dado real e
            é o que ele usa pra cruzar com a agenda.
          */}
          <p className="text-[11px] text-white/40 truncate">
            {formatarTelefone(conversation.phone)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      {/*
        Ancorado no rodapé (`mt-auto` no miolo, não `justify-end` no contêiner — em
        contêiner rolável o `justify-end` corta o topo). Duas coisas saem daqui:
        conversa curta encosta embaixo, como no WhatsApp, e o preview semeado nasce
        já na posição final. Antes ele aparecia colado no topo e o histórico o
        empurrava pra baixo um instante depois — o pulo que sobrou depois do pisca.
      */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="mt-auto space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                  msg.fromMe
                    ? "bg-[#6B3EFF] text-white rounded-br-sm"
                    : "bg-[#2a2a2a] text-white/90 rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-line">{comNegrito(msg.text)}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    msg.fromMe ? "text-white/45 text-right" : "text-white/30"
                  }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/[0.07] bg-[#202020] flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Mensagem…"
            className="flex-1 rounded-xl bg-[#2a2a2a] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#6B3EFF]/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-[#6B3EFF] flex items-center justify-center text-white disabled:opacity-25 hover:bg-[#7c52ff] transition-colors flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return createPortal(panel, document.body);
};

export default WhatsAppPanel;
