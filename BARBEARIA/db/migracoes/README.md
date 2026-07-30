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

O histórico anterior a nós tem 4 entradas de 17/05/2026 e é **parcial** — as tabelas
originais foram criadas fora de migração. Não dá para recriar este banco do zero a partir
dele; o retrato do estado atual está em `REGRAS-APRENDIZADOS/ANEXO_BANCO/`.
