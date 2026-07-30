import type pg from 'pg';

export type Contato = {
  /** `true` quando esta foi a primeira mensagem que esse numero mandou. */
  novo: boolean;
  /**
   * Nome que o cliente informou ao fechar um agendamento, ou `undefined`.
   * E o unico sinal que liga a saudacao personalizada.
   */
  nome: string | undefined;
};

/**
 * Cadastra o contato na primeira mensagem dele e devolve o cadastro.
 *
 * Repare que nao ha "consulta se existe, depois insere": isso seriam duas idas ao
 * banco e uma corrida no meio — duas mensagens simultaneas do mesmo numero
 * passariam as duas pela consulta e criariam duas linhas. Aqui quem decide e o
 * indice UNIQUE: se o insert entrou, e cliente novo; se o banco recusou, ja existia.
 *
 * O `union all` sobre a CTE existe porque `on conflict do nothing` nao devolve nada
 * quando o conflito acontece — e no caso comum (cliente que ja escreveu antes) e
 * justamente o nome dele que precisamos. As duas pernas se excluem pelo `not exists`,
 * entao volta sempre uma linha so, numa ida ao banco.
 *
 * `do nothing` e nao `do update`: um update por mensagem recebida geraria versao morta
 * de linha em todo "oi", sem nada pra atualizar.
 *
 * ponytail: o cadastro guarda telefone e nome. Teto: nao guarda quando falou pela
 * ultima vez nem a janela de 24h da Meta. Gatilho de upgrade: o lembrete, que precisa
 * saber se a janela de servico ainda esta aberta (hoje esse campo so existe em
 * `whatsapp_contacts`).
 */
export async function registrarContato(
  cliente: pg.PoolClient,
  telefone: string,
): Promise<Contato> {
  const { rows } = await cliente.query<{ nome: string | null; novo: boolean }>(
    `with criado as (
       insert into dados_cliente (telefone)
       values ($1)
       on conflict (telefone) where telefone is not null do nothing
       returning nome
     )
     select nome, true as novo from criado
     union all
     select nome, false as novo
       from dados_cliente
      where telefone = $1
        and not exists (select 1 from criado)`,
    [telefone],
  );

  const linha = rows[0];

  return { novo: linha?.novo ?? false, nome: linha?.nome ?? undefined };
}
