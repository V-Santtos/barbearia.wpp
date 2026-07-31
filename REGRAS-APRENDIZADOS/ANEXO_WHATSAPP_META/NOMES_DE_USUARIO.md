# Nomes de usuário e BSUID: o telefone deixa de ser a chave

> **Levantado em 2026-07-31**, a pedido do usuário, a partir da documentação da Meta
> ([Business-scoped user IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/))
> e de análises de parceiros ([360Dialog](https://360dialog.com/blog/whatsapp-usernames-business-impact-2026/),
> [Vonage](https://api.support.vonage.com/hc/en-us/articles/26938046521116-Understanding-WhatsApp-Usernames-and-Business-Scoped-User-IDs-BSUIDs-Required-Actions-and-Changes),
> [Gallabox](https://gallabox.com/blog/whatsapp-usernames-hide-phone-number-businesses-2026)).
>
> **Não é especulação e não é opcional.** Já está em produção: os BSUIDs começaram a
> aparecer nos webhooks em **abril de 2026**. Isto aqui não é sobre "se", é sobre
> quando o nosso primeiro cliente com nome de usuário chegar.

## O que muda

O WhatsApp está soltando **nomes de usuário** (`@fulano`). Quem adotar um pode
**esconder o telefone das empresas** — e aí o número simplesmente **não vem** no
webhook. No lugar dele vem o **BSUID** (business-scoped user ID): um identificador do
usuário **específico para a nossa barbearia**, estável para nós e diferente do que
outra empresa recebe do mesmo cliente.

Formato do bloco de contato quando o cliente tem nome de usuário:

```json
"contacts": [{
  "profile": { "name": "<nome de exibição>", "username": "<nome de usuário>" },
  "wa_id": "<telefone>",        // CONDICIONAL — some quando indisponível
  "user_id": "<BSUID>",         // NOVO — sempre presente
  "parent_user_id": "<BSUID pai>"
}]
```

E no bloco da mensagem: o `from` **some** quando o telefone não pode ser incluído; o
`from_user_id`, com o BSUID, **vem sempre**.

## Quando o telefone ainda aparece

Regra dos 30 dias — o número continua vindo se:

- a empresa mandou mensagem ou ligou para o cliente nos últimos 30 dias, **ou**
- a empresa recebeu mensagem ou chamada dele nos últimos 30 dias, **ou**
- ele está na agenda de contatos da empresa.

Fora disso, `wa_id` e `from` são omitidos.

**Por que isso é traiçoeiro para nós:** um cliente ativo quase sempre cai numa dessas
condições, então o telefone vai continuar chegando **na maior parte dos testes**. O
caso que quebra é o cliente novo, com nome de usuário, na primeira mensagem — e é
exatamente ele que passa pela etapa de cadastro. **Ausência de sintoma no teste local
não vai provar nada.**

## Datas

| Quando | O quê |
|---|---|
| abril/2026 | BSUIDs começaram a aparecer nos webhooks |
| 29/jun/2026 | empresas podem reservar nome de usuário |
| **julho/2026** | APIs passam a aceitar **envio** endereçado a BSUID |
| início de julho/2026 | botão `REQUEST_CONTACT_INFO` fica disponível |

Suportar BSUID é **obrigatório** para todos os parceiros e negócios integrados
diretamente à plataforma — não é recurso opcional que a gente adota se quiser.

## O que isso significa para o nosso código

Hoje **o telefone é a chave de tudo**, e ele encosta em cada peça do fluxo:

| Onde | Como o telefone é usado |
|---|---|
| `webhook_eventos.de` | chave de toda leitura de estado |
| `pg_advisory_xact_lock(hashtext(de))` | trava por contato na transação |
| escada de feedback, trava de rajada, `donoAtendendo`, `lerEtapaDoNome` | todos recortam por `de` |
| `dados_cliente` | cadastro do cliente |
| `whatsapp_contacts.phone` | **`UNIQUE (phone)`** — restrição de banco |
| `agendamentos.telefone` | o que o barbeiro usa para ligar |
| `POST /mensagens` do bot | destinatário do envio |

A troca, quando for feita, é conceitual antes de ser técnica: **o BSUID vira a
identidade; o telefone vira um dado do cadastro, que pode faltar.** Duas consequências
que não são óbvias:

1. **O `UNIQUE (phone)` de `whatsapp_contacts` deixa de servir como identidade.** Dois
   clientes sem telefone não podem colidir, e o mesmo cliente não pode virar duas
   linhas quando o telefone aparecer depois. A migração precisa de uma coluna de BSUID
   com unicidade própria, e de um caminho para **fundir** o contato que já existia por
   telefone com o BSUID quando os dois se encontrarem.
2. **O barbeiro precisa do telefone.** Ele liga para o cliente — é o dado que o painel
   usa hoje debaixo do nome, e é como ele desempata dois "Victor". Se o número não vier,
   o agendamento existe sem forma de contato fora do WhatsApp. É para isso que serve o
   botão **`REQUEST_CONTACT_INFO`**: o jeito oficial de pedir o número ao cliente,
   dentro da conversa, com ele autorizando. **Se a gente for pedir telefone, é por ali
   — nunca digitado à mão**, que é a fonte de erro que a etapa do nome já ensinou.

## O que ainda não foi verificado

- Se, e como, o `REQUEST_CONTACT_INFO` se encaixa antes da confirmação do agendamento
  (um toque a mais no fluxo, contra o baseline de 4 do n8n).
- Se o nosso número de teste já recebe BSUID nos webhooks — dá para conferir olhando
  `webhook_eventos.payload` depois do próximo teste, procurando `user_id`.
- O que acontece com a nossa costura de espelho (`whatsapp_contacts`) quando o mesmo
  cliente aparece uma vez com telefone e outra sem.

**Gatilho para agir:** antes do deploy em produção. Em localhost, com um número de
teste que já conversou conosco, a regra dos 30 dias esconde o problema.
