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

**Não decidido ainda:** se o bot fala com o calendário por **HTTP** (reusa a
lógica pronta, uma fonte de verdade, mas depende do serviço no ar) ou **direto no
banco** (independente, mas duplica a regra em dois lugares que vão divergir). Essa
é a primeira pergunta do plano de integração.

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
