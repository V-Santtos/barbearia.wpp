import { Hono } from 'hono';
import type { Env } from '../config/env.js';
import { compararSegredos } from './assinatura.js';
import type { Emissor } from './enviar.js';

/**
 * A porta por onde o painel do dono manda o bot falar.
 *
 * Existe porque **so este servico fala com a Cloud API**. Dar o `WHATSAPP_TOKEN` ao
 * calendario resolveria o envio em cinco linhas e criaria o problema caro: duas
 * implementacoes do mesmo payload, em linguagens e arquivos diferentes, divergindo
 * em silencio na primeira mudanca de versao da Meta.
 *
 * O que sai daqui e texto puro, sempre. Cartao com opcoes e coisa do fluxo, que
 * roteia por id de botao — se o dono pudesse montar um, os ids teriam que sair de
 * algum lugar, e nao ha lugar.
 */
export type DependenciasPainel = {
  enviar: Emissor;
};

export function criarRotasPainel(env: Env, deps: DependenciasPainel): Hono {
  const rotas = new Hono();

  rotas.post('/', async (c) => {
    // Sem token configurado a porta simplesmente nao abre. Mesma escolha do espelho:
    // integracao opcional nao derruba o servico na subida, so deixa de existir.
    if (!env.PAINEL_TOKEN) {
      console.warn(JSON.stringify({ nivel: 'warn', evento: 'painel.envio.desligado' }));
      return c.json({ erro: 'Envio pelo painel não está configurado neste bot.' }, 503);
    }

    const token = c.req.header('x-painel-token');
    if (!token || !compararSegredos(token, env.PAINEL_TOKEN)) {
      console.warn(
        JSON.stringify({
          nivel: 'warn',
          evento: 'painel.envio.recusado',
          tokenRecebido: Boolean(token),
        }),
      );
      return c.json({ erro: 'Token inválido.' }, 403);
    }

    const corpo = await c.req.json().catch(() => undefined);
    const para = typeof corpo?.para === 'string' ? corpo.para.trim() : '';
    const texto = typeof corpo?.texto === 'string' ? corpo.texto.trim() : '';

    if (!para || !texto) {
      return c.json({ erro: '`para` e `texto` são obrigatórios.' }, 400);
    }

    try {
      const wamid = await deps.enviar({
        tipo: 'enviar_texto',
        para,
        // A mensagem do dono nao faz parte do fluxo: nao vira estado, nao mira dica
        // de escada, nao entra na trava de rajada. `feedback` e so o rotulo mais
        // proximo disso no tipo — nada le este campo neste caminho.
        resposta: 'feedback',
        texto,
      });

      console.log(
        JSON.stringify({ nivel: 'info', evento: 'painel.envio.ok', para, wamid }),
      );

      return c.json({ wamid }, 200);
    } catch (erro) {
      // O 502 e deliberado: quem falhou foi a Meta, nao quem chamou. O calendario
      // depende disso pra NAO gravar no painel uma mensagem que nunca saiu.
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.error(
        JSON.stringify({ nivel: 'error', evento: 'painel.envio.falhou', para, motivo }),
      );

      return c.json({ erro: 'A Meta recusou o envio.', motivo }, 502);
    }
  });

  return rotas;
}
