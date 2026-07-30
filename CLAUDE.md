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

## Estado do repositório

`BARBEARIA/` (raiz) é onde o código do aplicativo vai morar — `package.json`,
`tsconfig.json`, `src/`, tudo que for codado entra ali dentro, não solto na raiz
do repo. Ainda não existe esqueleto nenhum lá (pasta vazia até agora) — só
documentação de arquitetura e decisões nas outras pastas. Não assumir que
build/lint/test existem até o esqueleto ser criado (ver `CONTEXTO.md` para o
status exato).

Git local apenas, sem remote configurado ainda.

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
