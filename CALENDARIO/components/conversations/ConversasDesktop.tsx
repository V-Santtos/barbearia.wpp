import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { usePolling } from "../../hooks/usePolling";
import {
  getWhatsAppConversations,
  markWhatsAppConversationAsRead,
  type WhatsAppConversation,
} from "../../services/calendarApi";
import WhatsAppPanel, { type Conversation } from "../WhatsAppPanel";
import MolduraDeSecao from "../shell/MolduraDeSecao";

const CORES = [
  "#FF2A29",
  "#FF5000",
  "#2FFF40",
  "#07FF99",
  "#07FFF5",
  "#0047FF",
  "#8400FF",
  "#FC00FF",
];

type Filtro = "todas" | "nao-lidas";
type ConversaDesktop = Conversation;

interface Props {
  busca: string;
  ativa: boolean;
}

function formatarHorario(value?: string | null) {
  if (!value) return "";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "";

  const hoje = new Date();
  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function converterConversa(
  item: WhatsAppConversation,
  index: number,
): ConversaDesktop {
  return {
    id: item.id,
    name: item.contact.name || item.contact.phone,
    phone: item.contact.wa_id || item.contact.phone,
    preview:
      item.last_message?.body ||
      item.last_message?.message_type ||
      "Mensagem recebida",
    previewFromMe: item.last_message?.direction === "outbound",
    time: formatarHorario(item.last_message_at),
    unread: item.unread_count ?? 0,
    color: CORES[index % CORES.length],
  };
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ConversasDesktop({ busca, ativa }: Props) {
  const [conversas, setConversas] = useState<ConversaDesktop[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [carregando, setCarregando] = useState(true);

  usePolling(
    async () => {
      const data = await getWhatsAppConversations();
      const convertidas = data.map(converterConversa);
      setConversas(convertidas);
      setSelecionadaId((atual) => {
        if (atual && convertidas.some((item) => item.id === atual)) return atual;
        return convertidas[0]?.id ?? null;
      });
      setCarregando(false);
    },
    { intervalMs: 8000, enabled: ativa },
    [],
  );

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const naoLidas = conversas.reduce((total, item) => total + item.unread, 0);
  const visiveis = useMemo(
    () =>
      conversas.filter((item) => {
        if (filtro === "nao-lidas" && item.unread === 0) return false;
        if (!termo) return true;
        return [item.name, item.phone, item.preview].some((valor) =>
          valor.toLocaleLowerCase("pt-BR").includes(termo),
        );
      }),
    [conversas, filtro, termo],
  );

  const selecionada =
    conversas.find((item) => item.id === selecionadaId) ?? null;

  const selecionar = (conversa: ConversaDesktop) => {
    setSelecionadaId(conversa.id);
    if (conversa.unread === 0) return;

    setConversas((atuais) =>
      atuais.map((item) =>
        item.id === conversa.id ? { ...item, unread: 0 } : item,
      ),
    );
    markWhatsAppConversationAsRead(conversa.id).catch((erro) => {
      console.error("Erro ao marcar conversa como lida:", erro);
    });
  };

  return (
    <MolduraDeSecao
      titulo="Conversas"
      descricao="O atendimento do WhatsApp da barbearia, em uma tela só."
      rotulo="Conversas do WhatsApp"
    >
      <aside className="flex h-full w-[360px] flex-shrink-0 flex-col border-r border-white/[0.07] bg-[#191919]">
        <header className="flex flex-shrink-0 flex-col">
          {/*
            72px aqui e 72px no cabeçalho da conversa (`WhatsAppPanel`, modo
            `embedded`): é o mesmo número dos dois lados para que a linha que
            fecha os dois cabeçalhos seja uma só, atravessando a pílula inteira.
            Mexer em um sem mexer no outro quebra a emenda.

            As abas descem para a própria faixa, abaixo dessa linha — elas só
            existem do lado da lista, e não têm com o que se alinhar à direita.
          */}
          <div className="flex h-[72px] flex-shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] px-4">
            <h2 className="text-xl font-medium leading-none text-white">
              Caixa de entrada
            </h2>
            <span className="text-xs text-white/40">
              {conversas.length} contatos
            </span>
          </div>

          <div
            className="flex flex-shrink-0 items-center gap-5 border-b border-white/[0.07] px-4 pt-3"
            role="tablist"
            aria-label="Filtrar conversas"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filtro === "todas"}
              onClick={() => setFiltro("todas")}
              className={`relative pb-2 text-sm transition-colors ${
                filtro === "todas"
                  ? "text-white"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              Todas
              {filtro === "todas" && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filtro === "nao-lidas"}
              onClick={() => setFiltro("nao-lidas")}
              className={`relative pb-2 text-sm transition-colors ${
                filtro === "nao-lidas"
                  ? "text-white"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              Não lidas{" "}
              {naoLidas > 0 && (
                <span className="text-white/40">({naoLidas})</span>
              )}
              {filtro === "nao-lidas" && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {carregando && (
            <p className="px-3 py-8 text-center text-sm text-white/45">
              Carregando conversas…
            </p>
          )}

          {!carregando && visiveis.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-white/45">
              Nenhuma conversa encontrada.
            </p>
          )}

          <div className="space-y-1">
            {visiveis.map((conversa) => {
              const selecionada = conversa.id === selecionadaId;
              return (
                <button
                  key={conversa.id}
                  type="button"
                  aria-pressed={selecionada}
                  onClick={() => selecionar(conversa)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
                      selecionada
                        ? "bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "hover:bg-white/[0.045]"
                    }`}
                >
                  {/*
                    A cor do cliente saiu do preenchimento e virou um ponto de 10px,
                    do tamanho exato da bolinha de presença da referência. Oito
                    avatares chapados de cor pura brigavam entre si e com o roxo da
                    marca; a inicial em fundo neutro lê melhor, e o ponto continua
                    dando a distinção de um cliente para o outro.
                  */}
                  <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-semibold text-white/70 ring-1 ring-inset ring-white/[0.08]">
                    {iniciais(conversa.name)}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-[#191919]"
                      style={{ backgroundColor: conversa.color }}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          conversa.unread > 0
                            ? "font-semibold text-white"
                            : "font-medium text-white/85"
                        }`}
                      >
                        {conversa.name}
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-white/35">
                        {conversa.time}
                      </span>
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          conversa.unread > 0 ? "text-white/65" : "text-white/38"
                        }`}
                      >
                        {conversa.previewFromMe ? "Você: " : ""}
                        {conversa.preview}
                      </span>
                      {conversa.unread > 0 && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-white">
                          {conversa.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1">
        {selecionada ? (
          <WhatsAppPanel conversation={selecionada} embedded />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.045] text-white/35">
              <MessageCircle size={25} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white/85">
                Selecione uma conversa
              </h2>
              <p className="mt-1 text-sm text-white/40">
                Escolha um cliente para abrir o histórico do WhatsApp.
              </p>
            </div>
          </div>
        )}
      </div>
    </MolduraDeSecao>
  );
}
