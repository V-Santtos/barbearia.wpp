# AUDITORIA — leitura de ponta a ponta do sistema

Feita em **2026-08-28**, por quem acabou de pegar o projeto. O objetivo não é
julgar o trabalho anterior — é responder "o que é isto, o que funciona, o que
está quebrado e por onde se começa".

## O veredito em um parágrafo

**O código é bom e está saudável; o que está morto é a infraestrutura.** Os dois
serviços têm typecheck limpo, o bot tem 195 testes passando, o painel compila, e
a documentação de decisões é acima da média do mercado. O que não existe mais é o
**banco** — e como o repositório nunca soube reconstruir o schema, a ausência dele
trava tudo: não roda local, não roda no ar, e nenhum teste cobre a camada de SQL.
O primeiro trabalho não é código, é recriar o banco. Este diretório traz o schema
reconstruído a partir de cada query do código, que é o que torna isso possível.

## Os arquivos

| Arquivo | O que responde |
|---|---|
| [01-MAPA.md](01-MAPA.md) | O que é o sistema, quais são as peças, como uma mensagem atravessa tudo |
| [02-BANCO.md](02-BANCO.md) | **As 10 tabelas reconstruídas do código**, com DDL para recriar, e o que ficou incerto |
| [03-ROTAS.md](03-ROTAS.md) | Toda rota HTTP dos dois serviços, quem protege cada uma, o que vaza |
| [04-RISCOS.md](04-RISCOS.md) | Tudo que está quebrado ou perigoso, ranqueado por gravidade |
| [05-INVENTARIO.md](05-INVENTARIO.md) | O que é útil, o que é peso morto, o que dá pra apagar hoje |
| [06-RODAR.md](06-RODAR.md) | O caminho concreto para levantar o sistema |

## O que este diretório NÃO é

Não repete o que já está documentado. O repositório tem ~3.900 linhas de
documentação boa, e ela continua sendo a fonte:

- **`REGRAS-APRENDIZADOS/REGRAS.md`** (1.008 linhas, 34 decisões travadas) — o
  PORQUÊ de cada escolha de arquitetura. Ler antes de propor mudança.
- **`REGRAS-APRENDIZADOS/APRENDIZADOS.md`** — erros já cometidos, para não repetir.
- **`REGRAS-APRENDIZADOS/ANEXO_BANCO/README.md`** — armadilhas do banco.
- **`CONTEXTO.md`** — estado de curto prazo, o que estava em andamento.

Onde esta auditoria e a documentação existente divergirem, **a auditoria é mais
nova** — ela foi conferida contra o código em 28/08. Divergências conhecidas
estão anotadas em [04-RISCOS.md](04-RISCOS.md).

## Como foi verificado

O que está aqui foi lido no código ou executado, não presumido:

- `tsc --noEmit` nas duas pastas — passou;
- `vitest run` no bot — 195 testes, 13 arquivos, 0 falhas;
- `vite build` no painel — passou, 2120 módulos;
- schema derivado lendo **toda** query SQL dos 2.501 linhas de `server.js`, dos
  módulos `BARBEARIA/src/db/` e das 5 migrações;
- rotas e proteções lidas uma a uma no `server.js`.

**O que NÃO foi verificado, e é honesto dizer:** nada foi executado contra um
banco real, porque não existe um. Toda afirmação sobre o schema é inferência a
partir do código — boa, mas inferência. Ver a seção de incertezas em
[02-BANCO.md](02-BANCO.md).
