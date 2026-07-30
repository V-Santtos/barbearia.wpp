# REGRAS-APRENDIZADOS

Memória viva do projeto SaaS Barbearia. Diferente de `docs/skills-log.md` (que só
registra veredito de skills/repositórios avaliados para instalação), esta pasta guarda
**conhecimento e decisões** que precisam ser lembrados ao longo do projeto, venham de
onde vierem (vídeos, artigos, repositórios, conversas, erros cometidos).

## Estrutura

- **`REGRAS.md`** — decisões duráveis e restrições do projeto. Coisas que valem em
  qualquer momento futuro, até serem explicitamente revistas.
- **`APRENDIZADOS.md`** — log de erros (meus, do Claude, ou de abordagens que não
  funcionaram) e o que fazer diferente da próxima vez.
- **`ANEXO_<TEMA>.md`** — base de conhecimento por assunto (ex.: `ANEXO_ARQUITETURA.md`,
  `ANEXO_WHATSAPP.md`). Cada arquivo acumula o que já validamos sobre aquele tema,
  citando a fonte de cada trecho.

## Mecanismo (obrigatório antes de adicionar algo novo)

1. **Buscar primeiro**: antes de processar um repositório, vídeo ou conhecimento novo,
   procurar nesta pasta se já existe algo relacionado (mesmo tema, tecnologia ou
   decisão).
2. **Se não há sobreposição**: adicionar o conhecimento novo no `ANEXO_<TEMA>.md`
   correspondente (criando o arquivo se o tema for novo), com fonte e data.
3. **Se há sobreposição/conflito**: não decidir sozinho. Apresentar as duas fontes
   (a antiga registrada aqui + a nova) e abrir debate explícito com o usuário sobre
   qual fica, qual é complementar, ou se as duas coexistem para contextos diferentes.
   Registrar a decisão final no anexo correspondente.
4. Cada entrada deve indicar a **fonte** (link, vídeo, repo) e a **data**, para que
   decisões antigas possam ser revisitadas com contexto.
