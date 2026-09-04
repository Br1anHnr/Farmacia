# Runbook Operacional — Fallback Resiliente de Handoff Humano em Falhas de IA

## Objetivo
Garantir que nenhuma falha, timeout ou instabilidade do provedor de IA (Gemini / OpenAI / etc.) ou do serviço de integração interrompa ou impeça o atendimento ao cliente da farmácia.

---

## 1. Princípio Fundamental de Degradação Graciosa

> **Regra de Ouro:** Se a IA falhar ou o serviço de triagem demorar mais de 3 segundos para responder, a conversa DEVE ser imediatamente transferida para a fila de atendimento humano, marcada como aberta e priorizada. O cliente NUNCA fica no vácuo.

---

## 2. Comportamento Automático do Sistema

1. **Timeout Controlado**: O AgentBot possui um timeout de 3.000 ms para chamadas de IA.
2. **Circuit Breaker / Fallback**:
   - Em caso de timeout ou erro HTTP 5xx da API de IA, o sistema captura a exceção.
   - Envia automaticamente uma resposta de segurança ao cliente:
     > "Olá! Estamos direcionando sua conversa diretamente para nossa equipe de atendimento. Um de nossos atendentes já vai te responder!"
   - Executa uma chamada à API do Chatwoot alterando o status da conversa para `open` e desativando o bot (`bot_active: false`).
   - Registra o evento de falha em `audit_events` com categoria `AI_FALLBACK_TRIGGERED`.

---

## 3. Ações Manuais em Caso de Falha Generalizada da IA

Se a API de inteligência artificial estiver completamente fora do ar:
1. No Chatwoot, desative o **AgentBot** temporariamente nas configurações da Inbox (Caixa de Entrada).
2. O Chatwoot passará a receber todas as mensagens diretamente na fila dos atendentes sem passar pelo webhook do bot.
3. Os atendentes continuam trabalhando normalmente, trocando mensagens de texto, áudios e imagens.
4. O registro e confirmação manual de vendas através da Dashboard App lateral continua 100% funcional, pois independe da IA.
