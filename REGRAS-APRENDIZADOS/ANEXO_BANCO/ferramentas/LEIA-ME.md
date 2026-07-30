# Ferramentas de leitura do banco

Dois scripts Node que leem o Supabase e escrevem o resultado num arquivo. Foram o que
gerou o conteúdo deste anexo em 2026-07-30.

- **`ler-schema.mjs`** — estrutura: tabelas, contagem de linhas, colunas com tipo/nulo/
  default, constraints, índices, políticas de RLS, views, funções, triggers, enums.
- **`ler-dados.mjs`** — conteúdo real das tabelas de configuração, distribuições de valores,
  amostras (telefone mascarado), definição das funções, extensões, schemas, storage buckets.

## Como rodar

Ambos leem a `DATABASE_URL` de `BARBEARIA/.env` e **nunca imprimem a senha**.

Precisam do driver `pg`, que não é dependência do projeto. Instale num diretório temporário
para não sujar o `package.json` do `BARBEARIA/`:

```bash
mkdir -p /tmp/lerbanco && cd /tmp/lerbanco && npm install pg
```

Depois, **de dentro desse diretório** (o `require('pg')` resolve a partir do cwd):

```bash
node "C:/Users/victo/Desktop/SAAS-BARBEARIA/REGRAS-APRENDIZADOS/ANEXO_BANCO/ferramentas/ler-schema.mjs" schema.md
```

```bash
node "C:/Users/victo/Desktop/SAAS-BARBEARIA/REGRAS-APRENDIZADOS/ANEXO_BANCO/ferramentas/ler-dados.mjs" dados.md
```

O argumento é o arquivo de saída. Leia o `.md` gerado em vez de rolar o terminal — o
console local não exibe acentuação corretamente.

## Avisos

- São scripts de **leitura**. Não alteram nada. Mas a conexão é com usuário `postgres`, que
  tem permissão total — cuidado ao adaptá-los.
- `ler-dados.mjs` imprime **dado real** (nomes de clientes, agendamentos). Telefones são
  mascarados; nomes não. Não colar a saída inteira em lugar público.
- Se o schema mudar muito, atualize os arquivos numerados do anexo — eles são um retrato
  datado, não um espelho automático.
