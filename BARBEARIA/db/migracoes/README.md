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

- **RLS:** um event trigger (`ensure_rls`) liga RLS em toda tabela nova de `public`. Tabela
  criada sem política **nega tudo pela API pública, em silêncio** — 0 linhas, sem erro. Se a
  tabela vai ser lida pela API, a política entra na mesma migração.
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
