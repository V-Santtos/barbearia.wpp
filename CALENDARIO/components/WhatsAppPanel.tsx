import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send } from "lucide-react";
import { motion } from "framer-motion";
import {
  getWhatsAppMessages,
  sendWhatsAppMessage,
} from "../services/calendarApi";
import { usePolling } from "../hooks/usePolling";

export interface Conversation {
  id: number;
  name: string;
  preview: string;
  time: string;
  unread: number;
  color: string;
}

interface Message {
  id: number;
  text: string;
  fromMe: boolean;
  time: string;
}

const mockMessages: Record<number, Message[]> = {
  1: [
    { id: 1, text: "Oi, tudo bem?", fromMe: false, time: "10:28" },
    { id: 2, text: "Boa tarde! Tudo sim 😊", fromMe: true, time: "10:34" },
    {
      id: 3,
      text: "Tem horário disponível amanhã cedo?",
      fromMe: false,
      time: "09:40",
    },
    {
      id: 4,
      text: "Precisaria cortar antes das 9h se possível",
      fromMe: false,
      time: "09:42",
    },
  ],
  2: [
    {
      id: 1,
      text: "Boa tarde! Pronto pra te atender às 14h 😊",
      fromMe: true,
      time: "ontem",
    },
    { id: 2, text: "Ficou ótimo, obrigada! 👍", fromMe: false, time: "ontem" },
  ],
  3: [
    {
      id: 1,
      text: "Olá Carlos! Seu horário está confirmado pra hoje às 15h.",
      fromMe: true,
      time: "13:00",
    },
    { id: 2, text: "Pode confirmar pra mim?", fromMe: false, time: "14:30" },
  ],
  6: [
    { id: 1, text: "Oi! Tem vaga no sábado?", fromMe: false, time: "dom" },
    { id: 2, text: "Quero marcar pra sábado", fromMe: false, time: "dom" },
    { id: 3, text: "Que horas você prefere?", fromMe: false, time: "dom" },
  ],
  10: [
    {
      id: 1,
      text: "Bom dia! Tô indo pra aí mais tarde",
      fromMe: false,
      time: "qua",
    },
    { id: 2, text: "Confirma o horário das 10h?", fromMe: false, time: "qua" },
  ],
};

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

const WhatsAppPanel: React.FC<Props> = ({ conversation, onClose }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.id, messages.length]);

  // Ao trocar de conversa, semeia o preview imediatamente. O polling abaixo
  // substitui pelo histórico real assim que carrega. Se o carregamento falhar
  // (ex.: 429), o usuário continua vendo o preview em vez de uma tela vazia,
  // e mensagens já carregadas NUNCA são apagadas por um erro transitório.
  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: conversation.preview,
        fromMe: false,
        time: conversation.time,
      },
    ]);
  }, [conversation.id, conversation.preview, conversation.time]);

  usePolling(
    async () => {
      const data = await getWhatsAppMessages(conversation.id);
      setMessages(
        data.map((message) => ({
          id: message.id,
          text: message.body || `[${message.message_type}]`,
          fromMe: message.direction === "outbound",
          time: new Date(message.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
      );
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
    // Otimista: mostra já; o polling de 4s reconcilia com a versão do banco
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text,
        fromMe: true,
        time: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    try {
      await sendWhatsAppMessage(conversation.id, text);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      window.alert("Não foi possível enviar a mensagem.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
          <p className="text-[11px] text-[#25D366]">online</p>
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
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
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
              <p>{msg.text}</p>
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
