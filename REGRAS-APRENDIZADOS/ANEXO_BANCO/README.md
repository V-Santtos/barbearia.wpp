# Anexo: Banco de dados atual (Supabase `sppexvjvnoganlduyjvs`)

> **Este anexo descreve o banco COMO ELE ESTÁ HOJE, não como ele deve ficar.**
>
> É o banco do case antigo — nasceu para o app de calendário (`Aplicativo-FULL`) e para o
> fluxo n8n, ambos aposentados ou em revisão. Nada aqui é decisão travada. Cada regra,
> coluna, nome e constraint documentado aqui vai ser **discutido um a um** nas próximas
> sessões: mantém, lapida, troca ou remove.
>
> O que virar decisão nossa vai para `REGRAS-APRENDIZADOS/REGRAS.md`, explicitamente.
> Até lá, isto é levantamento de terreno.

- **Projeto Supabase:** ref `sppexvjvnoganlduyjvs`, PostgreSQL **17.6**
- **Data da leitura:** 2026-07-30
- **Como foi lido:** conexão direta Postgres (`DATABASE_URL` em `BARBEARIA/.env`), leitura
  de `information_schema` + `pg_catalog` + dados reais das tabelas pequenas
- **Acesso:** leitura **e escrita** (usuário `postgres`). Posso criar, alterar e apagar.
- **Confirmado:** é o mesmo projeto que o fluxo n8n usava (o ref bate com as queries do
  `ANEXO_FLUXO_N8N.md`).

## Índice

| Arquivo | Conteúdo |
|---|---|
| [`01-INVENTARIO.md`](01-INVENTARIO.md) | As 12 tabelas, contagens, mapa de relações, migrações, extensões, storage |
| [`02-AGENDA-DISPONIBILIDADE.md`](02-AGENDA-DISPONIBILIDADE.md) | `profissionais`, `agenda_profissional`, `dias_bloqueados`, `agendamentos` — o motor da agenda |
| [`03-SERVICOS-CONFIG.md`](03-SERVICOS-CONFIG.md) | `servicos`, `categorias_servicos`, `configuracao`, `documentos_bot` |
| [`04-ESTADO-BOT.md`](04-ESTADO-BOT.md) | `dados_cliente` — onde o estado da conversa vivia |
| [`05-MENSAGERIA.md`](05-MENSAGERIA.md) | `whatsapp_contacts`, `whatsapp_conversations`, `whatsapp_messages` |
| [`06-SEGURANCA-RLS.md`](06-SEGURANCA-RLS.md) | Grants, RLS sem políticas, event trigger `ensure_rls`, funções |
| [`07-A-DECIDIR.md`](07-A-DECIDIR.md) | **Tudo que precisa ser averiguado ou discutido**, com o achado e a pergunta |

## Como reler o banco numa sessão nova

Os scripts de leitura estão em [`ferramentas/`](ferramentas/). Eles leem a `DATABASE_URL`
do `BARBEARIA/.env` e **não imprimem a senha**.

Precisam do driver `pg`, que **não é dependência do projeto** — instale num diretório
temporário para não sujar o `package.json` do `BARBEARIA/`:

```bash
mkdir -p /tmp/lerbanco && cd /tmp/lerbanco && npm install pg
```

Depois, rodando de dentro desse diretório:

```bash
node "C:/Users/victo/Desktop/SAAS-BARBEARIA/REGRAS-APRENDIZADOS/ANEXO_BANCO/ferramentas/ler-schema.mjs" schema.md
```

```bash
node "C:/Users/victo/Desktop/SAAS-BARBEARIA/REGRAS-APRENDIZADOS/ANEXO_BANCO/ferramentas/ler-dados.mjs" dados.md
```

`ler-schema.mjs` gera estrutura (tabelas, colunas, tipos, constraints, índices, políticas).
`ler-dados.mjs` gera o conteúdo real das tabelas de configuração e as distribuições de
valores, com telefone mascarado.

**Alternativa por MCP:** existe um servidor MCP oficial do Supabase configurado em
`.mcp.json` (escopo de projeto), mas ele ficou pendente de aprovação/OAuth e **não é o
caminho usado** — a conexão direta resolveu. Ver `07-A-DECIDIR.md`.
