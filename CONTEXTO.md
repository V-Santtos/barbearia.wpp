# Contexto atual

Este arquivo registra somente o estado e o próximo passo. O histórico de sessões anterior a esta limpeza está em docs/historico/CONTEXTO-ate-2026-09-26.md. Decisões duráveis ficam em REGRAS-APRENDIZADOS/REGRAS.md; avaliações de skills ficam em docs/skills-log.md.

## Papel deste checkout

Esta pasta é a casca do agendamento online e do painel do dono. Victor e o agente lapidam a interface em CALENDARIO/ para entregá-la ao desenvolvedor, que trabalha no backend do mesmo produto em outro ambiente. BARBEARIA/ preserva o bot de WhatsApp como referência de contingência; CALENDARIO/server.js preserva contratos antigos. Nenhum dos dois comprova o estado atual do backend dele. Não ampliar API, banco, Supabase ou bot sem pedido explícito.

O Supabase antigo desta cópia estava indisponível em 2026-09-26 e não será o banco de produção. Para validar a interface sem rede, usar VITE_MOCK=1. A interface visual usa o transporte de services/calendarApi.ts; o adapter de teste fica em services/mock/.

## Estado de trabalho

- Branch: casca-de-secoes. Há alterações locais ainda não commitadas no calendário e na documentação; preservar o diff. Inventário atual das skills em docs/skills-log.md.
- A segunda rodada visual de 2026-09-26 (KPIs, período de 7 dias, ListaFluxo, janelas em folha, barra de rolagem global) foi commitada em 2026-09-27. Falta conferir no iPhone.
- Agenda, Conversas, Dashboard e Financeiro são seções irmãs no desktop. No celular e no tablet, o Financeiro fica dentro da aba Dashboard, e a troca é uma pílula “Dashboard | Financeiro” no topo (2026-09-27; antes era o título com seta).
- O Financeiro usa movimentos manuais e categorias criadas pelo barbeiro em memória, mais dados demonstrativos no modo mock. Não tratar essa interface como persistência pronta.
- Rodada de 2026-09-27, commitada: lançamento manual só com Entrada e Saída (Ajuste removido), categorias mínimas com “+ Nova categoria”, comissão com barbeiro, máscara de moeda, Faturamento = atendimentos + entradas, Comparar períodos com Semana/Mês/Ano, e o resumo “Fechar atendimento” no “Marcar como feito” (vários serviços, acréscimo/desconto, cliente opcional no presencial). Nenhum card é concluído sozinho e o presencial não se apaga. Decisões em `REGRAS-APRENDIZADOS/REGRAS.md`; desenho em `docs/superpowers/specs/2026-09-27-fechar-atendimento-design.md`. A rota nova `POST agendamentos/:id/concluir` existe só no mock e precisa do dev.
- A rota de busca de cliente por telefone e outras regras novas desta casca ainda não foram verificadas contra o banco novo do desenvolvedor.
- O template externo de dashboard usado como referência foi recuperado em C:\Users\victo\Desktop\Referencias\dashboard-shadcn-admin. Ele não faz parte do produto; fonte e versão estão em docs/skills-log.md.
- Em 2026-09-27, a configuração do site público saiu da montagem do painel oculto em `Barbearia Site/Aplicativo FULL/SITE-BARB-PROF-UNICO` e ganhou um modal centralizado na engrenagem do calendário (desktop) e no menu do avatar (celular). As três áreas são Página de agendamento, Categorias e Serviços e preços. O fluxo foi conferido com `VITE_MOCK=1`; os contratos de escrita ainda dependem do backend do dev e o mock dos dois frontends não é compartilhado. Ver `docs/superpowers/specs/2026-09-27-configuracoes-site-agendamento.md`.
- A rodada visual de 2026-09-27 alinhou o site público ao painel: CTA da home, proporção no celular, cartões de serviço, descrições em Inter, espaçamento das etapas, calendário na virada de mês e resumo final. Victor manteve o degradê roxo do título e adiou a revisão geral da tipografia. O roteamento do botão de serviço para a segunda etapa fica com o dev. As decisões duráveis estão em `REGRAS-APRENDIZADOS/REGRAS.md`.
- O modal de Configurações foi refinado em `CALENDARIO/components/settings/BookingSiteSettings.tsx`: campos compartilhados com o calendário, seleção de categorias pelo `NeonCheckbox`, menu “Página inicial”, menos divisores e estado ocioso sem “Tudo atualizado”. Depois do feedback de Victor, a lateral desktop passou a compartilhar o fundo do modal e a começar na altura do título; o ícone do cabeçalho ficou maior e sem círculo. Conferido no navegador em largura estreita e a 1440 px; `npx tsc --noEmit`, `npm run build` e `git diff --check` passaram. As alterações continuam locais e ainda podem receber avaliação visual do dono.

## Etapa atual: mapa de integração para o dev

O inventário dos endpoints consumidos pelo agendamento online e pelo calendário/dashboard está em `docs/mapa-endpoints-frontend.md` (2026-09-27). O levantamento diferencia contratos em uso, mocks, servidor antigo e lacunas; não inclui o bot. Próximo passo: o dev confrontar o mapa com seu backend atual e decidir os ajustes de formato e autenticação, sem assumir que esta casca comprova as rotas de produção.

## Pendências de produto já abertas com Victor

- Avaliar o espaço vazio abaixo das seções na coluna desktop, sem inventar função para preenchê-lo.
- Conferir no celular o resumo “Fechar atendimento” e a pílula Dashboard | Financeiro com o dono.
- Agendamentos que ninguém marcar como feito ficam pendentes na agenda; decidir se isso pede um aviso de pendentes.
- Conferir a rodada mobile pendente no iPhone e a tabela de Movimentações a 375 px, onde data e valor podem quebrar linha.
- Retomar a fila de Conversas desktop somente com o feedback visual do dono.
- A varredura de tema claro foi adiada pelo dono em 2026-09-26. Não iniciar sem nova decisão de paleta e escopo.

Consulte o histórico arquivado somente quando um detalhe de uma rodada antiga for necessário. Para decisões, prefira a regra mais recente e confira se a implementação atual a confirma.
