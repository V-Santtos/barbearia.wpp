# REGRAS-APRENDIZADOS

Memória curada **deste produto**. Leia apenas as entradas ligadas à tarefa. O estado
atual fica em `../CONTEXTO.md`; avaliações de skills e repositórios ficam em
`../docs/skills-log.md`. Estratégia, conteúdo, aulas e conhecimento geral do Victor
pertencem ao Atlas Victor, conforme o `AGENTS.md` global — confirme o destino antes
de gravar.

## Estrutura

- **`REGRAS.md`** — decisões do produto, com data. Uma decisão posterior pode substituir
  uma anterior; confira a regra recente e a implementação antes de aplicá-la.
- **`APRENDIZADOS.md`** — log de erros (meus, do Claude, ou de abordagens que não
  funcionaram) e o que fazer diferente da próxima vez.
- **`ANEXO_<TEMA>.md`** — base de conhecimento por assunto (ex.: `ANEXO_ARQUITETURA.md`,
  `ANEXO_WHATSAPP.md`). Cada arquivo acumula o que já validamos sobre aquele tema,
  citando a fonte de cada trecho.
- **`ANEXO_<TEMA>/`** — quando o tema é grande demais para um arquivo, vira pasta com
  `README.md` de índice + arquivos numerados (ex.: `ANEXO_BANCO/`). Mesma regra de fonte
  e data; o índice diz o que está em cada arquivo e como reproduzir o levantamento.

## Mecanismo (obrigatório antes de adicionar algo novo)

1. Confirmar que o assunto pertence a este produto e buscar sobreposição aqui.
2. Registrar apenas a conclusão reutilizável no arquivo da camada correta, com fonte
   e data; não copiar transcrições, histórico de execução ou o mesmo fato entre camadas.
3. Se duas fontes ou decisões conflitarem, apresentar a diferença ao Victor antes de
   substituir uma decisão durável. Marcar explicitamente a decisão superada.
