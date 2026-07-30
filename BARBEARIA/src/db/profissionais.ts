import type pg from 'pg';
import type { Barbeiro } from '../fluxo/acoes.js';

/**
 * Os barbeiros que a barbearia tem hoje, ativos, em ordem estavel.
 *
 * A ordem e por `id` de proposito: e a ordem de cadastro, ela nao muda sozinha, e o
 * cliente que viu "Lucas Costa" em primeiro ontem ve o mesmo hoje. Ordenar por nome
 * faria a lista se reorganizar sozinha no dia em que alguem corrigisse um cadastro.
 *
 * `ativo = false` some da lista inteira: some da pergunta, e tambem deixa de valer
 * como resposta, porque o roteador so aceita um `b=` que esteja aqui dentro.
 */
export async function lerBarbeirosAtivos(cliente: pg.PoolClient): Promise<Barbeiro[]> {
  const { rows } = await cliente.query<{ id: string; nome: string }>(
    `select id, nome
       from profissionais
      where ativo is true
      order by id`,
  );

  // `id` e bigint, e o driver entrega bigint como string pra nao perder precisao.
  return rows.map((linha) => ({ id: Number(linha.id), nome: linha.nome }));
}
