# 04 — Riscos e defeitos, ranqueados

Ordem por "quanto dói e quão provável". Cada item diz onde está, como se
manifesta e o que resolve.

---

## 🔴 1. Não há autenticação — o login é decorativo

**Onde:** `CALENDARIO/components/LoginScreen.tsx:395-436`, `App.tsx:36-50`

O painel tem tela de login com e-mail e senha. Ela não protege nada, por dois
caminhos independentes:

**(a) Sem credencial no build, qualquer coisa entra.** O código diz isso
explicitamente:

```js
if (!CREDENCIAL_NO_BUILD) {
  onLogin({ name: 'Proprietário', email: email || 'proprietario', remember });
  return;   // ← entrou. Sem conferir nada.
}
```

**(b) Com credencial no build, ela é pública.** `VITE_OWNER_EMAIL` e
`VITE_OWNER_PASSWORD` são compiladas no bundle que qualquer visitante baixa. Pior:
a senha vai como `defaultValue` do campo (`LoginScreen.tsx:525`), ou seja, chega
**pré-preenchida no formulário**.

A sessão é só `localStorage`; não há token de sessão, expiração ou validação no
servidor.

**Isto está documentado como decisão consciente** — o comentário no código explica
que `VITE_*` nunca protegeu nada e que "quem protege dado é o token do lado da
API". O raciocínio está certo. O problema é o item 2.

## 🔴 2. O token que protege a API também é público

**Onde:** `CALENDARIO/services/calendarApi.ts:10`

```js
const ADMIN_API_TOKEN = (import.meta.env.VITE_ADMIN_API_TOKEN ?? "").trim();
```

Toda variável `VITE_*` é assada no bundle como texto literal. O token que abre as
rotas de admin está, portanto, legível para qualquer um que abra o `.js` da página.

Somando 1 e 2: **o painel publicado não tem nenhuma camada de autenticação real.**
Com o token do bundle abre-se:

- `GET /agendamentos` — nome, telefone, serviço e horário de todo cliente;
- `GET /whatsapp/conversations` e `/messages` — o conteúdo das conversas;
- `PATCH`/`DELETE /agendamentos/:id` — alterar e apagar a agenda;
- `POST /whatsapp/.../send` — **mandar mensagem no WhatsApp em nome da barbearia**.

O último é o pior: não é só vazamento, é uso indevido do canal oficial da empresa.

**O que resolve:** a arquitetura precisa de um backend de sessão. O caminho mais
curto e honesto é uma rota `POST /login` na API que confere credencial contra o
banco (hash) e devolve um cookie `HttpOnly` de sessão; o `ADMIN_API_TOKEN` deixa
de existir no cliente. É trabalho real — mas não há meia-solução aqui: qualquer
segredo que o navegador precise conhecer é um segredo público.

**Enquanto não for feito:** hoje o dado está protegido só porque o banco caiu. O
banco voltar sem isto resolvido reabre a porta.

## 🔴 3. O banco não existe, e o repositório não sabe recriá-lo

Detalhado em [02-BANCO.md](02-BANCO.md). Sete das dez tabelas não têm DDL em lugar
nenhum. Bloqueia rodar local **e** no ar. É o item que precisa sair primeiro,
porque quase todo o resto depende dele.

---

## 🟠 4. Rota de API com mais de um segmento dá 404 no Vercel

**Onde:** `api/[...caminho].mjs` + `vercel.json`

Conferido no ar em 28/08. Só o primeiro nível chega ao Fastify:

```
/api/profissionais                     → chega (500, porque o banco caiu)
/api/rota-inexistente                  → chega (404 do Fastify)
/api/dashboard/resumo                  → 404 do VERCEL, não chega
/api/profissionais/1/agenda            → 404 do VERCEL
/api/agendamentos/dias-disponiveis     → 404 do VERCEL
/api/whatsapp/conversations            → 404 do VERCEL
```

Somem: Dashboard, config de agenda, dias e horários disponíveis, CRM de Conversas
— **e todo o caminho que o bot vai usar quando subir**.

**A pista:** o Fastify recebe a querystring `?...caminho=rota-inexistente`, com os
três pontos **dentro do nome do parâmetro**. Num catch-all de verdade o Vercel
passaria `?caminho=...`. O que ele gerou foi uma rota de segmento único chamada
`...caminho` — ele leu `[...caminho].mjs` como `[X]` com `X` = `...caminho`.

Descartado: o nome do arquivo está correto byte a byte (`5b2e 2e2e 6361…`), sem
BOM nem caractere invisível — não é o defeito de 05/08 se repetindo.

**Conserto proposto (não aplicado):** parar de depender da inferência do nome de
arquivo. Renomear para `api/servidor.mjs` e declarar a rota no `vercel.json`:

```json
"rewrites": [
  { "source": "/api/(.*)", "destination": "/api/servidor" },
  { "source": "/((?!api(?:/|$)).*)", "destination": "/index.html" }
]
```

O `req.url.replace(/^\/api(?=\/|$)/, '')` do handler funciona nos dois casos, então
não muda.

**Limite da certeza:** o mecanismo é inferência a partir da assinatura do
parâmetro — consistente, mas a prova seria a tabela de rotas que o Vercel gera, que
exige `vercel build` autenticado. E o conserto só se confirma deployando.

## 🟠 5. A API inteira não tem um único teste

`CALENDARIO/server.js` tem **2.501 linhas e zero testes**. Não há script de `test`,
`typecheck` ou lint no `package.json` do calendário.

E é justamente ali que mora a lógica mais perigosa do sistema: cálculo de horários
disponíveis, verificação de conflito de agendamento, janela de 24h da Meta,
normalização de datas com fuso.

O contraste com o bot é gritante — 195 testes, roteador puro e testável. **A
mesma equipe fez os dois.** A diferença não é capacidade, é que o `server.js` foi
herdado de outro app (`Aplicativo-FULL`) e nunca passou pelo mesmo tratamento.

**O que resolve:** não é "escrever 195 testes para o server.js". É começar pelas
três funções de cálculo puro que dá para extrair sem tocar em rota nenhuma:
disponibilidade de horário, janela de agendamento, conflito de reserva. São as que
quebram calado.

## 🟠 6. Fuso horário depende de uma linha frágil

**Onde:** `CALENDARIO/server.js:20`

```js
process.env.TZ = process.env.TZ || "America/Sao_Paulo";
```

O comentário explica bem o risco: as funções de data perguntam a hora ao processo,
não ao banco. Num host UTC, a antecedência mínima de 15 min e a virada do dia
ficam 3 horas fora — **sem erro e sem log**, só oferecendo ou recusando horário
errado.

A correção está certa, mas é global e implícita. O bot resolve o mesmo problema de
forma melhor: passa o fuso explícito no SQL (`date_trunc('day', now() at time zone
$2)`). Dois padrões diferentes para o mesmo problema no mesmo sistema.

---

## 🟡 7. Bundle de 986 kB, e um terço é uma animação de login

`three` (Three.js) é importado em **um único arquivo**: `LoginScreen.tsx`, para uma
animação de fundo em WebGL. É a maior dependência do projeto, carregada na
primeira tela, antes de o usuário ver qualquer coisa útil — e num PWA que o dono
abre no celular, provavelmente em 4G.

O próprio build avisa (`chunks are larger than 500 kB`). O conserto barato é
`import()` dinâmico da tela de login; o conserto honesto é perguntar se a animação
vale o peso.

## 🟡 8. Rate limit em memória não sobrevive a serverless

Detalhado em [03-ROTAS.md](03-ROTAS.md). Cada instância tem seu próprio balde; com
N instâncias o teto efetivo é N×, e um restart zera. Vale como amortecedor, não
como proteção.

## 🟡 9. `agendamentos.profissional` é texto sem FK

Decisão travada em `REGRAS.md` (2026-07-30), então não é descuido — mas o novo
mantenedor precisa saber o preço: **renomear um barbeiro órfã os agendamentos dele
em silêncio.** Todo JOIN do sistema é `a.profissional = p.nome`.

Enquanto isso valer, o nome nunca pode ser digitado — tem que vir da tabela. O bot
já respeita isso (`src/db/profissionais.ts`).

## 🟡 10. A senha do banco vazou em uma sessão anterior

Registrado em `CONTEXTO.md`: durante o diagnóstico de 05/08, a senha do banco
apareceu numa linha de saída. Se a conversa daquela sessão estiver em lugar
compartilhado, a senha deve ser trocada. Como o banco não existe mais, isso é
questão de higiene — mas entra na lista para não ser esquecido ao recriar.

---

## Divergências entre a documentação e o código (corrigidas aqui)

Achadas ao conferir os documentos contra o repositório em 28/08:

1. **`CONTEXTO.md` dizia que `/api/profissionais` e `/api/agendamentos`
   respondiam 200 com dado real.** Não respondem. E `/api/agendamentos` dando 200
   nunca foi prova de banco no ar: ela é protegida por token, e o 401 é o
   comportamento certo dela. *(Já corrigido no `CONTEXTO.md`.)*
2. **`CONTEXTO.md` marcava trabalho como "ainda não commitado"** que já estava
   commitado. *(Já corrigido.)*
3. **A tabela de ambiente do `CONTEXTO.md` é da máquina Windows anterior.** O
   projeto está em Linux agora, e o `ngrok.cmd` não se aplica. *(Já anotado.)*
4. **O lockfile do bot marcava `pg` como dependência de dev**, divergindo do
   `package.json`. Só apareceria no dia de um `npm ci --omit=dev`, derrubando o bot
   na primeira consulta. *(Corrigido e commitado em `fb02357`.)*
