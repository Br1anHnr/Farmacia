# ADR-005 — Evolution API como Adaptador Reversível de WhatsApp

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
O cliente tem restrição de custos com a API Oficial do WhatsApp (Meta Cloud API) para o estágio inicial de validação. A Evolution API permite conectar instâncias de WhatsApp com agilidade utilizando QR Code na VPS Coolify. No entanto, soluções não-oficiais estão sujeitas a bloqueios caso haja mau uso.

## Decisão
* Utilizar a Evolution API no MVP, mas **exclusivamente com um chip/número separado de homologação**, jamais o número principal da farmácia.
* Isolar a comunicação atrás de uma interface desacoplada `WhatsAppAdapter` no backend.

## Consequências
* **Positivas:** Custo zero de mensagens no teste; agilidade na homologação; facilidade para conectar ao Chatwoot.
* **Mitigações:** Facilidade arquitetural para trocar a implementação interna por WhatsApp Cloud API oficial sem refatorar o núcleo de atendimento e vendas.
