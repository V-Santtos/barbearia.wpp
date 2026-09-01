# Números de teste

Quem pode conversar com o bot durante o desenvolvimento.

## Os dígitos NÃO ficam aqui

**Este repositório é público.** Número de WhatsApp em repositório público é comida
de raspador — vira spam para uma pessoa real, e git não tem desfazer: fica no
histórico, nos forks e nos arquivos de terceiros para sempre.

Os números reais vivem em **`BARBEARIA/.testes.local.md`**, que o `.gitignore`
cobre. Quem for testar e não tiver o arquivo, pede a quem tem.

| Quem | Papel | Desde |
|---|---|---|
| Agostinho | mantenedor atual | 2026-09-01 — primeira conversa real no banco novo |
| Victor | dono anterior do projeto | herdado do case antigo |

A lista vai crescer com números de pessoas próximas, conforme a necessidade de
testar. Ao acrescentar alguém: o nome entra **aqui**, os dígitos entram **no
arquivo local**.

> **Dívida herdada, não resolvida por este arquivo:** o número do Victor já está em
> ~10 arquivos versionados de antes (testes, migrações, `server.js`, `REGRAS.md`) e
> portanto já é público. Tirá-lo de lá exige reescrever histórico de commits que
> outras pessoas podem ter clonado — decisão dele, não faxina de rotina. Registrado
> para não parecer descuido.

## Formato canônico

`wa_id` da Cloud API: dígitos puros com DDI, **sem** o `9` artificial depois do DDD
e **sem** sufixo `@s.whatsapp.net`. Os dois vinham da Evolution API do fluxo antigo
e produziram quatro formatos do mesmo número no mesmo banco.

No seed de teste (`BARBEARIA/db/seed/teste.sql`) os números são **fictícios**, no
bloco `55339999xxxx`. Não confundir com número de gente.

## O número da barbearia (o outro lado)

`WHATSAPP_PHONE_NUMBER_ID` = `922642447599728`, nome verificado "Barbearia",
Cloud API. É para ele que se manda mensagem para acordar o bot. O telefone em si
aparece no painel da Meta.

## O que lembrar ao testar

- **A janela de 24h da Meta conta da última mensagem do CLIENTE**, não da resposta
  do bot. Passadas 24h sem o número escrever, o bot não consegue mais iniciar
  conversa sem template aprovado. Detalhe em `README.md` deste anexo.
- **O bot cala quando o dono responde à mão** pelo painel, e só volta na virada da
  meia-noite em São Paulo ou quando o cliente toca num botão. Se o bot parecer
  mudo, é a primeira coisa a checar — não é defeito.
- **Testar não é de graça:** cada mensagem enviada é uma conversa contabilizada.

## Limpando o rastro de um teste

O estado de um número vive em cinco tabelas. A ordem importa, por causa das FKs:

```sql
delete from whatsapp_messages m
 using whatsapp_contacts c
 where m.contact_id = c.id and c.phone = '<numero>';

delete from whatsapp_conversations v
 using whatsapp_contacts c
 where v.contact_id = c.id and c.phone = '<numero>';

delete from whatsapp_contacts  where phone    = '<numero>';
delete from webhook_eventos    where de       = '<numero>';
delete from dados_cliente      where telefone = '<numero>';
```

Rodar com `npm run db -- -f <arquivo>` de dentro de `BARBEARIA/` — ensaia por
padrão, só grava com `--gravar`.

Zerar `webhook_eventos` de um número **reseta a conversa dele**: o estado do bot é
derivado desse histórico, não guardado em coluna. Depois disso ele trata a pessoa
como se nunca tivesse falado — que é o que se quer para repetir um teste desde o
"oi".
