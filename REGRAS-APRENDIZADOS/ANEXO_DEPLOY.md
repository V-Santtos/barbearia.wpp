# Deploy (Vercel)

O que o código não conta sobre a hospedagem. Estrutura do build está no `vercel.json` e em
`api/[...caminho].mjs` — não copio aqui, envelhece calado.

Projeto `barbearia-wpp` (`prj_RXjV1C0jHrivg3Et6JX2iKj98p32`, org
`team_w0A0NnPfJXAOX9Yeloh2thFN`), ligado ao GitHub `V-Santtos/barbearia.wpp`, branch `main`.
Push em `main` já dispara deploy de produção. CLI autenticada como `v-santtos`.

## Um projeto só, de propósito (2026-08-05)

Painel e API moram no mesmo projeto Vercel, servidos pelo mesmo domínio: a API responde em
`/api`, mesma origem do painel. Isso é o que **elimina CORS** e mantém um único conjunto de
variáveis e um único domínio para o PWA instalar.

Separar em projetos distintos (API num, painel noutro) foi levantado e **descartado**: não
resolveria nenhum defeito real, triplicaria os lugares onde colar variável errado e traria
CORS de volta. O bot é outra história — é a única peça que fala com a Meta, tem tokens
próprios e ainda não subiu.

## Variáveis de ambiente — três armadilhas

**1. Variável de Production nasce *sensitive*, e sensitive é cega.** `vercel env pull`
devolve a linha **vazia** (`CHAVE=""`) para elas. Isso não significa que a variável está
vazia — significa que não dá para ler. Diagnosticar configuração com `env pull` engana:
gravar com `--no-sensitive` é o que devolve a visibilidade.

**2. Gravar pelo pipe do PowerShell corrompe o valor.**
`Get-Content -Raw | vercel env add` prefixa um **BOM (U+FEFF)** invisível. Numa URL isso
mata o esquema e a conexão morre com um erro que não fala de codificação nenhuma (ver
`APRENDIZADOS.md`, 2026-08-05). Ajustar `$OutputEncoding` não resolve. O caminho que
funciona é mandar os bytes por Node:

```js
spawnSync('npx', ['vercel','env','add','NOME','production','--force','--yes'],
  { input: Buffer.from(valor, 'utf8'), shell: true });
```

Depois de gravar, **conferir os códigos dos caracteres** do valor lido de volta — não a
aparência dele na tela, que é justamente onde o defeito se esconde.

**3. `--force` sobrescreve sem precisar apagar.** `vercel env add NOME production --force`
substitui a existente; não é preciso `env rm` (que, além de destrutivo, some com o valor
antigo sem volta).

`VITE_*` é assada no bundle **em tempo de build** — mudar exige deploy novo, e o valor fica
visível para qualquer visitante (a própria CLI avisa). Quem protege dado é o
`ADMIN_API_TOKEN` do lado da API, e ele precisa ser **idêntico** ao `VITE_ADMIN_API_TOKEN`,
senão o painel toma 401. Token ausente dá **503**, token diferente dá **401** — dá para
distinguir os dois casos só pelo código de resposta.

## Ler o que está acontecendo no ar

Log de execução da função sai por MCP (`get_runtime_logs`) ou pelo painel. Duas coisas que
custaram tempo: `get_runtime_errors` não pega erro que a aplicação trata e devolve como 500
(volta "nenhum erro"), e o filtro `level: error` **não** acha a linha de erro do pino, que
o Vercel classifica como `info`. Puxar sem filtro e ler o corpo.

O banco não é do Vercel — é o Supabase de sempre. Como falar com ele de dentro de uma
função (pooler, IPv4/IPv6) está em [`ANEXO_BANCO/README.md`](ANEXO_BANCO/README.md), seção
"Ao ligar o banco de fora da sua máquina".
