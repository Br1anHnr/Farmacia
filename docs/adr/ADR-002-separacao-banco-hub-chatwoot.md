# ADR-002 — Separação entre Banco Operacional (Chatwoot) e Banco do Hub (Supabase)

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
O Chatwoot possui seu próprio banco PostgreSQL para controle de mensagens, conversas, contatos e anexos. Existia a opção de reutilizar o banco do Chatwoot para gravar os dados comerciais ou manter um banco dedicado.

## Decisão
Manter os bancos estritamente separados:
* O PostgreSQL interno do Chatwoot permanece exclusivo para o funcionamento do Chatwoot.
* O Supabase (PostgreSQL gerenciado) é a fonte de verdade para os dados de negócio do Hub: organizações, filiais, perfis, catálogo provisório, vendas, itens vendidos, sugestões silenciosas de IA, auditoria e salas internas.

## Consequências
* **Positivas:** Isolamento de falhas e de segurança; facilidade para aplicar Row Level Security (RLS) sob medida para farmácias; facilidade para substituir ou atualizar o Chatwoot sem risco de corrupção ou migração no banco de vendas; cumprimento de princípios de minimização de dados da LGPD (não duplicar histórico sensível de conversas).
* **Mitigações:** Referenciar conversas do Chatwoot no Supabase via identificador externo (`chatwoot_conversation_id`).
