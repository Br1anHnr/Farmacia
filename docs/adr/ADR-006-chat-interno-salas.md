# ADR-006 — Arquitetura de Comunicação Interna: Notas Privadas vs Salas de Chat

* **Status:** Aprovado
* **Data:** 03/09/2026
* **Decisores:** Brian, Fábio, Vitor

## Contexto
Atendentes de farmácia precisam de dois tipos de comunicação interna:
1. Comunicação contextual sobre um cliente específico (ex: "cliente pediu entrega urgente no bairro São Pedro, verificar se temos motoboy").
2. Comunicação geral da equipe e de filiais (ex: avisos de plantão, falta de energia em uma unidade, comunicação entre filiais).

## Decisão
* **Comunicação sobre cliente/atendimento:** Feita obrigatoriamente através de **Notas Privadas** no próprio Chatwoot (invisíveis para o cliente externo e gravadas no histórico da conversa).
* **Comunicação geral/institucional:** Feita no hub próprio via **Salas Internas** utilizando Supabase Realtime (uma Sala Geral e salas específicas por Filial).

## Consequências
* **Positivas:** Contexto do cliente nunca se perde fora da conversa; equipe mantém um canal de colaboração direto e moderno sem sobrecarregar a central de clientes.
* **Mitigações:** No MVP, as salas internas suportam apenas mensagens de texto e presença, evitando escopo inflado com áudios, anexos e chamadas.
