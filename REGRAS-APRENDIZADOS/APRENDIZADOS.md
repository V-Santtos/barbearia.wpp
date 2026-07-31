# Aprendizados

Log de erros e ajustes de abordagem — meus (Claude) ou de caminhos que não
funcionaram. Objetivo: não repetir o mesmo erro duas vezes.

Formato de cada entrada:

```md
## [DATA] Título curto do erro/ajuste
- O que aconteceu: <contexto do erro ou do caminho errado>
- Correção: <o que fazer diferente da próxima vez>
```

## [2026-07-30] Apontar lacunas futuras em vez de ficar na etapa atual

- O que aconteceu: ao terminar de mapear os fluxos do n8n, fechei a resposta
  levantando pendências de escopo (reagendamento/cancelamento incompletos no
  backup, lembrete que nunca existiu). O usuário não pediu auditoria de lacunas —
  pediu que eu **entendesse o escopo** para depois construirmos em código. Ele já
  sabe o que está faltando. Segundo ele, isso se repete "todos os dias", custando
  tempo e obrigando-o a recolocar o foco toda sessão.
- Correção: **o projeto avança por partes, uma etapa por vez.** Responder o que foi
  perguntado e parar ali. Não fechar respostas com riscos futuros, itens faltantes,
  incoerências que "lá na frente vão dar problema", nem com ofertas de próximos
  passos que ele não pediu. O momento de trazer isso é a **etapa de lapidação** — e
  ele pede quando for a hora. Se eu observar algo genuinamente relevante fora da
  etapa, guardar em anexo/nota e ficar quieto até ser perguntado.
- Como saber que estou errando: se a resposta termina em alerta, ressalva ou
  pergunta de escopo que ele não abriu, é sinal de que saí da etapa atual.

## [2026-07-30] Investigar fundo antes de saber qual é a tarefa

- O que aconteceu: ele mandou o link de um repositório pedindo uma olhada
  **superficial** — só confirmar se era um calendário com login. Eu respondi isso,
  mas em seguida, quando ele trouxe a pasta pro ambiente, disparei três agentes de
  exploração e mapeei 30 rotas, tipos, hooks e seis documentos **antes de saber o
  que ele queria fazer com aquilo**. Custou ~300 mil tokens. Palavras dele: "essa
  vistoria que eu nem te pedi". Serviu depois, mas por sorte — a tarefa poderia
  ter sido outra e o levantamento inteiro seria lixo.
- Correção: **primeiro descobrir a tarefa, depois dimensionar a investigação.**
  Uma pergunta curta de escopo custa uma frase; um mapeamento completo custa uma
  sessão. Quando ele pedir algo "superficial", entregar superficial e parar. O
  gatilho para investigar fundo é ter a tarefa na mão, não a curiosidade de já ter
  o repositório aberto.
- Como saber que estou errando: se eu estou lendo o terceiro arquivo grande e
  ainda não sei qual é o objetivo, parei de trabalhar e comecei a passear.

## [2026-07-30] Apresentar as decisões como se fossem uma lista de problemas

- O que aconteceu: ao fechar o plano do CRM, resumi os três pontos principais como
  "o espelho precisa do wamid", "o cartão precisa virar texto", "o rate limit vai
  barrar". Eram as **soluções que eu já tinha escolhido** — mas cada frase foi escrita
  do lado do problema. Ele leu como uma parede de obstáculos e respondeu:
  *"parece que é impossível... só você só traz os problemas, e a solução, tem
  solução???????"*. O plano estava correto e completo; o resumo é que estava invertido.
- Correção: **na hora de resumir, escrever o que eu vou fazer, não o que pode dar
  errado.** "Leio o id que a Meta já devolve — 3 linhas" em vez de "sem o id, duplica".
  O risco entra no código, como comentário, e no plano escrito; o resumo falado é
  sobre a entrega. Se um ponto **precisa** de decisão dele, aí sim vira pergunta
  explícita, separada do resto.
- Como saber que estou errando: se o meu resumo tem três bullets e os três começam
  pelo defeito, ele vai fechar a leitura achando que o projeto travou.

## [2026-07-30] Afirmar sobre horário lendo um timestamp já convertido

- O que aconteceu: consultei `now() at time zone 'America/Sao_Paulo'`, o driver do
  `pg` devolveu um `timestamp without time zone` que foi reserializado como UTC
  (`...T00:15:38.548Z`), e eu li aquilo como hora de São Paulo. Concluí "passou da
  meia-noite, hoje virou 31/07", **corrigi uma afirmação minha que estava certa**, e
  ainda mostrei os horários de 31/07 dizendo que eram de hoje. Ele respondeu:
  *"meu amigo, agora são 21:16 da noite"*.
- Correção: **para comparar relógio, pedir ao banco já formatado como texto**
  (`to_char(... , 'YYYY-MM-DD HH24:MI:SS')`). Qualquer valor de data que passe por
  driver e serialização pode ter sido reconvertido no caminho, e a diferença de 3
  horas é exatamente do tamanho que passa despercebida.
- Como saber que estou errando: se uma conclusão sobre "hoje" ou "agora" depende de um
  timestamp que eu li de um JSON, ela ainda não foi verificada.

## [2026-07-30] Terceirizar decisão técnica para o usuário

- O que aconteceu: perguntei a ele se três ajustes na API do calendário (isenção
  de rate limit, token na rota de escrita, idempotência) deviam ser feitos agora
  ou depois. Ele respondeu duas vezes que não entendeu — e explicou o porquê: não
  domina esses termos, não sabe o que é melhor ou pior, e **eu é que tenho o
  contexto do projeto inteiro**. A pergunta estava mal feita, não a leitura dele.
  Mesmo padrão em outras rodadas da mesma sessão: perguntei sobre a mensagem
  atrasada quando ele só queria mapear, e sobre o escopo da pasta antes de saber
  o que ele queria com ela.
- Correção: **o critério é a origem da resposta, não o tamanho da decisão.**
  - Se a resposta sai de ler o código, do estágio do projeto ou das regras já
    travadas → **eu decido, executo e explico o porquê depois.** Urgência,
    prioridade técnica, ordem de implementação e trade-off de engenharia entram
    aqui. Ele não precisa aprender vocabulário de engenharia para tocar o produto.
  - Se a resposta sai do que ele quer construir, de custo, de produto ou de risco
    de negócio → **aí sim pergunto.** Foi o caso de "HTTP ou direto no banco" e
    "onde a API vai atender", que ele decidiu sem dificuldade.
- Como saber que estou errando: se a pergunta precisa de glossário para ser
  entendida, ela não deveria ter sido feita — deveria ter virado decisão minha com
  justificativa. Uma resposta "não entendi" a uma pergunta minha é erro meu.
