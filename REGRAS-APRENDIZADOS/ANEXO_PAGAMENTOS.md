# Anexo: Pagamentos / Billing

Base de conhecimento sobre provedores de pagamento para a assinatura mensal do SaaS
(o dono da barbearia paga pela plataforma; o cliente final não paga nada nela).
Decisão travada em `REGRAS.md`. Buscar aqui antes de avaliar qualquer novo provedor.

## Comparativo de taxas (2026-07-29)

| Provedor | Pix | Boleto | Cartão | Mensalidade |
|---|---|---|---|---|
| **Asaas** | R$1,99/transação (R$0,99 nos 3 primeiros meses) | R$3,49 | 1,99% + R$0,49 | Nenhuma |
| **AbacatePay** | R$0,80/transação | R$2,50 | 3,5% + R$0,60 | Nenhuma |

## ✅ Asaas — decisão travada (provedor principal)
- Fintech brasileira madura e estabelecida, histórico longo processando cobrança
  recorrente. Pix nativo, boleto, régua de cobrança/inadimplência automática.
  Cartão mais barato que o AbacatePay (1,99%+R$0,49 vs. 3,5%+R$0,60).
- Migrar (parcial) para **Pix Automático** — débito recorrente do Banco Central,
  lançado em 2026-01, taxa 0,22–0,35% — quando a base passar de ~200-300
  assinantes ativos. Antes disso, a integração extra não compensa a economia.

## ⏸️ AbacatePay — parqueado como candidato
- Fonte: https://www.abacatepay.com/
- Fintech com ~1 ano de existência (fundadores Daniel Lima e Christopher Ribeiro),
  posicionada para indie hackers/micro-SaaS. Pix e boleto mais baratos que o Asaas.
  Cartão mais caro. **Não encontrei confirmação de licenciamento como instituição
  de pagamento pelo Banco Central** — pode operar sob parceira licenciada (comum
  no setor), mas isso não é explícito na documentação pública.
- Por que não virou decisão agora: essa peça guarda a receita real de assinatura
  dos donos de barbearia pagantes — maturidade/clareza regulatória pesa mais que
  economizar ~R$1,19 por transação Pix nesta fase. Risco de instabilidade
  operacional/regulatória de uma fintech de 1 ano não compensa a economia de taxa
  no volume inicial (dezenas de tenants).
- **Gatilho para revisitar:** (a) confirmar status de licenciamento/parceria
  regulatória do AbacatePay, ou (b) volume de transações Pix crescer o bastante
  para a diferença de taxa se tornar materialmente relevante, ou (c) o Asaas
  apresentar algum problema real de confiabilidade/suporte.
