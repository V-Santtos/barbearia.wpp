import type pg from 'pg';

/**
 * Cadastra o contato na primeira mensagem dele e devolve **se era a primeira**.
 *
 * Repare que nao ha "consulta se existe, depois insere": isso seriam duas idas ao
 * banco e uma corrida no meio — duas mensagens simultaneas do mesmo numero
 * passariam as duas pela consulta e criariam duas linhas. Aqui quem decide e o
 * indice UNIQUE: se o insert entrou, e cliente novo; se o banco recusou, ja
 * existia. Uma consulta, sem corrida.
 *
 * ponytail: grava so o telefone, como pedido pra validar a regra. Teto: nao guarda
 * nome, nem quando falou pela ultima vez, nem a janela de 24h da Meta. Gatilho de
 * upgrade: o lembrete, que precisa saber se a janela de servico ainda esta aberta
 * (hoje esse campo so existe em `whatsapp_contacts`).
 */
export async function registrarContato(cliente: pg.PoolClient, telefone: string): Promise<boolean> {
  const inserido = await cliente.query(
    `insert into dados_cliente (telefone)
     values ($1)
     on conflict (telefone) where telefone is not null do nothing
     returning id`,
    [telefone],
  );

  return (inserido.rowCount ?? 0) > 0;
}
