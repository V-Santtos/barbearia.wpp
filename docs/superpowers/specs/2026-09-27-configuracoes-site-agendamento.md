# Configurações do site público no calendário

**Data:** 2026-09-27  
**Estado:** casca visual refinada com Victor; integração de produção pendente

## Decisão de produto

O dono edita a página de agendamento dentro do calendário administrativo. A
engrenagem da barra superior abre um modal centralizado no desktop; no celular,
o menu do avatar oferece o mesmo acesso ao lado de Perfil e Tema. O modal tem
três áreas: Página de agendamento (textos da home), Categorias (rótulo,
visibilidade e filtro) e Serviços e preços
(nome, descrição, categoria e preço). Configurar a agenda de um profissional
continua no seu fluxo próprio.

O site público de agendamento está em outra pasta, `Barbearia Site/Aplicativo
FULL/SITE-BARB-PROF-UNICO`. `AdminDrawer` deixou de ser montado em sua
`HomePage.tsx`. O site permanece leitor dos dados publicados.

## Interface e validação

O modal usa a tipografia e os tokens do calendário. O menu chama a primeira área
de “Página inicial”, sem quebrar o rótulo; o título do conteúdo continua “Página
de agendamento”. A navegação é horizontal em telas estreitas e lateral no desktop.
Na composição desktop, lateral e conteúdo têm o mesmo fundo e o topo do primeiro
item se alinha ao título do conteúdo. O ícone do cabeçalho fica maior, sem fundo
circular. O modal tem largura máxima de 1040 px, altura limitada a 760 px no
desktop e 12 px de margem nas telas estreitas; a aba simples pode ficar menor.

Os campos reutilizam `CAMPO` e `FUNDO_CAMPO_MODAL`; as categorias usam o
`NeonCheckbox` com cor do token `accent-400`. Tom e espaço substituem divisores
e contornos redundantes. O rodapé mantém Salvar disponível visualmente quando
há mudanças e não mostra “Tudo atualizado” no estado ocioso. Mensagens de
alteração, erro e salvamento continuam aparecendo quando relevantes. Preços são
apresentados em reais e o conteúdo longo dos serviços pode ocupar duas linhas.
Fechar com alterações não salvas pede confirmação. O modo `VITE_MOCK=1` permite
validar edição e salvamento somente na memória do calendário; o site público
em `localhost:3001` usa outro mock e não recebe essas alterações.

## Contrato para o desenvolvedor

O transporte está em `CALENDARIO/services/calendarApi.ts`. O backend novo deve
confirmar ou adaptar estes recursos para que ambos os frontends compartilhem a
mesma fonte:

| Método | Rota | Corpo/resultado |
|---|---|---|
| GET/PUT | `/configuracao/home` | `{heroLine1, heroName, ctaLabel}` |
| GET/PUT | `/categorias-servicos` | `{filtersEnabled, items: [{id, label, active}]}` |
| GET/PUT | `/servicos` | `[{id, slug, category, name, desc, price}]` |

`price` é string decimal em reais, e `category` referencia o `id` estável da
categoria. A interface não permite remover categoria com serviços vinculados.
Na casca, três escritas acontecem em sequência; se o backend precisar publicar
tudo de uma vez, oferecer uma operação atômica e adaptar o transporte. O
`CALENDARIO/server.js` antigo **não** comprova a existência dessas rotas: ele
removeu as escritas de configuração. O backend do dev deve autorizar as
alterações pela sessão do dono no servidor, sem depender de senha ou token
embutido no JavaScript público.
