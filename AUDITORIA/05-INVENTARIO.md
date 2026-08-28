# 05 — Inventário: o que é útil, o que é peso morto

O pedido incluía "as coisas úteis e as inúteis". Esta é a separação.

## O que é muito bom e deve ser preservado

Vale dizer isto primeiro, porque um mantenedor novo tende a reescrever o que não
entende — e aqui há coisas que custaria caro perder.

**1. O roteador do bot é uma função pura.** `fluxo/rotear.ts` (744 linhas) não
toca banco nem rede: recebe contexto, devolve ações. É por isso que existem 195
testes rodando em 519 ms sem um único mock de infraestrutura. Se algo for
refatorado, esta propriedade é a última coisa a se abrir mão.

**2. O estado da conversa é derivado, não gravado.** Não existe coluna de estado
nem TTL: o bot deduz onde a conversa está lendo o que ele mesmo respondeu em
`webhook_eventos`. Substituiu três usos de Redis sem serviço novo. Dois resets
saem de graça (virada do dia em São Paulo, e toque em botão) sem rotina de
limpeza. É a melhor ideia do sistema.

**3. Os três segredos separados.** `CALENDARIO_WEBHOOK_TOKEN` (bot→calendário),
`PAINEL_TOKEN` (calendário→bot) e `ADMIN_API_TOKEN` (painel→API) são valores
distintos de propósito, para que um vazamento não abra as duas direções. Raro ver
esse cuidado num projeto deste porte.

**4. A documentação de decisões.** ~3.900 linhas em `REGRAS-APRENDIZADOS/`,
registrando o PORQUÊ e as alternativas descartadas. Vários comentários no código
explicam bugs reais já corridos — o de `>=` vs `>` em `lerEscada`, o da etapa do
nome que reperguntava no Confirmar. Isso é memória institucional; apagar sai caro.

**5. A convenção `ponytail:`.** 16 marcações no código, cada uma declarando um
teto conhecido e o gatilho de quando trocar. É dívida técnica *rastreável* em vez
de escondida.

**6. `buildTokenGuard`.** 503 quando não configurado (falha fechada), comparação
em tempo constante. Bem escrito — o problema é o segredo estar no bundle, não o guard.

---

## Estado da faxina (2026-08-28)

**Executado** no commit `44e60ab` — 5 arquivos, 246 linhas:
`ui/IconInput.tsx`, `ui/SegmentedControl.tsx`, `docs/resposta.md`,
`CALENDARIO/metadata.json`, `.impeccable/critique/`. Verificado depois: `tsc`
limpo nas duas pastas, `vite build` fechando, 195 testes passando.

**Mantido por decisão do dono:** `CALENDARIO/android/`, `capacitor.config.ts` e
as três dependências `@capacitor/*`. A análise abaixo fica registrada, mas a
escolha foi manter o caminho nativo aberto — não é esquecimento.

## Peso morto — o levantamento

### `.agents/skills/` — 3,6 MB, 193 arquivos — **NÃO é lixo** (correção)

A primeira versão desta auditoria mandava apagar. **Estava errado.** O
`.gitignore` da raiz documenta que isto é deliberado:

> Skills instaladas por `npx skills add` vivem em `.agents/skills/` (padrão aberto
> Agent Skills). O instalador cria junctions em `.claude/skills/` apontando pra lá —
> versionar as duas cópias duplicaria o conteúdo. **Origem versionada: `.agents/`.**

São três skills, todas com veredito registrado em `docs/skills-log.md`:

| Skill | Tamanho | Situação |
|---|---|---|
| `supabase` | 40 kB | no `skills-lock.json`, curada |
| `supabase-postgres-best-practices` | 160 kB | no `skills-lock.json`, curada |
| `impeccable` | **3,4 MB (153 arq.)** | copiada à mão, adoção parcial |

**O que continua verdade:** o `impeccable` é 94% do volume, e entrou em 02/08
(`baea9f6`, "só a skill e sem hook nenhum") para as rodadas de vistoria de design
do mobile. Não é tocado desde então. Se a frente de design visual continuar, é
ferramenta legítima; se não, são 3,4 MB parados.

**Detalhe desta máquina:** as junctions de `.claude/skills/` são gitignoradas e
eram do Windows. Aqui elas não existem — então as três skills de `.agents/` estão
**inertes**, não carregadas. Isso não é defeito, mas explica por que elas não
aparecem em uso hoje.

**Veredito:** decisão de curadoria, não faxina. O `CLAUDE.md` tem processo próprio
para isso.

### `.impeccable/critique/` — 20 kB, 1 arquivo

Saída de uma execução do `$impeccable critique` em 02/08. O backlog que ela gerou
já foi transcrito para o fim do `ANEXO-PLANO-LAPIDACAO.md`, então o arquivo em si
é resíduo de execução. **Removido** em `44e60ab`.

Ressalva registrada na hora de apagar: o backlog de 7 itens realmente estava
transcrito, mas a **tabela de notas** (16/40 em dez heurísticas) só existia ali.
É medição pontual de 02/08, e o git preserva — mas se um dia se quiser comparar a
evolução do design, a linha de base está naquele commit, não no anexo.

### `CALENDARIO/android/` + `@capacitor/*` — app Android abandonado

Scaffolding completo do Capacitor: `build.gradle`, `MainActivity.java`, splash
screens em 10 densidades, ícones em 5. Mas:

- `@capacitor/*` só aparece em `capacitor.config.ts` — nenhum código importa;
- **não há script `cap sync` / `cap build`** no `package.json`;
- o PWA (VitePWA) já entrega instalação no celular, e é o caminho que a
  documentação descreve e que foi realmente testado.

São três dependências (`@capacitor/android`, `cli`, `core`) instaladas em todo
build do Vercel para nada.

**Veredito: MANTIDO** (decisão do dono, 28/08). O caminho nativo fica aberto.

Fica registrado o que a análise achou, para quando isso for retomado: o
`android/` entrou em `4f2294f` ("Trazer a pasta CALENDARIO intacta"), e **não é
mencionado no `CALENDARIO/README.md`**, que documenta o que a poda cortou — ou
seja, ele sobreviveu por omissão, não por escolha. Agora é por escolha.

### Componentes órfãos

| Arquivo | Linhas | Importado por |
|---|---|---|
| ~~`components/ui/IconInput.tsx`~~ | 23 | ninguém — **removido** |
| ~~`components/ui/SegmentedControl.tsx`~~ | 49 | ninguém — **removido** |

Conferido com busca de `import` em todo `.ts`/`.tsx`. **Removidos** em `44e60ab`. O git guarda, se voltarem a ser necessários.

### `docs/resposta.md` — 36 linhas

Resposta de uma LLM, em julho, sobre escolhas de stack ("use Hono em vez de
Fastify", "Postgres em vez de Redis"). Todas essas decisões **já foram tomadas,
implementadas e registradas em `REGRAS.md`** com muito mais contexto.

Hoje é um documento que só pode confundir: aconselha coisas que ou já foram
feitas, ou foram decididas ao contrário depois.

**Removido** em `44e60ab`.

### `CALENDARIO/metadata.json`

`{"name", "description", "requestFramePermissions": [], "majorCapabilities": []}`
— formato de uma plataforma de scaffolding (AI Studio), não lido por Vite,
Capacitor ou Vercel. Sobra do gerador.

**Removido** em `44e60ab`.

### `ANEXO-PLANO-LAPIDACAO.md` — 405 linhas

Plano de cinco frentes de lapidação mobile, **já executado** (registrado em
`REGRAS.md`, 2026-08-04). O próprio `CONTEXTO.md` diz que ele "pode ser
esvaziado/removido" depois da validação no celular.

**Veredito:** não apagar ainda — a validação no aparelho nunca aconteceu. Mas está
na fila de limpeza, e o backlog no fim dele precisa de um lar antes.

---

## Zona cinzenta — decidir, não apagar no automático

**`three` (Three.js).** Usado de verdade, em um arquivo só, para a animação de
fundo do login. Não é código morto — é uma escolha cara. Ver risco 7 em
[04-RISCOS.md](04-RISCOS.md).

**`BARBEARIA/ferramentas/funil.mjs`.** CLI de análise de funil que ninguém
menciona na documentação. Não é lixo — parece ferramenta de diagnóstico real. Vale
perguntar ao dono se ainda serve antes de mexer.

~~`CALENDARIO/assets/4b5627d79bc66c97c95c39ec56cdaf20.jpg`~~ — **identificado**: é
usado pelo `EventModal.tsx`. Os três assets da pasta estão em uso (o `.svg` no
`PresencialFAB`, o logo no `LoginScreen`). Nenhum é órfão.

---

## Contas rápidas

| | |
|---|---|
| Linhas de código do projeto (sem `.agents`, sem `android/`) | 25.195 |
| Dessas, linhas de teste | 3.309 (todas no bot) |
| Testes | 195 (todos no bot) |
| Documentação em markdown | ~3.900 linhas |
| Arquivos em `.agents/` (101 `.mjs` + 81 `.md`) | 193 |
| Linhas de `.mjs`/`.js` em `.agents/` | 64.040 |
| Arquivos apagáveis com segurança (sem `.agents/`) | 57 |

Em contagem de arquivos, metade do repositório é `.agents/` — e 94% disso é a
skill `impeccable`. Mas isso é acervo de ferramenta versionado de propósito, não
sujeira: a faxina de verdade são os **57 arquivos** da lista acima, e o maior
bloco deles é o `android/` que passou batido pela poda de 30/07.
