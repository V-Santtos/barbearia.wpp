# CONTEXTO.md

Memória de **curto prazo**: onde estamos agora e qual o próximo passo. Muda a
cada etapa. Ler primeiro ao retomar uma sessão resetada.

O que é durável não mora aqui — mora em `REGRAS-APRENDIZADOS/`. Se uma seção
deste arquivo continuar verdadeira daqui a três meses, ela está no lugar errado.

## O projeto

SaaS de agendamento para barbearias. V1 = bot de botões no WhatsApp + calendário
próprio para o dono atender. Escopo completo em `docs/superpowers/specs/`.

Duas pastas de código:

| Pasta | O quê | Porta |
|---|---|---|
| `BARBEARIA/` | o bot (Hono + TypeScript + `pg`) | 3333 |
| `CALENDARIO/` | API de agenda (Fastify) + painel do dono (React) | 3334 + 3002 |

Os dois falam com o **mesmo banco**: Supabase `sppexvjvnoganlduyjvs`. Acesso e
armadilhas em `REGRAS-APRENDIZADOS/ANEXO_BANCO/`.

## Onde estamos (2026-08-04)

**O agendamento fecha ponta a ponta pelo WhatsApp**, validado no celular de
verdade: `oi` → menu → barbeiro → dia → horário → nome → cartão → Confirmar →
linha em `agendamentos`, com o nome caindo em `dados_cliente` (escrita única,
vista disparar de verdade). O dono responde pelo painel e o bot cala enquanto
ele atende. Decisões e bugs dessa etapa estão travados em
`REGRAS-APRENDIZADOS/REGRAS.md` (entradas de 2026-08-01) — não repetir aqui.

**Ainda não commitado:** o pool de conexão aquecido na subida (bot e API do
calendário — `BARBEARIA/src/index.ts`, `src/calendario/http.ts`,
`src/db/cliente.ts`, `CALENDARIO/server.js`), conserto de uma latência que
chegou a 8,7s contra o banco real (detalhe em `ANEXO_BANCO/README.md`).

**O dashboard saiu do protótipo e está dentro do app**, em
`CALENDARIO/components/dashboard/`, lendo dado real de `GET /dashboard/resumo`
(não mock). Testado no PC e no celular real (LAN), conferido contra o banco.
**Ainda não commitado.**

A pasta `Dashboard/` (protótipo antigo) foi **apagada** em 2026-08-04 — todo o
código útil já tinha migrado para `CALENDARIO/`, confirmado por grep (nenhum
import apontava pra lá).

**O PWA está montado** (2026-08-04). A estrutura já vinha inteira do
`Aplicativo-FULL` e nunca tinha sido tocada — o trabalho foi tirar o que estava
velho: ícone da tesoura gerado por `npm run icones`, `maskable` com arquivo
próprio, `apple-touch-icon` 180 opaco, `lang: pt-BR`, cor de tema igualada ao
fundo do app e bloco `preview` alcançável na LAN. Decisões em `REGRAS.md`
(2026-08-04). **Falta só HTTPS**, que não se resolve em código — vem com o
deploy; hoje o iPhone instala pela "Tela de Início" e o Android não.

**Três levas de ajuste visual no mobile** rodaram a partir de prints reais do
usuário — ele manda print, eu ajusto, ele confere de novo, é assim que essa
frente avança. A última leva (mês/semana em tela cheia, FAB virando "+", última
linha da grade absorvendo o espaço sobrando) **não foi reconferida no
celular** — é a primeira coisa a olhar ao retomar esta frente.

## Ambiente de desenvolvimento

Três processos + um túnel, todos em **background** — nunca no terminal do
usuário (processo iniciado lá morre quando ele fecha a janela).

| O quê | Onde | Comando | Porta |
|---|---|---|---|
| Bot (Hono) | `BARBEARIA/` | `npm run dev` | 3333 |
| API do calendário (Fastify) | `CALENDARIO/` | `npm run server` | 3334 |
| Painel do dono (React/Vite) | `CALENDARIO/` | `npm run dev` | 3002 |

Túnel aponta só para o bot, que é o único que recebe da Meta: `ngrok.cmd http
3333` em background. URL pública em `http://127.0.0.1:4040/api/tunnels` —
**muda a cada sessão**, recolar em Webhooks → Conta comercial do WhatsApp
(`<url>/webhook/whatsapp`). Conferir depois de subir: `3333/saude` → 200,
`3334/` → 200, `3002/` → 200 (raiz da 3333 dá 404, e isso é o certo).

**Reset do estado de teste** (número `553384246770`), de dentro de
`BARBEARIA/`, nesta ordem — FKs exigem mensagem → conversa → contato:

```bash
npm run db -- "delete from agendamentos where telefone = '553384246770'" -- --gravar
npm run db -- "delete from webhook_eventos where de = '553384246770'" -- --gravar
npm run db -- "delete from whatsapp_messages where conversation_id in (select c.id from whatsapp_conversations c join whatsapp_contacts ct on ct.id = c.contact_id where ct.phone = '553384246770')" -- --gravar
npm run db -- "delete from whatsapp_conversations where contact_id in (select id from whatsapp_contacts where phone = '553384246770')" -- --gravar
npm run db -- "delete from whatsapp_contacts where phone = '553384246770'" -- --gravar
```

`dados_cliente` fica de fora (é cadastro); para repetir só o teste da escrita
do nome, zerar apenas o campo:

```bash
npm run db -- "update dados_cliente set nome = null where telefone = '553384246770'" -- --gravar
```

Conferir sempre com `select count(*)` nas cinco depois de rodar — não
anunciar "zerado" sem olhar (aconteceu errado duas vezes, ver
`REGRAS-APRENDIZADOS/APRENDIZADOS.md`, 2026-08-01).

## Pendências em aberto

- **Etapa do nome — casos ainda não exercitados no celular:** nome picado
  (primeiro nome numa mensagem, sobrenome na seguinte, deve fechar sozinho sem
  toque); correção (`Vicctor` → `Victor`, deve reimprimir o cartão, não
  agendar); lixo (`ok`, `123`, deve recusar com o motivo). Conferir
  `dados_cliente.nome` depois de qualquer fechamento.
- **Pular a pergunta do nome para cliente já cadastrado** — decidido em
  2026-07-31, não implementado. O insumo já existe (`contexto.nome` vem de
  `registrarContato()`); falta o roteador usar, em `escolherHora()` de
  `src/fluxo/rotear.ts` (`ponytail:` marcado no ponto exato).
- **Correção de nome de cliente cadastrado** — vai no painel do dono, não no
  menu do WhatsApp (decisão travada, ver `REGRAS.md` 2026-07-31). Não existe
  em lugar nenhum ainda.
- **O telefone vai deixar de ser a chave** — nomes de usuário do WhatsApp já
  são obrigatórios em produção desde abril/2026. Gatilho: antes do deploy.
  Levantamento completo em `ANEXO_WHATSAPP_META/NOMES_DE_USUARIO.md`.
- **Cutucão por inatividade** — ideia do usuário (2026-07-30), não existe
  ainda. Precisa de outbox + Vercel Cron. Combinado: aperfeiçoar mais pra
  frente.
- **Teto de 2 barbeiros do plano** não está travado em código — hoje é regra
  comercial; o lugar dela é a futura tabela de barbearias/plano.
- **Hospedagem definitiva** — hoje é túnel ngrok. Migrar pra Vercel quando o
  fluxo estabilizar. Subir no GitHub é parte do mesmo assunto, combinado mas
  ainda não aberto.
- **Trocar o token de envio antes da produção** — ver `ANEXO_WHATSAPP_META/`.
- **Coexistência** — parada por decisão, caminho em aberto. Ver
  `ANEXO_WHATSAPP_META/COEXISTENCIA.md`.
- Confirmar status de licenciamento do AbacatePay antes de reconsiderá-lo.
