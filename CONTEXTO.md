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

85 testes passando, `npm run typecheck` limpo, fluxo exercitado contra o banco
real. Os porquês de cada decisão de desenho estão em `REGRAS-APRENDIZADOS/REGRAS.md`
(entradas de 2026-07-30) — **o que cada arquivo faz, o código responde melhor.**

**O agendamento para na escolha do barbeiro.** O próximo nó é dia e horário.

**O calendário entrou no ambiente** em 2026-07-30, importado de
`github.com/V-Santtos/Aplicativo-FULL` e podado para o nosso escopo (dois
commits: `4f2294f` intacto, `6a3760a` a poda). Ver `CALENDARIO/README.md`.

## O próximo passo: DIA E HORÁRIO

A lógica de disponibilidade **já existe e é boa** — está na API do calendário, não
em função SQL. Duas rotas resolvem o passo:

- `GET /agendamentos/dias-disponiveis?professionalId=&days=` — quais dias têm vaga
  numa janela inteira, com contagem e primeiro horário livre
- `GET /agendamentos/horarios-disponiveis?professionalId=&date=` — os horários de
  um dia
- `POST /agendamentos` — marca, revalidando tudo e tratando o índice único

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

Como o passo novo se encaixa no bot, para não redescobrir:

1. Novo id em `montarId('dia', { b: '1', d: '2026-08-04' })` — contexto no id.
2. Nova rota no `switch` de `rotear.ts` + nome novo em `NOMES_RESPOSTA` **e no
   mapa `AJUDA`** — sem a frase de ajuda o TypeScript recusa compilar, de propósito.
3. O roteador é puro: o que vier da API entra pelo `ContextoFluxo`, como
   `barbeiros` já entra.
4. Escada de feedback, cadastro de contato e dedupe valem sem alteração.

Baseline a bater, do fluxo n8n antigo: **7 interações do cliente** para marcar
(5 no atalho de cliente conhecido). Ver `ANEXO_FLUXO_N8N_AGENDAMENTO.md`.

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

- **`POST /whatsapp/events` do calendário está testado e livre**, mas ninguém
  escreve nele. É por ali que as conversas do WhatsApp vão aparecer no painel do
  dono — parte do plano de integração.
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
