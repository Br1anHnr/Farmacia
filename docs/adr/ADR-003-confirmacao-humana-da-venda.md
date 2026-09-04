# ADR-003 — Confirmação Humana Obrigatória para Registro de Vendas

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
O processo de atendimento em farmácia envolve negociações informais, substituição de marcas, conferência de dosagens, endereços de entrega e formas de pagamento. Permitir que uma IA feche vendas automaticamente ou registre vendas diretamente no faturamento sem validação humana acarreta alto risco de alucinação, erros contábeis e divergência no caixa.

## Decisão
Nenhuma venda será computada nos indicadores de faturamento, ticket médio ou conversão sem confirmação deliberada por um atendente humano. A IA atua apenas de forma silenciosa e consultiva, extraindo e sugerindo intenções e itens no painel lateral.

## Consequências
* **Positivas:** Confiança total dos gestores nos dados do dashboard; mitigação de erros de interpretação; conformidade com boas práticas farmacêuticas.
* **Mitigações:** Desenvolver um formulário lateral ultra ágil no Chatwoot (Dashboard App) para que o atendente confirme a venda em poucos cliques sem esforço manual.
