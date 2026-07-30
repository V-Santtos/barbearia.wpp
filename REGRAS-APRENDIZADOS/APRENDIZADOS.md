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
