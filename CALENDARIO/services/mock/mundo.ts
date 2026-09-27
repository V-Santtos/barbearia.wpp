/**
 * O mundo de teste do painel: profissionais, agenda, agendamentos e conversas.
 *
 * Uma fonte só. O calendário, o dashboard, a lista de conversas e a
 * disponibilidade saem todos daqui — se o dashboard dissesse "17 agendamentos
 * hoje" e o calendário mostrasse 3, seria a mesma incoerência que o
 * `DashboardScreen` foi escrito para evitar (ver o cabeçalho dele).
 *
 * Duas propriedades que o dono pediu, e como cada uma é obtida:
 *
 * - **Atemporal.** Nada é data cravada. Tudo nasce de `new Date()` no momento
 *   em que o módulo carrega, então a semana que aparece é sempre a semana de
 *   hoje. Um mock com data fixa envelhece calado e um dia começa a mostrar mês
 *   vazio (é o defeito do `Arham Khan Birthday` do template shadcn).
 * - **Estável ao recarregar.** Não existe `Math.random()` aqui. O sorteio é um
 *   gerador com semente fixa (`mulberry32`), então F5 reconstrói exatamente o
 *   mesmo mundo: mesmos clientes, nos mesmos horários, com os mesmos status.
 *   Dá para comparar dois prints do mesmo layout.
 *
 * O que NÃO é estável, de propósito: o que você criar/editar/apagar com a tela
 * aberta. Isso vive na cópia em memória e some no F5, voltando à linha de base.
 * É estado de TESTE — reset previsível vale mais que persistência falsa.
 */
import type {
  AgendaConfig,
  DiaBloqueado,
  WhatsAppConversation,
  WhatsAppMessage,
} from "../calendarApi";

// ─── Sorteio com semente ──────────────────────────────────────────────────────

/** PRNG minúsculo e determinístico. Mesma semente, mesma sequência, sempre. */
function mulberry32(semente: number) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Calendário ───────────────────────────────────────────────────────────────

export const DIAS_PARA_TRAS = 35;
export const DIAS_PARA_FRENTE = 21;

function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function iso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function somarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function hhmm(t: number): string {
  const h = Math.floor(t + 1e-9);
  const m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function paraDecimal(s: string): number {
  const [h, m] = String(s).split(":").map(Number);
  return h + (m || 0) / 60;
}

// ─── Profissionais ────────────────────────────────────────────────────────────

interface MoldeProf {
  id: number;
  nome: string;
  cor: string;
  inicio: number;
  fim: number;
  duracaoMin: number;
  intervaloIni: number;
  intervaloMin: number;
  /** Convenção JavaScript: 0 = domingo (`Date.getDay()`), igual ao banco. */
  diasSemana: number[];
  /** Quão cheia é a agenda dele, de 0 a 1. Barbeiro novo tem menos cliente. */
  procura: number;
}

const MOLDES: MoldeProf[] = [
  {
    id: 1,
    nome: "Lucas Costa",
    cor: "#4DA0EA",
    inicio: 9,
    fim: 19,
    duracaoMin: 40,
    intervaloIni: 12,
    intervaloMin: 60,
    diasSemana: [1, 2, 3, 4, 5, 6],
    procura: 0.72,
  },
  {
    id: 2,
    nome: "Rafael Dias",
    cor: "#5EC46C",
    inicio: 10,
    fim: 20,
    duracaoMin: 30,
    intervaloIni: 13,
    intervaloMin: 60,
    diasSemana: [1, 2, 3, 4, 5, 6],
    procura: 0.6,
  },
  {
    id: 3,
    nome: "Bruno Sales",
    cor: "#E8973A",
    inicio: 13,
    fim: 21,
    duracaoMin: 45,
    intervaloIni: 17,
    intervaloMin: 30,
    // O terceiro é meio-período e não trabalha segunda: serve para a tela ter
    // um caso de expediente diferente dos outros dois, que é onde a
    // disponibilidade e o relógio costumam quebrar.
    diasSemana: [2, 3, 4, 5, 6],
    procura: 0.45,
  },
];

export interface ProfMock {
  id: number;
  nome: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

export interface AgendamentoMock {
  id: number;
  professional_id: number;
  profissional: string;
  dia_marcado: string;
  hora_marcada: string;
  startTime: string;
  endTime: string;
  duracao_min: number;
  cliente: string;
  telefone: string;
  servico: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

/** A grade de um dia, em horas decimais, pulando o intervalo. */
export function gradeDoDia(m: MoldeProf, wd: number): number[] {
  if (!m.diasSemana.includes(wd)) return [];
  const passo = m.duracaoMin / 60;
  const intervaloFim = m.intervaloIni + m.intervaloMin / 60;
  const slots: number[] = [];
  for (let t = m.inicio; t + passo <= m.fim + 1e-9; t += passo) {
    const colide = t < intervaloFim && t + passo > m.intervaloIni;
    if (!colide) slots.push(t);
  }
  return slots;
}

// ─── Gente ────────────────────────────────────────────────────────────────────

const CLIENTES = [
  "Marcos Vinícius Alves",
  "Ana Paula Ribeiro",
  "Thiago Menezes",
  "Juliana Prado",
  "Rodrigo Alves Câmara",
  "Carla Nogueira",
  "Felipe Andrade",
  "Beatriz Lima",
  "Gustavo Teixeira",
  "Sofia Martins",
  "Diego Barreto",
  "Larissa Fontes",
  "Vinícius Duarte",
  "Camila Rezende",
  "Eduardo Pacheco",
  "Renata Siqueira",
  "Otávio Bastos",
  "Priscila Amorim",
  "Henrique Vasques",
  "Natália Coutinho",
  "Leandro Peixoto",
  "Mariana Beltrão",
  "Caio Figueiredo",
  "Isabela Monteiro",
];

/** Formato do banco: DDI + DDD + número, sem máscara (ver `ANEXO_BANCO`). */
function telefoneDe(i: number): string {
  return `5533${String(988000000 + i * 130777).slice(0, 9)}`;
}

const SERVICOS = [
  "Corte",
  "Corte + Barba",
  "Barba",
  "Pezinho",
  "Sobrancelha",
  "Corte + Sobrancelha",
];

// ─── Geração ──────────────────────────────────────────────────────────────────

function gerarAgendamentos(hoje: Date, agoraDec: number): AgendamentoMock[] {
  const sorteio = mulberry32(20260908);
  const linhas: AgendamentoMock[] = [];
  let id = 4100;

  for (let offset = -DIAS_PARA_TRAS; offset <= DIAS_PARA_FRENTE; offset += 1) {
    const dia = somarDias(hoje, offset);
    const dataISO = iso(dia);
    const wd = dia.getDay();

    const candidatos = MOLDES.flatMap((m) =>
      gradeDoDia(m, wd).map((slot) => ({
        m,
        slot,
        // Mantém quem tem mais procura aparecendo um pouco mais sem voltar a
        // preencher cada horário da grade.
        prioridade: sorteio() / m.procura,
      })),
    );

    const escolhidos = offset === 0
      ? MOLDES.slice(0, 2).flatMap((m) => {
          const grade = gradeDoDia(m, wd);
          const janelas = [
            { inicio: 13, fim: 18, alvo: 15 },
            { inicio: 18, fim: 22, alvo: 18.5 },
          ];

          return janelas.flatMap(({ inicio, fim, alvo }) => {
            const slot = grade
              .filter((hora) => hora >= inicio && hora < fim)
              .sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo))[0];
            return slot === undefined ? [] : [{ m, slot }];
          });
        })
      : candidatos
          .sort((a, b) => a.prioridade - b.prioridade)
          .slice(0, 2 + Math.floor(sorteio() * 4));

    for (const { m, slot } of escolhidos) {
      const passo = m.duracaoMin / 60;
      const iCliente = Math.floor(sorteio() * CLIENTES.length);
      const dado = sorteio();
      const passou = offset < 0 || (offset === 0 && slot + passo <= agoraDec);

      let status: string;
      if (passou) {
        // Cancelamento é minoria, e falta é minoria da minoria — a agenda de
        // uma barbearia que funciona é quase toda "concluído".
        status = dado < 0.11 ? "cancelado" : "concluido";
      } else {
        status = dado < 0.09 ? "reagendado" : "agendado";
      }

      // Marcado alguns dias antes do atendimento: é o que `created_at`
      // significa, e é dele que sai o KPI "Novas marcações".
      const criadoEm = somarDias(dia, -Math.floor(sorteio() * 6) - 1);
      criadoEm.setHours(9 + Math.floor(sorteio() * 11), 0, 0, 0);

      linhas.push({
        id: (id += 1),
        professional_id: m.id,
        profissional: m.nome,
        dia_marcado: dataISO,
        hora_marcada: hhmm(slot),
        startTime: hhmm(slot),
        endTime: hhmm(slot + passo),
        duracao_min: m.duracaoMin,
        cliente: CLIENTES[iCliente],
        telefone: telefoneDe(iCliente),
        servico: SERVICOS[Math.floor(sorteio() * SERVICOS.length)],
        status,
        // Dois terços entram pelo bot: é o que as 165 mensagens reais de
        // junho mostraram, e é o número que dá sentido ao painel existir.
        source: sorteio() < 0.66 ? "whatsapp" : "painel",
        created_at: criadoEm.toISOString(),
        updated_at: criadoEm.toISOString(),
      });
    }
  }

  linhas.sort((a, b) =>
    a.dia_marcado === b.dia_marcado
      ? a.hora_marcada.localeCompare(b.hora_marcada)
      : a.dia_marcado.localeCompare(b.dia_marcado),
  );
  return linhas;
}

/**
 * Garante um atendimento acontecendo AGORA, para o card "Em atendimento" e o
 * ponteiro do relógio terem em que cair. Só dentro do expediente — inventar
 * atendimento às 23h desenharia ponteiro fora da volta do relógio, que é pior
 * que não ter exemplo.
 */
function garantirEmAtendimento(
  linhas: AgendamentoMock[],
  hoje: Date,
  agoraDec: number,
): AgendamentoMock[] {
  const dataISO = iso(hoje);
  const wd = hoje.getDay();
  const m = MOLDES[0];
  const passo = m.duracaoMin / 60;
  const slot = gradeDoDia(m, wd).find(
    (s) => agoraDec >= s && agoraDec < s + passo,
  );
  if (slot === undefined) return linhas;

  const hora = hhmm(slot);
  const jaTem = linhas.find(
    (l) =>
      l.dia_marcado === dataISO &&
      l.professional_id === m.id &&
      l.hora_marcada === hora,
  );
  if (jaTem) {
    jaTem.status = "agendado";
    return linhas;
  }

  linhas.push({
    id: 9001,
    professional_id: m.id,
    profissional: m.nome,
    dia_marcado: dataISO,
    hora_marcada: hora,
    startTime: hora,
    endTime: hhmm(slot + passo),
    duracao_min: m.duracaoMin,
    cliente: "Vinícius Duarte",
    telefone: telefoneDe(12),
    servico: "Corte + Barba",
    status: "agendado",
    source: "whatsapp",
    created_at: somarDias(hoje, -2).toISOString(),
    updated_at: somarDias(hoje, -2).toISOString(),
  });
  linhas.sort((a, b) =>
    a.dia_marcado === b.dia_marcado
      ? a.hora_marcada.localeCompare(b.hora_marcada)
      : a.dia_marcado.localeCompare(b.dia_marcado),
  );
  return linhas;
}

// ─── Conversas ────────────────────────────────────────────────────────────────

interface MoldeConversa {
  nome: string;
  iCliente: number;
  status: WhatsAppConversation["status"];
  naoLidas: number;
  minutosAtras: number;
  linhas: { de: "cliente" | "bot" | "humano"; texto: string }[];
}

/**
 * Conversas com formato de conversa de verdade: o bot conduzindo por botões, o
 * cliente saindo do trilho, e o dono assumindo em algumas. Os três estados
 * (`bot`, `human`, `open`) existem aqui porque a lista pinta cada um diferente
 * — sem os três, metade do desenho da tela não aparece no teste.
 */
const MOLDES_CONVERSA: MoldeConversa[] = [
  {
    nome: "Marcos Vinícius Alves",
    iCliente: 0,
    status: "human",
    naoLidas: 2,
    minutosAtras: 4,
    linhas: [
      { de: "cliente", texto: "Boa tarde! Consigo encaixar hoje ainda?" },
      { de: "bot", texto: "Oi, Marcos! Deixa eu ver a agenda de hoje 👇" },
      { de: "bot", texto: "🔘 16:20\n🔘 17:00\n🔘 Outro dia" },
      { de: "cliente", texto: "Nenhum desses dá, tem algo depois das 18?" },
      { de: "humano", texto: "Opa Marcos, aqui é o Lucas. Consigo às 18:20, te serve?" },
      { de: "cliente", texto: "Serve sim!" },
      { de: "cliente", texto: "Pode marcar por favor" },
    ],
  },
  {
    nome: "Ana Paula Ribeiro",
    iCliente: 1,
    status: "bot",
    naoLidas: 0,
    minutosAtras: 26,
    linhas: [
      { de: "cliente", texto: "oi" },
      { de: "bot", texto: "Olá! Bem-vinda à Lucas Costa Barbearia ✂️\nComo posso ajudar?" },
      { de: "bot", texto: "🔘 Agendar horário\n🔘 Ver meus agendamentos\n🔘 Falar com atendente" },
      { de: "cliente", texto: "🔘 Agendar horário" },
      { de: "bot", texto: "Com qual profissional?" },
      { de: "cliente", texto: "🔘 Rafael Dias" },
      { de: "bot", texto: "Perfeito. Qual dia fica melhor?" },
    ],
  },
  {
    nome: "Thiago Menezes",
    iCliente: 2,
    status: "open",
    naoLidas: 1,
    minutosAtras: 71,
    linhas: [
      { de: "cliente", texto: "Bom dia, vocês abrem no feriado?" },
      { de: "bot", texto: "Bom dia! Essa eu não sei responder — já chamei o Lucas aqui 👋" },
      { de: "cliente", texto: "Beleza, obrigado" },
    ],
  },
  {
    nome: "Juliana Prado",
    iCliente: 3,
    status: "bot",
    naoLidas: 0,
    minutosAtras: 143,
    linhas: [
      { de: "cliente", texto: "queria remarcar o de quinta" },
      { de: "bot", texto: "Claro! Achei seu horário: quinta, 15:00 com o Lucas." },
      { de: "bot", texto: "🔘 Remarcar\n🔘 Cancelar\n🔘 Deixar como está" },
      { de: "cliente", texto: "🔘 Remarcar" },
      { de: "bot", texto: "Certo. Para qual dia?" },
    ],
  },
  {
    nome: "Rodrigo Alves Câmara",
    iCliente: 4,
    status: "bot",
    naoLidas: 0,
    minutosAtras: 320,
    linhas: [
      { de: "cliente", texto: "🔘 Confirmar" },
      { de: "bot", texto: "Agendamento confirmado ✅\nSexta, 11:20 · Corte + Barba · Rafael Dias\n\nAté lá!" },
    ],
  },
  {
    nome: "Carla Nogueira",
    iCliente: 5,
    status: "human",
    naoLidas: 3,
    minutosAtras: 480,
    linhas: [
      { de: "cliente", texto: "Oi, o corte do meu filho pode ser junto com o meu?" },
      { de: "humano", texto: "Oi Carla! Pode sim, só preciso marcar dois horários seguidos." },
      { de: "cliente", texto: "Ah entendi" },
      { de: "cliente", texto: "E fica quanto os dois?" },
      { de: "cliente", texto: "É pra sábado de manhã" },
    ],
  },
  {
    nome: "Felipe Andrade",
    iCliente: 6,
    status: "closed",
    naoLidas: 0,
    minutosAtras: 1490,
    linhas: [
      { de: "cliente", texto: "valeu pelo corte 👊" },
      { de: "humano", texto: "Nós que agradecemos, Felipe! Até a próxima." },
    ],
  },
  {
    nome: "Beatriz Lima",
    iCliente: 7,
    status: "bot",
    naoLidas: 0,
    minutosAtras: 2880,
    linhas: [
      { de: "cliente", texto: "Vicctor" },
      { de: "bot", texto: "Só confirmando o nome: *Vicctor*, certo?" },
      { de: "cliente", texto: "Victor, sem os dois c" },
      { de: "bot", texto: "Corrigido: *Victor* ✅" },
    ],
  },
];

export interface ConversaMock {
  conversa: WhatsAppConversation;
  mensagens: WhatsAppMessage[];
}

function gerarConversas(agora: Date): ConversaMock[] {
  return MOLDES_CONVERSA.map((molde, i) => {
    const contatoId = 500 + i;
    const conversaId = 700 + i;
    const ultima = new Date(agora.getTime() - molde.minutosAtras * 60_000);

    // Cada linha da conversa recuando 3 minutos: a última é a mais nova, que é
    // a que a lista mostra na prévia.
    const mensagens: WhatsAppMessage[] = molde.linhas.map((linha, j) => {
      const quando = new Date(
        ultima.getTime() - (molde.linhas.length - 1 - j) * 3 * 60_000,
      );
      const entrada = linha.de === "cliente";
      return {
        id: conversaId * 100 + j,
        conversation_id: conversaId,
        contact_id: contatoId,
        direction: entrada ? "inbound" : "outbound",
        sender_type:
          linha.de === "cliente" ? "customer" : linha.de === "bot" ? "bot" : "human",
        whatsapp_message_id: `wamid.MOCK${conversaId}${j}`,
        message_type: linha.texto.includes("🔘") ? "interactive" : "text",
        body: linha.texto,
        media_id: null,
        status: entrada ? null : "delivered",
        created_at: quando.toISOString(),
        received_at: quando.toISOString(),
      };
    });

    const fim = mensagens[mensagens.length - 1];

    return {
      conversa: {
        id: conversaId,
        status: molde.status,
        assigned_to: molde.status === "human" ? "Proprietário" : null,
        last_message_at: fim.created_at,
        unread_count: molde.naoLidas,
        contact: {
          id: contatoId,
          phone: telefoneDe(molde.iCliente),
          wa_id: telefoneDe(molde.iCliente),
          name: molde.nome,
          // A janela de 24h da Meta, materializada como no banco de verdade:
          // `last_message_at + 24h`. Fora dela só template aprovado passa.
          service_window_until: new Date(
            new Date(fim.created_at).getTime() + 24 * 3600_000,
          ).toISOString(),
        },
        last_message: {
          direction: fim.direction,
          sender_type: fim.sender_type,
          message_type: fim.message_type,
          body: fim.body,
          created_at: fim.created_at,
        },
      },
      mensagens,
    };
  });
}

// ─── O mundo ──────────────────────────────────────────────────────────────────

export interface Mundo {
  hoje: Date;
  profissionais: ProfMock[];
  agendamentos: AgendamentoMock[];
  conversas: ConversaMock[];
  agendaConfig: Map<number, AgendaConfig>;
  bloqueios: DiaBloqueado[];
  proximoIdEvento: number;
}

function construir(): Mundo {
  const agora = new Date();
  const hoje = inicioDoDia(agora);
  const agoraDec = agora.getHours() + agora.getMinutes() / 60;

  const agendamentos = garantirEmAtendimento(
    gerarAgendamentos(hoje, agoraDec),
    hoje,
    agoraDec,
  );

  const agendaConfig = new Map<number, AgendaConfig>(
    MOLDES.map((m) => [
      m.id,
      {
        profissional_id: m.id,
        dias_semana: m.diasSemana,
        hora_inicio: hhmm(m.inicio),
        hora_fim: hhmm(m.fim),
        duracao_min: m.duracaoMin,
        intervalo_inicio: hhmm(m.intervaloIni),
        intervalo_duracao_min: m.intervaloMin,
        janela_agendamento_dias: 14,
        atualizado_em: somarDias(hoje, -9).toISOString(),
      },
    ]),
  );

  // Dois bloqueios, um de dia inteiro e um só de um período: é o par mínimo
  // para a faixa de disponibilidade mostrar os dois desenhos.
  const bloqueios: DiaBloqueado[] = [
    {
      id: 91,
      data: iso(somarDias(hoje, 3)),
      motivo: "Consulta médica",
      periodos: ["afternoon"],
      created_at: somarDias(hoje, -5).toISOString(),
    },
    {
      id: 92,
      data: iso(somarDias(hoje, 9)),
      motivo: "Curso de barbearia",
      periodos: null,
      created_at: somarDias(hoje, -5).toISOString(),
    },
  ];

  return {
    hoje,
    profissionais: MOLDES.map((m) => ({
      id: m.id,
      nome: m.nome,
      cor: m.cor,
      ativo: true,
      created_at: somarDias(hoje, -120).toISOString(),
    })),
    agendamentos,
    conversas: gerarConversas(agora),
    agendaConfig,
    bloqueios,
    proximoIdEvento: 9500,
  };
}

/** Singleton do módulo: nasce no primeiro import e vive enquanto a aba viver. */
export const mundo: Mundo = construir();

export function moldeDe(id: number): MoldeProf | undefined {
  return MOLDES.find((m) => m.id === id);
}

export { MOLDES };
