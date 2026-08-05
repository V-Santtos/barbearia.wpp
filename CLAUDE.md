# CLAUDE.md

Instruções operacionais para trabalhar neste repositório. Só o que não dá pra
descobrir lendo o código — porque, por enquanto, não há código pra ler.

## Leia nesta ordem, toda sessão nova

1. **`CONTEXTO.md`** (raiz) — memória de curto prazo: o que estamos fazendo agora,
   o que já foi validado, qual o próximo passo. É o primeiro arquivo a checar
   quando a sessão for resetada, para retomar de onde parou.
2. **`REGRAS-APRENDIZADOS/README.md`** — mecanismo de memória de longo prazo
   (regras, aprendizados, conhecimento por tema). Ver `REGRAS.md` para decisões
   travadas antes de sugerir qualquer mudança de arquitetura.
3. **`docs/skills-log.md`** — todo repositório/skill já avaliado para este
   projeto, com veredito e motivo. Consultar antes de reavaliar algo do zero.

## Regra de curadoria (não descoberta pelo código)

Todo repositório, skill ou conhecimento externo trazido pelo usuário passa por:
avaliação crítica de encaixe → busca cruzada (find-skills + GitHub) só se fizer
sentido → checagem de sobreposição com `REGRAS-APRENDIZADOS/` e
`docs/skills-log.md` → registro do veredito. Nunca adotar um repositório inteiro
quando só uma parte serve. Nunca instalar nada sem passar por esse processo,
mesmo que pareça bom à primeira vista (ver rejeições de `ruvnet/ruflo` e
`affaan-m/ECC` no skills-log — ambos tinham estrelas reais, mas sobrepunham o
que já temos).

## Como trabalhar: uma etapa por vez

O projeto avança **por partes**, e o usuário conduz a ordem. Responder o que foi
perguntado e parar ali. **Não** fechar respostas com lacunas de escopo, riscos
futuros, incoerências que "lá na frente vão dar problema" ou próximos passos que
ele não abriu — ele já sabe o que está faltando, e o momento de trazer isso é a
etapa de lapidação, que ele pede quando for. Observação relevante fora da etapa
vai para anexo em `REGRAS-APRENDIZADOS/` e fica lá, calada, até ser perguntada.
Ver `REGRAS-APRENDIZADOS/APRENDIZADOS.md` (entrada de 2026-07-30).

## Acesso ao banco (não descoberto pelo código)

O banco do case atual é o Supabase ref `sppexvjvnoganlduyjvs` (PostgreSQL 17.6),
o mesmo que o fluxo n8n usava. Acesso por **conexão direta Postgres**:
`DATABASE_URL` no `BARBEARIA/.env` (coberto pelo `.gitignore`), usuário
`postgres`, com **leitura e escrita**.

**Não existe cópia do schema no repositório, e isso é regra, não lacuna.** Para
saber estrutura, tipo de coluna, contagem ou conteúdo, **pergunte ao banco** — nunca
a um markdown, que envelhece calado. Ferramentas em `BARBEARIA/ferramentas/`
(`pg` já instalado), rodando de dentro de `BARBEARIA/`:

- `npm run db -- "<sql>"` — consulta ou alteração; **rollback no fim** por padrão,
  `--gravar` efetiva.
- `npm run db:migrar` — aplica `db/migracoes/*.sql`; ensaia por padrão.
- `npm run db:schema` / `db:dados` — retrato completo num arquivo, quando precisar
  do panorama de uma vez. A saída fica fora do git (tem dado real de cliente).

Toda mudança de estrutura entra como migração em `BARBEARIA/db/migracoes/` — nunca
DDL avulso, nunca pelo painel do Supabase.

O que fica versionado em **`REGRAS-APRENDIZADOS/ANEXO_BANCO/`** é só o que consulta
não responde: `README.md` (as armadilhas — ler antes de mexer em banco) e
`DECIDIR.md` (o que ainda não foi decidido).

Armadilha número um, a que morde primeiro: um event trigger (`ensure_rls`) liga RLS
automaticamente em toda tabela criada no schema `public`. Tabela nova sem política
**nega tudo pela API pública, em silêncio** (0 linhas, sem erro).

O MCP oficial do Supabase está em `.mcp.json` mas nunca foi aprovado (exige sessão
interativa) — não é o caminho de acesso, a conexão direta é.

## Estado do repositório

`BARBEARIA/` (raiz) é onde o código do aplicativo vai morar — `package.json`,
`tsconfig.json`, `src/`, tudo que for codado entra ali dentro, não solto na raiz
do repo. Já existe esqueleto do webhook (Hono + TypeScript, sem ORM ainda) — ver
`CONTEXTO.md` para o que está lá. Não assumir que lint existe.

Remote no GitHub: `https://github.com/V-Santtos/barbearia.wpp` (branch `main`).

## Ferramentas locais já disponíveis (não óbvias)

`yt-dlp`, `ffmpeg` e `faster-whisper` (modelos `small`/`medium`, Python) já estão
instalados na máquina — usados para transcrever vídeos (Instagram/Facebook/etc.)
trazidos como fonte de conhecimento. Fluxo: `yt-dlp` baixa → `ffmpeg` extrai áudio
mono 16kHz → `faster-whisper` transcreve em PT. Escrever a transcrição em arquivo
UTF-8 antes de ler (o console local não exibe acentuação corretamente).

## Convenção `ponytail:`

Simplificação deliberada com teto conhecido leva um comentário
`ponytail: <teto>, <gatilho de upgrade>` no código (ver `REGRAS.md`). Rodar a
skill `ponytail-debt` periodicamente para revisar o ledger dessas marcações.
