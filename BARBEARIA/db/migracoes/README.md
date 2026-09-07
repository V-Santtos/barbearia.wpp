# Migrações

Toda mudança de estrutura no banco (`create table`, `alter table`, índice, política de RLS,
função, trigger) entra aqui como arquivo `.sql`. Nada de DDL aplicado direto no painel do
Supabase ou por `npm run db` — o que não está nesta pasta não existe.

**Nome do arquivo:** `AAAAMMDDHHMMSS_nome_em_snake_case.sql` — o mesmo padrão do CLI do
Supabase, e o histórico é gravado na mesma tabela (`supabase_migrations.schema_migrations`),
para não haver duas versões da verdade sobre o que já foi aplicado.

```bash
cd BARBEARIA && npm run db:migrar -- --lista
```

```bash
cd BARBEARIA && npm run db:migrar
```

O comando sem flag é **ensaio**: executa o SQL de verdade e dá `ROLLBACK`. É como se
descobre erro de sintaxe, constraint violada ou coluna que já existe, sem sujar o banco.
Só `--gravar` efetiva:

```bash
cd BARBEARIA && npm run db:migrar -- --gravar
```

Cada arquivo roda na sua própria transação, em ordem de nome. Se o terceiro falhar, os dois
primeiros ficam aplicados e a execução para ali — não pula por cima de migração quebrada.

## Ao escrever uma migração

- **RLS: ligue explicitamente, sempre.** Havia um event trigger (`ensure_rls`) fazendo isso
  sozinho — mas ele era hardening do projeto Supabase **antigo** e não existe no atual
  (medido: `pg_event_trigger` volta vazio). Confiar nele deixou `webhook_eventos` aberta sem
  ninguém notar, justo a tabela com o payload cru de toda mensagem. Toda tabela nova leva
  `alter table ... enable row level security` na própria migração. Tabela com RLS e sem
  política **nega tudo pela API pública, em silêncio** — 0 linhas, sem erro; se ela vai ser
  lida por lá, a política entra junto.
- **`not null` em coluna nova quebra o código que está no ar.** Migração e deploy não são
  atômicos entre si, e no intervalo o insert do código antigo falha. Ou a coluna nasce com
  `default`/gatilho de transição, ou o `not null` espera o deploy. Ver
  `20260904120100` e `20260904120200`, que fazem os dois e declaram a data de morte de cada
  dispositivo.
- **Idempotência ajuda, mas não é obrigatória** (`if not exists`, `create or replace`): o
  registro em `schema_migrations` já impede reaplicação.
- **`rollback` não é automático.** A coluna existe na tabela de histórico e está vazia. Se a
  mudança for perigosa, escreva o SQL de volta como comentário no fim do arquivo.

## A partir de 28/08/2026, esta pasta recria o banco do zero

Isto mudou, e mudou porque doeu. O banco original foi perdido em 08/2026 e o repositório
não sabia refazê-lo: das 10 tabelas que o código usa, esta pasta criava **uma**. As outras
sete vieram do `Aplicativo-FULL` e da era n8n, criadas fora de migração, e só existiam
dentro do Supabase.

`20260730120000_base_do_esquema_herdado.sql` fecha esse buraco. Ela é datada **antes** de
todas as outras, então num banco vazio a cadeia roda inteira e na ordem:

```
20260730120000  base            -> cria as 9 tabelas herdadas
20260730140000  webhook_eventos -> cria a 10ª
20260730160000  dados_cliente   -> unique no telefone + default em created_at
20260730180000  dados_cliente   -> renomeia nomewpp -> nome
20260730180100  webhook_eventos -> acao text -> text[]
20260730190000  agenda_prof.    -> janela 7..15 -> 4..10
20260828120000  webhook_eventos -> RLS explícito (o event trigger não existe mais)
20260904120000  barbearias      -> a tabela de tenant, e a loja atual
20260904120100  8 tabelas       -> barbearia_id + uniques de telefone por loja
20260904120200  agendamentos    -> profissional_id com FK (era só o nome)
20260904120300  agendamentos    -> a trava de double-booking que faltava
```

**A base reproduz o estado PRÉ-migrações de propósito** (`nomewpp` com esse nome, sem
unique no telefone, janela em 7..15). Não "consertar" isso: migração que se antecipa à
própria história transforma as seguintes em enfeite. O cabeçalho do arquivo explica cada
caso.

**Ela é reconstrução por inferência, não dump.** Cada coluna foi derivada das consultas que
a tocam. As incertezas estão nomeadas uma a uma em `AUDITORIA/02-BANCO.md` — ler de lá
antes de tratar qualquer tipo como verdade absoluta.

O histórico anterior a nós tem 4 entradas de 17/05/2026 e é **parcial**. Ele continua
parcial; o que mudou é que ele deixou de ser o único caminho.
