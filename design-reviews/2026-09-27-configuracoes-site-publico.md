# Plano de auditoria de design — Configurações do site público

> Análise visual. Nenhuma alteração da interface foi implementada neste plano.

## Identificação

- **Data:** 2026-09-27
- **Raiz do projeto:** `C:\Users\victo\Desktop\Projetos Gith Hub\SAAS-BARBEARIA`
- **Recorte solicitado:** modal de Configurações do site público no painel do calendário, nas abas Página de agendamento, Categorias e Serviços e preços.
- **Modo de evidência:** renderizado + implementação, com prints do usuário.
- **Arquivo de saída:** `design-reviews/2026-09-27-configuracoes-site-publico.md`

## Enquadramento

- **Objetivo considerado:** aproximar o modal novo do visual já validado no calendário, no login e no agendamento público.
- **Público e tarefa:** dono da barbearia editando textos, categorias e serviços do site público.
- **Escopo observado:** superfícies, campos, seleção, navegação, espaçamento, rodapé, estados e apresentação responsiva do modal.
- **Restrições conhecidas:** preservar as três áreas e seus controles; nenhuma mudança de API, persistência ou roteamento foi solicitada. O usuário valida as propostas uma a uma.
- **Suposições e lacunas:** o estado de desktop foi examinado pelo print e pelo código; houve inspeção renderizada em viewport móvel. Não houve teste com leitores de tela ou textos deliberadamente extremos.

## Evidências inspecionadas

| Evidência | Tipo | Relação com o recorte | Limitação |
|---|---|---|---|
| Prints enviados do modal, categorias e campos de evento | Imagem | Mostram excesso de linhas, checkbox e referência de campo | Estados estáticos |
| Modal aberto nas três abas em `http://127.0.0.1:3002/` | Renderizado móvel | Confirma densidade, navegação horizontal, campos e rodapé | Não representa todos os tamanhos |
| `CALENDARIO/components/settings/BookingSiteSettings.tsx` | Implementação | Define estrutura, classes, estados e conteúdo do modal | Código local com alterações não commitadas |
| `CALENDARIO/components/ui/campo.ts` e `CALENDARIO/components/EventModal.tsx` | Implementação | Padrão compartilhado de campos já usado em login e evento | A equivalência visual deve ser conferida após aplicação |
| `CALENDARIO/components/ui/NeonCheckbox.tsx`, `Sidebar.tsx` e `HamburgerPanel.tsx` | Implementação | Padrão de seleção dos profissionais no calendário | Acessibilidade do foco requer checagem |
| `CALENDARIO/index.css` e `components/dashboard/css/00-tokens.css` | Tokens | Escala roxa, superfícies e texto do painel | Parte dos tokens é específica do dashboard |
| `docs/superpowers/specs/2026-09-27-configuracoes-site-agendamento.md` | Especificação | Registra intenção das três abas e rodapé de salvamento | Direção visual pode ser revista pelo usuário |

## Síntese

O modal organiza as três tarefas e já usa o universo escuro do painel. A divergência vem de três decisões locais: campos novos com outra forma, muitos contornos aninhados e checkboxes nativos em lugar do controle visual existente. O refinamento deve reaproveitar os componentes reconhecíveis do calendário e reduzir linhas onde o espaço e a diferença de tom já separam as áreas.

## O que preservar

- Três áreas separadas: Página de agendamento, Categorias, Serviços e preços.
- Cabeçalho, conteúdo com rolagem e rodapé com estado de salvamento.
- Fundo escuro sólido e roxo para seleção, foco e ação habilitada.
- Rótulos acima dos campos e preço visível nas linhas de serviço.
- Tipografia de interface do painel, sem levar a Poppins do site público para o formulário administrativo.

## Matriz de cobertura

| Domínio | Estado | Evidência ou justificativa | Achados relacionados |
|---|---|---|---|
| Objetivo, público e tarefa | avaliado — sem problema relevante | As três abas correspondem às tarefas do dono | — |
| Hierarquia | avaliado — com achados | Título do cabeçalho, aba ativa e título interno competem; botão inativo mantém presença forte | FIND-002, FIND-005 |
| Composição e layout | avaliado — com achados | Altura de até 760px deixa grande vazio na aba Página | FIND-002 |
| Grid, alinhamento e espaçamento | avaliado — com achados | Sidebar de 240px quebra o primeiro rótulo; linhas e caixas aninhadas comprimem o conteúdo | FIND-002, FIND-004 |
| Tipografia | avaliado — com achados | Texto secundário em `white/45` e descrição truncada diminuem legibilidade | FIND-004 |
| Cor, contraste e profundidade | avaliado — com achados | Bordas sucessivas competem com hierarquia de superfícies | FIND-002, FIND-005 |
| Imagens e iconografia | avaliado — sem problema relevante | Ícones das abas e ações têm função reconhecível | — |
| Componentes e estados | avaliado — com achados | `inputClass` e checkbox locais divergem dos padrões existentes | FIND-001, FIND-003 |
| Interação, feedback e usabilidade | avaliado — com achados | Salvar inativo ainda domina; ação de remoção desabilitada depende de `title` | FIND-005 |
| Responsividade e conteúdo extremo | avaliado — com achados | Abas rolam horizontalmente e a descrição de serviço é truncada; extremo não testado | FIND-004 |
| Acessibilidade | parcial — evidência insuficiente | Rótulos e estados existem no código, mas foco por teclado/leitor de tela do `NeonCheckbox` não foi testado | FIND-003 |
| Consistência, sistema e tokens | avaliado — com achados | Modal redefine campo e checkbox onde já há componentes do painel | FIND-001, FIND-003 |
| Marca e direção visual | avaliado — com achados | Paleta é comum; material e forma dos controles não são | FIND-001, FIND-002 |
| Fidelidade e robustez da implementação | avaliado — com achados | Classes locais repetem estilos em vez de usar `campo.ts`; altura fixa amplifica vazio | FIND-001, FIND-002 |
| Movimento | parcial — evidência insuficiente | Código do checkbox contém efeitos; sua adequação ao modal e redução de movimento não foram observadas | FIND-003 |
| Conteúdo de interface | avaliado — com achados | “Página de agendamento” se repete e quebra no menu; descrições podem desaparecer | FIND-004 |

## Achados prioritários

### Campos do modal têm outra linguagem visual

- **ID:** FIND-001
- **Evidência:** `BookingSiteSettings.tsx:17` usa `rounded-lg`, fundo `#262626` e borda plana; `campo.ts:20` oferece `rounded-2xl`, sombra interna e roxo no foco. O print do usuário mostra o campo de Criar Evento como referência.
- **Tipo:** verificável.
- **Impacto e alcance:** afeta as três abas, sobretudo a Página de agendamento; faz o modal parecer de outro produto.
- **Prioridade e confiança:** alta, alta.
- **Causa provável:** estilo local criado para o modal.
- **Recomendação:** usar `CAMPO` e `FUNDO_CAMPO_MODAL` nos campos de texto, select e textarea deste modal; preservar rótulos e densidade adequada. Conferir altura e foco no contexto real.
- **Arquivos ou superfícies envolvidos:** `BookingSiteSettings.tsx`, `campo.ts`; Página, Categorias e Serviços.
- **Como validar:** campos do modal e de Criar Evento devem ter a mesma forma, profundidade e indicação de foco em desktop e celular.

### Muitos contornos ao mesmo tempo e altura desnecessária

- **ID:** FIND-002
- **Evidência:** `BookingSiteSettings.tsx:128-150` combina borda externa, linha do cabeçalho, divisória da lateral, card com borda e linha do rodapé. A altura definida em 760px deixa grande vazio na primeira aba, visível no print.
- **Tipo:** verificável e heurística.
- **Impacto e alcance:** o olhar percorre os divisores antes do conteúdo; a aba simples parece maior e mais complexa do que é.
- **Prioridade e confiança:** alta, alta.
- **Causa provável:** cada região recebeu uma borda independente.
- **Recomendação:** manter contorno e sombra do modal; reservar separação sutil para cabeçalho/rodapé fixos; separar lateral e formulário por diferença de tom e espaço, reduzindo a divisória vertical e a caixa externa dos três campos. Permitir altura ajustada ao conteúdo da aba Página, com limite e rolagem nas abas longas.
- **Arquivos ou superfícies envolvidos:** estrutura e `panelClass` de `BookingSiteSettings.tsx`.
- **Como validar:** na primeira aba, os três campos dominam a vista e não há uma área vazia equivalente a metade do modal; nas abas longas, rolagem e rodapé continuam utilizáveis.

### Checkbox de categorias não acompanha o calendário

- **ID:** FIND-003
- **Evidência:** `BookingSiteSettings.tsx:157-158` usa `<input type="checkbox" className="accent-accent">`; a lista de profissionais em `Sidebar.tsx` e `HamburgerPanel.tsx` usa `NeonCheckbox`.
- **Tipo:** verificável.
- **Impacto e alcance:** afeta filtro de categorias e todas as linhas “Ativa”; é um controle repetido e visível.
- **Prioridade e confiança:** alta, alta.
- **Causa provável:** uso do controle nativo sem consultar o componente compartilhado.
- **Recomendação:** reutilizar a aparência do `NeonCheckbox` com roxo da marca, tamanho e área clicável proporcionais aos controles da linha. Confirmar teclado, foco visível e movimento reduzido ao integrá-lo.
- **Arquivos ou superfícies envolvidos:** aba Categorias, `NeonCheckbox.tsx`.
- **Como validar:** seleção, foco e desativação são distinguíveis; rótulo também ativa o controle; interface continua confortável em celular.

### Navegação e linhas de serviço comprimem conteúdo

- **ID:** FIND-004
- **Evidência:** `BookingSiteSettings.tsx:141-142` usa sidebar estreita com rótulo quebrado e navegação horizontal móvel; `:166` aplica `truncate` na descrição do serviço. Prints mostram quebra e muitos limites.
- **Tipo:** verificável e heurística.
- **Impacto e alcance:** dificulta escanear as seções e conferir informação de serviço antes de editar.
- **Prioridade e confiança:** média, alta para quebra/truncamento; média para solução de navegação.
- **Causa provável:** nomes longos no menu e compressão de conteúdo em linhas de uma só altura.
- **Recomendação:** testar rótulos curtos no menu (“Página”, “Categorias”, “Serviços”), mantendo títulos completos dentro de cada aba. Dar à descrição até duas linhas ou expansão; preservar nome e preço em destaque. Reduzir caixas dentro de caixas nas linhas editáveis.
- **Arquivos ou superfícies envolvidos:** navegação e aba Serviços em `BookingSiteSettings.tsx`.
- **Como validar:** três áreas são identificáveis sem rótulos partidos; descrições úteis não desaparecem em viewport estreita.

### Estado de salvamento tem peso visual invertido

- **ID:** FIND-005
- **Evidência:** `BookingSiteSettings.tsx:172` mantém botão roxo preenchido com opacidade 40% quando desabilitado, enquanto “Tudo atualizado” usa texto pequeno `white/50`. A ação de remover categoria pode estar desabilitada com razão apenas no atributo `title`.
- **Tipo:** verificável e heurística.
- **Impacto e alcance:** o rodapé chama atenção mesmo sem mudança e o motivo para uma remoção indisponível pode não ficar claro.
- **Prioridade e confiança:** média, média.
- **Causa provável:** mesmo estilo de ação para estados habilitado e inativo, com opacidade aplicada ao final.
- **Recomendação:** botão inativo em superfície escura discreta; roxo preenchido ao haver alterações; estado textual mais legível. Explicar no fluxo quando uma categoria não puder ser removida por conter serviços.
- **Arquivos ou superfícies envolvidos:** rodapé e aba Categorias.
- **Como validar:** antes de editar, o formulário é o foco; depois de editar, Salvar assume a prioridade e o estado de alterações fica claro.

## Causas sistêmicas

1. O modal recriou componentes de formulário e seleção já existentes no painel.
2. Bordas foram usadas como separador padrão em cada nível de composição.
3. Rótulos e linhas de conteúdo foram dimensionados para um único tamanho, sem acomodar bem o móvel e os textos longos.

## Sequência sugerida

| Ordem | Ação | Resolve | Dependências | Risco | Validação |
|---:|---|---|---|---|---|
| 1 | Trocar a pele dos campos pelo padrão compartilhado | FIND-001 | Aprovação do usuário | Baixo | Comparação com Criar Evento |
| 2 | Reduzir divisores e ajustar altura da aba Página | FIND-002 | Aprovação da composição | Médio | Desktop e celular, três abas |
| 3 | Aplicar o checkbox visual do calendário | FIND-003 | Verificar foco e redução de movimento | Baixo | Mouse, toque e teclado |
| 4 | Encurtar menu e permitir leitura de descrição | FIND-004 | Aprovação dos rótulos | Médio | Viewports estreitas e textos longos |
| 5 | Refinar estados do rodapé e impedimento de remoção | FIND-005 | Estados anteriores resolvidos | Baixo | Sem mudanças e com mudanças |

## Decisões que exigem confirmação

- Confirmar se a aba Página deve ter altura ajustada ao conteúdo, enquanto as abas longas usam o limite de altura com rolagem.
- Confirmar rótulos curtos “Página” e “Serviços” apenas na navegação.
- Validar a intensidade visual do `NeonCheckbox` quando repetido nas categorias.

## Revisão de omissões

- **Pedido original totalmente coberto:** sim, incluindo campos, checkboxes, divisores e três abas.
- **Domínios reabertos após a revisão:** responsividade, movimento e acessibilidade foram marcados com as limitações de evidência.
- **Achados adicionados ou corrigidos:** truncamento das descrições, botão Salvar inativo e altura da aba Página.
- **Conflitos ou duplicações resolvidos:** campos foram agrupados em FIND-001; excesso de bordas e altura em FIND-002; não se propõe alterar a tipografia validada do painel.

## Limites da análise

Não houve teste de leitor de tela, textos extremos, estados de erro nem interação real de salvamento. O plano avalia o visual e a apresentação dos controles; não verifica contratos de dados nem comportamento de backend.
