/**
 * O mock costurado no lugar do `fetch`, não no lugar das telas.
 *
 * A costura é o transporte (`api()` do `calendarApi`), e isso é decisão, não
 * conveniência: as funções exportadas continuam rodando inteiras — `toEvent`,
 * `toProf`, os filtros, os `catch` — sobre um corpo com o MESMO formato que o
 * Fastify devolve. Nenhum componente ganha um `if (mock)`. O que sair torto
 * aqui sairia torto com a API de pé, que é o que dá valor ao teste.
 *
 * Rota que este arquivo não conhece cai fora e vai para a rede de verdade.
 * De propósito: mock silencioso que responde qualquer coisa esconde endpoint
 * novo em vez de mostrar que ele não foi coberto.
 */
import type { BlockPeriod, BookingSiteSettings, DiaBloqueado, WhatsAppMessage } from "../calendarApi";
import { montarResumoDoMundo } from "./resumo";
import { variantesDeBusca } from "../../lib/telefone";
import {
  calcularTotais,
  juntarServicos,
  validarFechamento,
  type ClientePresencial,
  type ServicoDoAtendimento,
} from "../../lib/fechamento";
import {
  gradeDoDia,
  hhmm,
  iso,
  moldeDe,
  mundo,
  type AgendamentoMock,
} from "./mundo";

/** Sentinela: "esta rota não é minha". `undefined` seria resposta válida. */
export const SEM_MOCK = Symbol("sem-mock");

const siteMock: BookingSiteSettings = {
  home: { heroLine1: "Bem-vindo à", heroName: "Barbearia", ctaLabel: "Agendar" },
  categories: {
    filtersEnabled: true,
    items: [
      { id: "cabelo", label: "Cabelo", active: true },
      { id: "barba", label: "Barba", active: true },
      { id: "combos", label: "Combos", active: true },
      { id: "outros", label: "Outros", active: true },
    ],
  },
  services: [
    { id: 1, slug: "corte", category: "cabelo", name: "Corte", desc: "Corte e acabamento.", price: "35" },
    { id: 2, slug: "corte-barba", category: "combos", name: "Corte + Barba", desc: "Corte e barba completos.", price: "55" },
    { id: 3, slug: "barba", category: "barba", name: "Barba", desc: "Modelagem e acabamento.", price: "25" },
    { id: 4, slug: "pezinho", category: "cabelo", name: "Pezinho", desc: "Acabamento do contorno.", price: "15" },
    { id: 5, slug: "sobrancelha", category: "outros", name: "Sobrancelha", desc: "Alinhamento natural.", price: "15" },
  ],
};

const OCUPA = (status: string) => status !== "cancelado";

function partes(caminho: string): { seg: string[]; q: URLSearchParams } {
  const [semQuery, query = ""] = caminho.split("?");
  return {
    seg: semQuery.replace(/^\/+|\/+$/g, "").split("/"),
    q: new URLSearchParams(query),
  };
}

function corpo(init: RequestInit): any {
  if (typeof init.body !== "string") return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

function duracaoDe(profId: number): number {
  return moldeDe(profId)?.duracaoMin ?? 40;
}

function somarMin(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  return hhmm(h + (m + min) / 60);
}

function profPorNome(nome: string) {
  return mundo.profissionais.find(
    (p) => p.nome.toLowerCase() === String(nome).toLowerCase(),
  );
}

/** O formato de linha que o `toEvent` do `calendarApi` espera receber. */
function linhaCrua(a: AgendamentoMock) {
  return { ...a };
}

// ─── Horários livres de um dia ────────────────────────────────────────────────

function horariosDisponiveis(profId: number, dataISO: string): string[] {
  const m = moldeDe(profId);
  if (!m) return [];

  const bloqueado = mundo.bloqueios.some(
    (b) => b.data === dataISO && !b.periodos,
  );
  if (bloqueado) return [];

  const wd = new Date(`${dataISO}T12:00:00`).getDay();
  const ocupados = new Set(
    mundo.agendamentos
      .filter(
        (a) =>
          a.dia_marcado === dataISO &&
          a.professional_id === profId &&
          OCUPA(a.status),
      )
      .map((a) => a.hora_marcada),
  );

  // Hoje não vende horário que já passou; nos dias à frente, a grade inteira.
  const agora = new Date();
  const ehHoje = dataISO === iso(mundo.hoje);
  const agoraDec = agora.getHours() + agora.getMinutes() / 60;

  return gradeDoDia(m, wd)
    .filter((s) => !ocupados.has(hhmm(s)) && (!ehHoje || s >= agoraDec))
    .map(hhmm);
}

// ─── Roteador ─────────────────────────────────────────────────────────────────

export function responderMock(
  caminho: string,
  init: RequestInit,
): unknown | typeof SEM_MOCK {
  const metodo = String(init.method ?? "GET").toUpperCase();
  const { seg, q } = partes(caminho);
  const dados = corpo(init);

  if (seg[0] === "configuracao" && seg[1] === "home") {
    if (metodo === "GET") return { ...siteMock.home };
    if (metodo === "PUT") {
      siteMock.home = { ...dados };
      return siteMock.home;
    }
  }
  if (seg[0] === "categorias-servicos") {
    if (metodo === "GET") return structuredClone(siteMock.categories);
    if (metodo === "PUT") {
      siteMock.categories = structuredClone(dados);
      return siteMock.categories;
    }
  }

  // ── profissionais ────────────────────────────────────────────────────────
  if (seg[0] === "profissionais") {
    if (seg.length === 1) {
      if (metodo === "GET") return mundo.profissionais;
      if (metodo === "POST") {
        const novo = {
          id: Math.max(0, ...mundo.profissionais.map((p) => p.id)) + 1,
          nome: String(dados.nome ?? dados.name ?? "Novo profissional"),
          cor: String(dados.cor ?? dados.color ?? "#64748b"),
          ativo: true,
          created_at: new Date().toISOString(),
        };
        mundo.profissionais.push(novo);
        return novo;
      }
    }

    const profId = Number(seg[1]);

    if (seg.length === 2) {
      const i = mundo.profissionais.findIndex((p) => p.id === profId);
      if (metodo === "PUT" && i >= 0) {
        mundo.profissionais[i] = {
          ...mundo.profissionais[i],
          ...(dados.nome !== undefined ? { nome: String(dados.nome) } : {}),
          ...(dados.cor !== undefined ? { cor: String(dados.cor) } : {}),
          ...(dados.ativo !== undefined ? { ativo: Boolean(dados.ativo) } : {}),
        };
        return mundo.profissionais[i];
      }
      if (metodo === "DELETE") {
        if (i >= 0) mundo.profissionais.splice(i, 1);
        return {};
      }
    }

    if (seg[2] === "agenda-config") {
      const atual = mundo.agendaConfig.get(profId);
      if (metodo === "GET" && atual) return atual;
      if (metodo === "PUT" && atual) {
        const novo = {
          ...atual,
          ...dados,
          profissional_id: profId,
          atualizado_em: new Date().toISOString(),
        };
        mundo.agendaConfig.set(profId, novo);
        return novo;
      }
    }

    if (seg[2] === "dias-bloqueados") {
      if (seg.length === 3) {
        if (metodo === "GET") {
          const data = q.get("date");
          return data
            ? mundo.bloqueios.filter((b) => b.data === data)
            : mundo.bloqueios;
        }
        if (metodo === "POST") {
          const data = String(dados.data ?? "");
          const periodos = (dados.periodos ?? null) as BlockPeriod[] | null;
          const existente = mundo.bloqueios.find((b) => b.data === data);
          if (existente) {
            existente.periodos = periodos;
            existente.motivo = dados.motivo ?? existente.motivo;
            return existente;
          }
          const novo: DiaBloqueado = {
            id: Math.max(90, ...mundo.bloqueios.map((b) => b.id)) + 1,
            data,
            motivo: dados.motivo ?? null,
            periodos,
            created_at: new Date().toISOString(),
          };
          mundo.bloqueios.push(novo);
          return novo;
        }
      }
      if (seg.length === 4 && metodo === "DELETE") {
        const i = mundo.bloqueios.findIndex((b) => b.data === seg[3]);
        if (i >= 0) mundo.bloqueios.splice(i, 1);
        return {};
      }
    }
  }

  // ── servicos ─────────────────────────────────────────────────────────────
  // `price` sai como string porque no banco `servicos.preco` é `text` — ver
  // `ANEXO_BANCO`. Devolver número aqui esconderia a migração que falta.
  if (seg[0] === "servicos" && seg.length === 1) {
    if (metodo === "GET") return structuredClone(siteMock.services);
    if (metodo === "PUT") {
      siteMock.services = structuredClone(dados);
      return siteMock.services;
    }
  }

  // ── clientes ─────────────────────────────────────────────────────────────
  // Mesma regra do `server.js`: o agendamento mais recente daquele telefone
  // (comparando só dígitos, com e sem o nono dígito) dá o nome; presencial não
  // conta, porque lá o "cliente" é o rótulo "Atendimento Presencial".
  if (seg[0] === "clientes" && seg[1] === "buscar" && metodo === "GET") {
    const variantes = variantesDeBusca(q.get("telefone") ?? "");
    const achado = [...mundo.agendamentos]
      .reverse()
      .find(
        (a) =>
          a.source !== "presencial" &&
          a.cliente?.trim() &&
          variantes.includes(String(a.telefone ?? "").replace(/\D/g, "")),
      );
    return achado
      ? { encontrado: true, nome: achado.cliente.trim(), telefone: variantes[0] }
      : { encontrado: false, telefone: variantes[0] };
  }

  // ── agendamentos ─────────────────────────────────────────────────────────
  if (seg[0] === "agendamentos") {
    if (seg[1] === "dias-disponiveis" && metodo === "GET") {
      const profId = Number(q.get("professionalId"));
      const dias = Number(q.get("days") ?? 10);
      const openDays: { date: string; availableSlotsCount: number; firstSlot: string }[] = [];
      const disabledDays: string[] = [];
      for (let i = 0; i < dias; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const data = iso(d);
        const livres = horariosDisponiveis(profId, data);
        if (livres.length) {
          openDays.push({ date: data, availableSlotsCount: livres.length, firstSlot: livres[0] });
        } else {
          disabledDays.push(data);
        }
      }
      return { professionalId: profId, days: dias, openDays, disabledDays };
    }

    if (seg[1] === "horarios-disponiveis" && metodo === "GET") {
      return {
        professionalId: Number(q.get("professionalId")),
        date: q.get("date"),
        availableSlots: horariosDisponiveis(
          Number(q.get("professionalId")),
          String(q.get("date") ?? ""),
        ),
      };
    }

    if (seg.length === 1) {
      if (metodo === "GET") {
        const de = q.get("from");
        const ate = q.get("to");
        return mundo.agendamentos
          .filter(
            (a) =>
              (!de || a.dia_marcado >= de) && (!ate || a.dia_marcado <= ate),
          )
          .map(linhaCrua);
      }
      if (metodo === "POST") {
        const prof = profPorNome(dados.profissional);
        const profId = prof?.id ?? mundo.profissionais[0]?.id ?? 1;
        const hora = String(dados.hora_marcada ?? "09:00");
        const dur = duracaoDe(profId);
        const agora = new Date().toISOString();

        const novo: AgendamentoMock = {
          id: (mundo.proximoIdEvento += 1),
          professional_id: profId,
          profissional: prof?.nome ?? String(dados.profissional ?? ""),
          dia_marcado: String(dados.dia_marcado ?? iso(mundo.hoje)),
          hora_marcada: hora,
          startTime: hora,
          endTime: somarMin(hora, dur),
          duracao_min: dur,
          cliente: String(dados.cliente ?? "Sem nome"),
          telefone: String(dados.telefone ?? ""),
          servico: String(dados.servico ?? "Corte"),
          status: "agendado",
          source: String(dados.source ?? "painel"),
          created_at: agora,
          updated_at: agora,
        };
        mundo.agendamentos.push(novo);
        mundo.agendamentos.sort((a, b) =>
          a.dia_marcado === b.dia_marcado
            ? a.hora_marcada.localeCompare(b.hora_marcada)
            : a.dia_marcado.localeCompare(b.dia_marcado),
        );
        return { event: linhaCrua(novo) };
      }
    }

    const id = Number(seg[1]);
    const i = mundo.agendamentos.findIndex((a) => a.id === id);

    if (seg[2] === "concluir" && metodo === "POST") {
      if (i < 0) throw new Error("Agendamento não encontrado.");
      const servicos: ServicoDoAtendimento[] = Array.isArray(dados.servicos) ? dados.servicos : [];
      const ajuste = dados.ajuste ?? null;
      const cliente: ClientePresencial | null = dados.cliente ?? null;
      const erros = validarFechamento({ servicos, ajuste, cliente });
      const primeiro = Object.values(erros)[0];
      if (primeiro) throw new Error(primeiro);

      const atual = mundo.agendamentos[i];
      const agora = new Date().toISOString();
      const nomeCliente = cliente?.nome.trim();
      mundo.agendamentos[i] = {
        ...atual,
        status: "concluido",
        servico: juntarServicos(servicos.map((item) => item.nome)),
        ...(atual.source === "presencial" && {
          cliente: nomeCliente || "Cliente presencial",
          telefone: String(cliente?.telefone ?? "").replace(/\D/g, ""),
        }),
        fechamento: {
          servicos,
          ajuste,
          total: calcularTotais(servicos, ajuste).total,
          concluidoEm: agora,
        },
        updated_at: agora,
      };
      return { event: linhaCrua(mundo.agendamentos[i]) };
    }

    if (seg[2] === "status" && metodo === "PATCH") {
      if (i >= 0) {
        mundo.agendamentos[i].status = String(dados.status ?? "agendado");
        mundo.agendamentos[i].updated_at = new Date().toISOString();
      }
      return {};
    }

    if (seg.length === 2) {
      if (metodo === "PUT" && i >= 0) {
        const atual = mundo.agendamentos[i];
        const prof = dados.profissional ? profPorNome(dados.profissional) : null;
        const profId = prof?.id ?? atual.professional_id;
        const hora = String(dados.hora_marcada ?? atual.hora_marcada);
        const dur = duracaoDe(profId);

        mundo.agendamentos[i] = {
          ...atual,
          professional_id: profId,
          profissional: prof?.nome ?? atual.profissional,
          dia_marcado: String(dados.dia_marcado ?? atual.dia_marcado),
          hora_marcada: hora,
          startTime: hora,
          endTime: somarMin(hora, dur),
          duracao_min: dur,
          cliente: String(dados.cliente ?? atual.cliente),
          telefone: String(dados.telefone ?? atual.telefone),
          servico: String(dados.servico ?? atual.servico),
          status: String(dados.status ?? atual.status),
          updated_at: new Date().toISOString(),
        };
        return { event: linhaCrua(mundo.agendamentos[i]) };
      }
      if (metodo === "DELETE") {
        if (i >= 0) mundo.agendamentos.splice(i, 1);
        return {};
      }
    }
  }

  // ── dashboard ────────────────────────────────────────────────────────────
  if (seg[0] === "dashboard" && seg[1] === "resumo" && metodo === "GET") {
    return montarResumoDoMundo(q.get("date") ?? iso(mundo.hoje));
  }

  // ── whatsapp ─────────────────────────────────────────────────────────────
  if (seg[0] === "whatsapp" && seg[1] === "conversations") {
    if (seg.length === 2 && metodo === "GET") {
      const limite = Number(q.get("limit") ?? 50);
      return mundo.conversas
        .map((c) => c.conversa)
        .sort((a, b) =>
          String(b.last_message_at).localeCompare(String(a.last_message_at)),
        )
        .slice(0, limite);
    }

    const conversaId = Number(seg[2]);
    const alvo = mundo.conversas.find((c) => c.conversa.id === conversaId);

    if (seg[3] === "messages" && metodo === "GET") {
      return alvo?.mensagens ?? [];
    }

    if (seg[3] === "send" && metodo === "POST" && alvo) {
      const agora = new Date().toISOString();
      const msg: WhatsAppMessage = {
        id: Date.now(),
        conversation_id: conversaId,
        contact_id: alvo.conversa.contact.id,
        direction: "outbound",
        sender_type: "human",
        whatsapp_message_id: `wamid.MOCK${Date.now()}`,
        message_type: "text",
        body: String(dados.body ?? ""),
        media_id: null,
        status: "sent",
        created_at: agora,
        received_at: agora,
      };
      alvo.mensagens.push(msg);
      // Responder pelo painel é o que marca "humano assumiu" — a mesma regra do
      // bot calar enquanto o dono atende.
      alvo.conversa.status = "human";
      alvo.conversa.assigned_to = "Proprietário";
      alvo.conversa.last_message_at = agora;
      alvo.conversa.last_message = {
        direction: "outbound",
        sender_type: "human",
        message_type: "text",
        body: msg.body,
        created_at: agora,
      };
      return msg;
    }

    if (seg[3] === "read" && metodo === "POST" && alvo) {
      const lidas = alvo.conversa.unread_count;
      alvo.conversa.unread_count = 0;
      return { conversation_id: conversaId, marked_read: lidas };
    }
  }

  return SEM_MOCK;
}
