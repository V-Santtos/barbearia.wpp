# CONTEXTO.md

Memória de **curto prazo**: onde estamos agora e qual o próximo passo. Muda a
cada etapa. Ler primeiro ao retomar uma sessão resetada.

O que é durável não mora aqui — mora em `REGRAS-APRENDIZADOS/`. Se uma seção
deste arquivo continuar verdadeira daqui a três meses, ela está no lugar errado.

## O projeto

SaaS de agendamento para barbearias. V1 = bot de botões no WhatsApp + calendário
próprio para o dono atender. Escopo completo em `docs/superpowers/specs/`.

Duas pastas de código, e a **integração entre elas é o trabalho de agora**:

| Pasta | O quê | Porta |
|---|---|---|
| `BARBEARIA/` | o bot (Hono + TypeScript + `pg`) | 3333 |
| `CALENDARIO/` | API de agenda (Fastify) + painel do dono (React) | 3334 + 3002 |

A 3000 desta máquina é do dev server do portfólio. Os dois serviços já sobem
juntos — foram os dois na 3333 até 2026-07-30.

Os dois falam com o **mesmo banco**: Supabase `sppexvjvnoganlduyjvs`. Acesso e
armadilhas em `REGRAS-APRENDIZADOS/ANEXO_BANCO/`.

## Onde estamos (2026-07-30)

**O bot responde e conversa.** Mensagem chega → traduzida → registrada → contato
cadastrado → roteada → resposta. Saudação por faixa de horário, menu em lista,
escolha do barbeiro vinda de `profissionais where ativo`, escada de feedback para
quem digita fora do trilho. Rodou ponta a ponta no celular do usuário.

138 testes passando, `npm run typecheck` limpo, fluxo exercitado contra o banco
real. Os porquês de cada decisão de desenho estão em `REGRAS-APRENDIZADOS/REGRAS.md`
(entradas de 2026-07-30) — **o que cada arquivo faz, o código responde melhor.**

**A conversa aparece no painel do dono.** O bot espelha os dois lados no CRM do
calendário. Verificado contra o endpoint real; falta ver na tela.

**O agendamento vai até a pergunta do nome.** Barbeiro → dia → horário → "me manda seu
nome e sobrenome". A resposta a essa última pergunta **ainda não é tratada** — cai na
escada de feedback, com uma dica dizendo que a parte está sendo montada.

**O calendário entrou no ambiente** em 2026-07-30, importado de
`github.com/V-Santtos/Aplicativo-FULL` e podado para o nosso escopo (dois
commits: `4f2294f` intacto, `6a3760a` a poda). Ver `CALENDARIO/README.md`.

## PRIMEIRA COISA AO RETOMAR (deixado em 2026-07-30, à noite)

**O usuário parou sem testar.** O passo dia/horário e o espelho do CRM foram escritos,
verificados contra o banco real e commitados — mas o teste de celular ficou para a
sessão seguinte. **Comece subindo o ambiente, sem esperar ele pedir.**

### 1. Subir os três serviços e o túnel

São três processos, cada um numa pasta, mais o ngrok. **Todos em background.**

| O quê | Onde | Comando | Porta |
|---|---|---|---|
| Bot (Hono) | `BARBEARIA/` | `npm run dev` | 3333 |
| API do calendário (Fastify) | `CALENDARIO/` | `npm run server` | 3334 |
| Painel do dono (React/Vite) | `CALENDARIO/` | `npm run dev` | 3002 |

O túnel é **um só**, e aponta para o bot — só ele recebe da Meta. O ngrok não roda
pelo Bash (`Exec format error`); vai por PowerShell:

```
Start-Process -FilePath "ngrok.cmd" -ArgumentList "http","3333" -WindowStyle Hidden
```

Pegar a URL pública em `http://127.0.0.1:4040/api/tunnels` e conferir que os três
respondem (`3333/saude` → 200, `3334/` → 200, `3002/` → 200; a raiz da 3333 dá 404,
e isso é o certo — ela só tem `/saude` e `/webhook/whatsapp`).

**A URL do ngrok muda a cada sessão.** Entregar ao usuário a URL completa, com o
caminho, para ele colar em Webhooks → Conta comercial do WhatsApp:
`<url-do-ngrok>/webhook/whatsapp`. O verify token não muda.

### 2. Zerar o estado antes do teste

```bash
cd BARBEARIA && npm run db -- "delete from webhook_eventos where de = '553384246770'" -- --gravar
```

As três tabelas `whatsapp_*` foram deixadas **zeradas** de propósito, para o primeiro
teste do CRM ser inequívoco.

### 3. O que pedir para ele reparar no teste

1. **O cartão em formato `button`** — é a única peça que a Meta ainda **não aceitou na
   prática**. Todo o teste de 30/07 caiu em lista, porque toda tela teve mais de 3
   opções. Precisa de um dia com **3 horários ou menos**; à noite o dia corrente serve
   (o Lucas Costa trabalha até 23:00, então perto do fim do dia sobram poucos slots).
   Conferir que **header e rodapé aparecem** — foi a premissa corrigida.
2. **A conversa no painel (3002)**, os dois lados, na ordem, com o cartão legível.
3. **O ritmo das duas mensagens** em cada passo — a curta primeiro.
4. **O nome na lista de conversas do painel:** enquanto ele não fechar um agendamento,
   aparece o nome do perfil do WhatsApp (comportamento de reserva que ele escolheu).

### 4. Depois do teste: a decisão que está esperando

**A rota depois da pergunta do nome** — é o que ficou explicitamente para decidir com
ele. O bot já pede nome e sobrenome e ninguém trata a resposta. O fluxo antigo fazia:
valida o nome → card de conferência com 3 botões → `POST /agendamentos`. A validação
de nome do n8n é a única parte que a realidade escreveu (anexo do n8n, seção 9) e vale
como material, não como regra.

Nada mais está bloqueado.

## O passo DIA E HORÁRIO: feito em 2026-07-30

A lógica de disponibilidade **já existia e é boa** — está na API do calendário, não
em função SQL. Duas rotas resolvem o passo:

- `GET /agendamentos/dias-disponiveis?professionalId=` — quais dias têm vaga.
  **O bot não manda `days=` de propósito:** sem o parâmetro, a rota usa a janela que o
  dono configurou (`agenda_profissional.janela_agendamento_dias`). Uma régua só.
- `GET /agendamentos/horarios-disponiveis?professionalId=&date=` — os horários de
  um dia
- `POST /agendamentos` — marca, revalidando tudo e tratando o índice único.
  **Ainda não é chamado por ninguém** — é a próxima fatia.

A janela da agenda passou de 7–15 para **4–10 dias** (migração `20260730190000`),
porque uma lista do WhatsApp aceita 10 linhas. A barra existe em duas telas do painel
(`AgendaSettingsModal` e `Sidebar`) e as duas leem a mesma constante.

**Latência medida contra o banco real:** a primeira consulta do processo leva ~4,8s
(abre a conexão com o Supabase), as seguintes ~0,9s. A API é local, mas o banco dela
não. O teto do `fetch` é 8s por causa disso.

### Decidido em 2026-07-30: o bot fala por HTTP, e os dois rodam local

**Caminho: HTTP na API do calendário.** A regra de disponibilidade não está em
SQL — são sete funções JavaScript no `server.js`, com sutilezas (o slot tem o
tamanho da `duracao_min` *daquele* profissional; a fronteira manhã/tarde nasce do
intervalo de descanso dele). Ir direto ao banco significaria reescrever tudo isso
no bot e conviver com duas implementações da mesma regra. Elas divergiriam, e o
sintoma seria o pior tipo: painel mostrando um horário livre e bot oferecendo
outro, **sem erro e sem log**.

O contra-argumento óbvio — "amarra o bot a um segundo serviço" — não se sustenta:
o painel do dono não funciona sem essa API, então ela está no ar de qualquer
jeito. E há precedente: o site público consumia exatamente esses endpoints, por
HTTP, em produção.

**Endereço: local.** Bot na 3333, calendário na 3334, lado a lado. O bot chama
`http://localhost:3334`. Só o bot precisa de túnel, porque só ele recebe da Meta.

### Três ajustes na API, adiados com gatilho

Nenhum é urgente no teste local, e fazê-los agora seria defesa contra volume
inexistente num serviço que ninguém alcança. Ficam registrados para não virarem
"depois é nunca":

- **Rate limit barra o bot.** `POST /agendamentos` aceita 10/min por IP, e o bot é
  um IP só atendendo todos os clientes. **Gatilho:** sair de `localhost` — em
  produção o 11º cliente da hora leva 429 sem ter feito nada.
- **`POST /agendamentos` é escrita aberta, sem token.** Era assim porque o site
  marcava sem login; o site morreu e a porta ficou. **Gatilho:** a API ganhar
  endereço público.
- **Não há idempotência.** Timeout + repetição devolve `409` sem dizer se o
  "ocupante" é outra pessoa ou o próprio cliente. **Gatilho: o passo de confirmar
  horário** — e o conserto mais barato não é na API: o bot consulta se aquele
  cliente já tem agendamento naquele horário e responde "você já está marcado" em
  vez de "foi tomado". O toque duplo é real desde o dia um, porque a trava de
  rajada vale só para texto (`REGRAS.md`): **toque em botão nunca é suprimido.**

**Regra que vira explícita:** `agendamentos.profissional` é texto sem FK, e a
trava de double-booking depende do nome bater exatamente. O bot já lê
`profissionais`, então manda o nome de lá — nunca digitado à mão.

Como o passo novo se encaixou, para a próxima fatia repetir a forma:

1. Id com o contexto dentro: `1.dia?b=1&d=2026-08-04`, `1.hora?b=1&d=…&h=13:00`.
2. Rota no `switch` de `rotear.ts` + nome em `NOMES_RESPOSTA` **e no mapa `AJUDA`** —
   sem a frase de ajuda o TypeScript recusa compilar, de propósito.
3. O roteador continua puro: o que vem da API entra pelo `ContextoFluxo`, como
   `barbeiros` já entrava. Quem decide **o que buscar** é `alvoDaAgenda()` em
   `src/db/eventos.ts`, que lê o id com o mesmo `lerId` — nunca um parser paralelo.
4. Escada de feedback, cadastro de contato e dedupe valeram sem alteração.

Baseline do fluxo n8n antigo: **7 interações do cliente** para marcar (5 no atalho de
cliente conhecido). No mesmo trecho — do menu até a pergunta do nome — o n8n gastava
**5 toques** e aqui são **4**: agendar, barbeiro, dia, horário. A economia é a pergunta
"WhatsApp ou site?", que deixou de existir. Com 1 barbeiro ativo caem para 3. Ver
`ANEXO_FLUXO_N8N_AGENDAMENTO.md`.

## Armadilhas de retomar sessão

**A URL do ngrok morre a cada sessão.** Subir o túnel de novo e recolar a URL de
callback no painel da Meta. Detalhes em `ANEXO_WHATSAPP_META/README.md`.

**Resetar o estado antes de testar do celular.** O bot lembra do que falou com o
número **no dia corrente**, então retomar um teste no mesmo dia faz o cliente cair
na escada de feedback e parecer bug:

```bash
cd BARBEARIA && npm run db -- "delete from webhook_eventos where de = '553384246770'" -- --gravar
```

Zera degrau, última resposta e trava de rajada, e **preserva o cadastro** em
`dados_cliente`. `553384246770` é o número de teste do usuário.

**Estrutura de tabela se pergunta ao banco**, nunca a um markdown (`npm run db`).

## Pendências em aberto

- ~~`POST /whatsapp/events` sem ninguém escrevendo nele~~ — **feito em 2026-07-30.**
  O bot espelha os dois lados da conversa no painel: a mensagem do cliente (sempre,
  inclusive quando a trava de rajada cala o bot) e cada resposta efetivamente enviada.
  O espelho roda depois do envio e falha em silêncio com log — painel fora do ar não
  atrasa nem derruba atendimento. Ver `src/calendario/crm.ts`.
- **Cutucão por inatividade** — ideia do usuário em 2026-07-30, não existe ainda.
  **Cuidado com o mal-entendido:** a escada de feedback não é por tempo, dispara
  quando o cliente digita em vez de tocar. O que ele quer é outra coisa: mensagem
  depois de um período de **silêncio**. Precisa de outbox (`envios_pendentes`) +
  Vercel Cron, porque ninguém está pedindo nada na hora em que ela sairia.
  Combinado: **aperfeiçoar mais pra frente.**
- **Teto de 2 barbeiros do plano não está travado em código.** Um terceiro ativo
  aparece na lista. Hoje é regra comercial; o lugar dela é a futura tabela de
  barbearias/plano.
- **Hospedagem definitiva** — hoje é túnel ngrok. Migrar pra Vercel quando o fluxo
  estabilizar.
- **Trocar o token de envio antes da produção** (ver `ANEXO_WHATSAPP_META/`).
- **Coexistência** — parada por decisão, com caminho em aberto. Ver
  `ANEXO_WHATSAPP_META/COEXISTENCIA.md`.
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
