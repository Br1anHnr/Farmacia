# ADR-004 — Não Interpretar Receita Médica por IA no MVP

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
A leitura de receitas médicas por visão computacional e LLMs envolve caligrafias manuais médicas, abreviações de posologia e medicamentos de controle especial. Erros de interpretação representam risco grave à saúde do paciente e implicações jurídicas severas sob a regulação da Anvisa e LGPD (dados pessoais sensíveis de saúde).

## Decisão
No MVP, quando o cliente enviar uma imagem de receita:
1. O bot confirmará o recebimento com mensagem cordial padronizada: "Recebemos sua receita! Nossa equipe farmacêutica já está verificando para passar os valores e disponibilidade."
2. O bot não passará a imagem para qualquer provedor de IA e não tentará ler medicamentos ou dosagens.
3. A conversa é imediatamente transferida para a fila humana e o bot cessa suas respostas.

## Consequências
* **Positivas:** Zero risco clínico no MVP; segurança jurídica e conformidade sanitária; processo simples, rápido e seguro.
* **Mitigações:** Futura fase pós-MVP poderá introduzir OCR homologado sob supervisão farmacêutica estrita.
