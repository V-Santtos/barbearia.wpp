import { Hono } from 'hono';
import { buscarDias, buscarHorarios, marcar } from './calendario/api.js';
import { criarEspelho } from './calendario/crm.js';
import type { Env } from './config/env.js';
import { obterPool } from './db/cliente.js';
import { registrarEDecidir, type AlvoAgenda } from './db/eventos.js';
import type { Agenda } from './fluxo/acoes.js';
import { criarEmissor } from './whatsapp/enviar.js';
import { criarRotasPainel } from './whatsapp/painel.js';
import { criarRotasWebhook, type Dependencias } from './whatsapp/webhook.js';

/**
 * Monta o app. Fica separado do `index.ts` (que sobe o servidor Node) pra que
 * o mesmo Hono possa ser exportado como handler serverless na Vercel sem
 * duplicar rota, e pra que os testes montem o app sem abrir porta.
 */
export function criarApp(env: Env, deps: Dependencias = dependenciasReais(env)): Hono {
  const app = new Hono();

  app.get('/saude', (c) => c.json({ ok: true, servico: 'barbearia-bot' }));

  app.route('/webhook/whatsapp', criarRotasWebhook(env, deps));
  app.route('/mensagens', criarRotasPainel(env, deps));

  return app;
}

/**
 * Ponto de composicao: e aqui, e so aqui, que banco e Cloud API sao ligados no
 * fluxo. O teste passa `deps` proprias e nao encosta em nenhum dos dois.
 */
export function dependenciasReais(env: Env): Dependencias {
  const pool = obterPool(env.DATABASE_URL);
  const agenda = consultarAgenda(env.CALENDARIO_URL);

  return {
    registrar: (evento, decidir) => registrarEDecidir(pool, evento, decidir, agenda),
    enviar: criarEmissor(env),
    // Sem token, o espelho simplesmente nao existe e o bot funciona igual — o painel
    // e que fica sem a conversa. Melhor que derrubar o servico na subida por causa de
    // uma integracao opcional.
    ...(env.CALENDARIO_WEBHOOK_TOKEN
      ? { espelho: criarEspelho(env.CALENDARIO_URL, env.CALENDARIO_WEBHOOK_TOKEN) }
      : {}),
  };
}

/**
 * Traduz a pergunta do fluxo ("quais dias?", "quais horarios?") na chamada HTTP
 * correspondente, e qualquer falha em `fora_do_ar`.
 *
 * O motivo tecnico da falha (timeout, 500, corpo torto) morre aqui, no log: pro fluxo
 * as tres significam a mesma coisa — nao da pra oferecer horario agora. Vazar isso pro
 * roteador so daria a ele a chance de errar a frase.
 */
function consultarAgenda(base: string) {
  return async (alvo: AlvoAgenda): Promise<Agenda> => {
    // Marcar e o unico alvo que ESCREVE. Sai por cima porque ele nao tem `dados` pra
    // extrair — o que importa e ter dado certo, e o `409` tem frase propria.
    if (alvo.tipo === 'marcar') {
      const marcacao = await marcar(base, {
        // Nome do barbeiro vindo da tabela `profissionais`, nunca digitado: a trava
        // de double-booking do banco compara texto, e nome torto passaria batido.
        barbeiro: alvo.barbeiro.nome,
        cliente: alvo.cliente,
        telefone: alvo.telefone,
        data: alvo.data,
        hora: alvo.hora,
      });

      if (marcacao.tipo === 'falhou') {
        console.error(
          JSON.stringify({ nivel: 'error', evento: 'calendario.marcacao.falhou', alvo }),
        );
        return { tipo: 'fora_do_ar' };
      }

      console.log(
        JSON.stringify({
          nivel: 'info',
          evento: 'calendario.marcacao',
          resultado: marcacao.tipo,
          barbeiro: alvo.barbeiro.nome,
          data: alvo.data,
          hora: alvo.hora,
        }),
      );

      return marcacao;
    }

    const consulta =
      alvo.tipo === 'dias'
        ? await buscarDias(base, alvo.barbeiro)
        : await buscarHorarios(base, alvo.barbeiro, alvo.data);

    if (!consulta.ok) {
      console.error(
        JSON.stringify({
          nivel: 'error',
          evento: 'calendario.consulta.falhou',
          alvo,
          motivo: consulta.motivo,
        }),
      );
      return { tipo: 'fora_do_ar' };
    }

    return alvo.tipo === 'dias'
      ? { tipo: 'dias', dias: (consulta.dados as { data: string }[]).map((dia) => dia.data) }
      : { tipo: 'horarios', data: alvo.data, horarios: consulta.dados as string[] };
  };
}
