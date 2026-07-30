# Coexistência — a decisão em aberto

**Coexistência** é o dono continuar respondendo pelo WhatsApp Business do celular
dele, com o mesmo número, enquanto o bot atende pela Cloud API. Sem ela, o número
do bot e o número que o dono já usa são dois números diferentes.

Levantado em 2026-07-29. **Nada aqui está travado** — é a agenda de uma decisão.

## O que já está decidido: ela sai do caminho crítico

Decisão do usuário ao fim de 2026-07-29. O V1 se prova sem coexistência: fluxo de
botões, agendamento sem conflito de horário, lembrete no tempo certo e
espelhamento no calendário — nada disso depende de o dono responder pelo celular.

Arranjo do teste real: **WhatsApp pessoal = cliente**, **Cloud API
(`922642447599728`) = barbearia/bot**, **app de calendário = dono atendendo**.

## Os dois caminhos

A doc da Meta dá a régua:

> "To use an existing WhatsApp Business app phone number with Cloud API, you must
> either delete your account, **or onboard to the platform using a partner who
> supports business app number onboarding**."

### Caminho A — ser o próprio Tech Provider: FECHADO

A cadeia é: coexistência → Embedded Signup → Partner path → **Business
Verification** → pessoa jurídica. O modal do painel ("Switch to the Partner
path?") lista `Completing Business Verification` textualmente.

O usuário é PF sem CNPJ e não pretende abrir empresa. **Requisito impossível, não
fila.**

**Não clicar em "Yes, become a Partner".** O verbo é *switch*: troca o caminho do
app e pode degradar o setup que hoje funciona.

**Gatilho pra reabrir:** CNPJ.

### Caminho B — entrar como cliente de um BSP: EM ABERTO

Quem precisa ser verificado é o **parceiro**, não o usuário. O BSP roda o Embedded
Signup dele e o número entra em coexistência com o histórico preservado.

Resolve também o **onboarding em escala**: o Embedded Signup do BSP cadastra cada
barbearia sem trabalho manual por barbeiro.

**A trava é comercial, não técnica** — o BSP aceita pessoa física como cliente?
Varia por fornecedor, e se descobre perguntando.

**Critérios pra escolher, ainda não pesquisados:**

1. Aceita PF?
2. Suporta coexistência (*business app number onboarding*)?
3. Dá acesso direto à Cloud API com credenciais próprias, ou obriga a falar com a
   API dele? — **este item decide se o código atual sobrevive intacto.**
4. Custo: mensalidade fixa vs. markup por mensagem.

## Plano de contingência, se nenhum BSP aceitar PF

O dono atende pelo app de calendário (`CALENDARIO/`), não pelo WhatsApp Business.
Isso remove a dependência de coexistência do V1 inteiro.

Nota: conta não verificada tem **teto de números de telefone por WABA** — escalar
sem BSP exigiria CNPJ em algum momento.
