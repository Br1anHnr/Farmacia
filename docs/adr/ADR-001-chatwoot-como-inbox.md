# ADR-001 — Usar Chatwoot como Central Operacional de Atendimento

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
A farmácia necessita de uma plataforma omnichannel para unificar WhatsApp, Instagram e Messenger, gerenciar equipes de atendentes, conversas simultâneas, atribuições, transferências, notas internas privadas e mídias (texto, imagem, áudio, documentos). Reconstruir essa infraestrutura do zero consumiria meses de desenvolvimento e apresentaria alto risco operacional.

## Decisão
Utilizar o Chatwoot (versão self-hosted no Coolify) como a central operacional de atendimento. O hub próprio da farmácia não substituirá o Chatwoot, mas será integrado a ele via Webhooks, AgentBot e Dashboard Apps (iframes incorporados).

## Consequências
* **Positivas:** Redução dramática do tempo de colocação no mercado; suporte maduro a filas, atendentes e canais; foco total da engenharia nos diferenciais do negócio (vendas estruturadas, triagem de farmácia e dashboard executivo).
* **Mitigações:** Evitar acoplamento profundo às tabelas internas do Chatwoot; toda comunicação será realizada via APIs e webhooks oficiais.
