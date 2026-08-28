# 06 — Como levantar o sistema

Estado em 28/08: dependências **já instaladas** nas duas pastas (feito nesta
auditoria). Falta banco e `.env`.

## O portão

**Sem banco, nada sobe.** Não há Postgres nesta máquina (o `psql` é só cliente), e
o repositório não sabe recriar o schema — ver [02-BANCO.md](02-BANCO.md). Essa é a
primeira tarefa, não um detalhe de configuração.

Três caminhos, do mais rápido ao mais correto:

1. **Achar um dump do Supabase antigo.** Resolve tudo e responde as incertezas do
   schema. Vale procurar antes de qualquer coisa.
2. **Postgres local em container** — bom para desenvolver, zero custo, e força o
   repositório a saber reconstruir o ambiente (que é a dívida a pagar de qualquer
   forma):
   ```bash
   docker run -d --name barbearia-db \
     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=barbearia \
     -p 5432:5432 postgres:17
   # DATABASE_URL=postgresql://postgres:local@localhost:5432/barbearia
   ```
   Atenção: o código usa `ssl: { rejectUnauthorized: false }` fixo nos dois
   serviços. Contra Postgres local sem SSL isso precisa de ajuste — é a única
   mudança de código que este caminho exige.
3. **Supabase novo.** Mais fiel ao ambiente de produção (inclusive o event trigger
   `ensure_rls`), mas volta a depender de serviço externo e de plano free que pausa
   sozinho — foi o que provocou esta situação.

## Os dois `.env`

São arquivos seus (segredo não passa por mim nem vai para o git). Gerar os tokens
inventados com `openssl rand -hex 24`.

### `CALENDARIO/.env` — serve a API **e** o painel

```bash
DATABASE_URL=postgresql://...        # o único que não dá para inventar
PORT=3334

ADMIN_API_TOKEN=<gerar>
VITE_ADMIN_API_TOKEN=<o MESMO valor acima>

WHATSAPP_WEBHOOK_TOKEN=<gerar>       # = CALENDARIO_WEBHOOK_TOKEN do bot
BOT_PAINEL_TOKEN=<gerar>             # = PAINEL_TOKEN do bot
BOT_URL=http://localhost:3333

CORS_ORIGINS=http://localhost:3002
VITE_CALENDAR_API_URL=http://localhost:3334
VITE_OWNER_EMAIL=voce@exemplo.com
VITE_OWNER_PASSWORD=<qualquer coisa>  # não protege nada — ver risco 1
```

### `BARBEARIA/.env`

Os cinco primeiros são **obrigatórios** — sem eles o processo nem sobe
(`carregarEnv()` lança e lista o que falta):

```bash
META_APP_SECRET=<da Meta>
WHATSAPP_VERIFY_TOKEN=<você inventa, e cola igual no painel da Meta>
WHATSAPP_TOKEN=<da Meta>
WHATSAPP_PHONE_NUMBER_ID=<da Meta>
DATABASE_URL=<o mesmo do calendário>

PORT=3333                            # o padrão do código é 3000, não 3333
CALENDARIO_URL=http://localhost:3334
CALENDARIO_WEBHOOK_TOKEN=<= WHATSAPP_WEBHOOK_TOKEN do calendário>
PAINEL_TOKEN=<= BOT_PAINEL_TOKEN do calendário>
```

## O atalho que economiza um dia

**O painel e a API sobem sem nenhuma credencial da Meta.** São dois dos três
processos, e cobrem calendário, Dashboard, modais e o CRM (vazio). Só precisam do
`CALENDARIO/.env`.

A Meta só é necessária para o bot conversar de verdade. E se quiser ver o bot
falando com a API sem a Meta no meio, **valores de mentira nas quatro variáveis
dela fazem o processo subir normal** — só a verificação de assinatura de webhook
real falharia.

Ou seja: dá para ter o sistema inteiro utilizável em desenvolvimento sem tocar no
painel da Meta uma única vez.

## Subir

Cada um em background, nunca no terminal onde você trabalha:

```bash
cd CALENDARIO && npm run server   # API,    porta 3334
cd CALENDARIO && npm run dev      # painel, porta 3002
cd BARBEARIA  && npm run dev      # bot,    porta 3333
```

Conferir:

```bash
curl localhost:3334/            # health da API
curl localhost:3334/profissionais
curl localhost:3333/saude       # health do bot
```

Para o webhook real da Meta é preciso um túnel (ngrok) apontando para a 3333, e
recolar a URL no painel da Meta a cada reinício — o `ANEXO_WHATSAPP_META/` cobre
isso.

## Para acessar do celular

`VITE_CALENDAR_API_URL` e `CORS_ORIGINS` precisam do **IP da máquina**, não
`localhost` (regra registrada em `REGRAS.md`, 2026-08-04). O Vite já sobe em
`0.0.0.0`.

O service worker do PWA **só existe no build** — conferir PWA de verdade é
`npm run build && npm run preview`, que reusa a mesma porta 3002 de propósito.

## Checagens disponíveis

| Comando | Onde | Estado em 28/08 |
|---|---|---|
| `npm run typecheck` | `BARBEARIA/` | ✅ limpo |
| `npm test` | `BARBEARIA/` | ✅ 195 testes |
| `npx tsc --noEmit` | `CALENDARIO/` | ✅ limpo |
| `npm run build` | `CALENDARIO/` | ✅ passa |

Não há lint em nenhuma das duas pastas, e o calendário não tem script de `test`
nem de `typecheck` (o `tsc` acima roda direto). Adicionar os dois scripts ao
`package.json` do calendário é ganho barato.

## Ordem sugerida de trabalho

1. Procurar dump do banco antigo.
2. Recriar o schema como migração `000_base` versionada, e um seed com as
   patologias reais.
3. Levantar API + painel local, sem Meta.
4. Só então: resolver a autenticação (riscos 1 e 2) — antes de qualquer coisa
   voltar ao ar.
5. Depois: o 404 do Vercel (risco 4), que só se confirma deployando.
