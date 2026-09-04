import { describe, it, expect, beforeEach } from 'vitest';
import { agentBotService } from '../services/agentbot.js';
import { idempotencyService } from '../services/idempotency.js';
import { chatwootAdapter } from '../adapters/chatwoot.js';
import { type ChatwootConversation, type ChatwootMessage } from '@hub-farmacia/contracts';

describe('AgentBot Service & Handoff Tests', () => {
  const mockConversation: ChatwootConversation = {
    id: 101,
    account_id: 1,
    inbox_id: 1,
    status: 'pending',
  };

  beforeEach(() => {
    agentBotService.resetAllStates();
    idempotencyService.clear();
    chatwootAdapter.clearMockHistory();
  });

  it('deve realizar triagem inicial com saudação cordial para mensagem genérica', async () => {
    const message: ChatwootMessage = {
      id: 1,
      inbox_id: 1,
      conversation_id: 101,
      content: 'Olá, boa tarde!',
      message_type: 'incoming',
      content_type: 'text',
      created_at: Date.now(),
      private: false,
      sender_type: 'Contact',
    };

    const decision = await agentBotService.handleIncomingMessage(mockConversation, message);

    expect(decision.should_respond).toBe(true);
    expect(decision.intent_detected).toBe('GENERAL_QUESTION');
    expect(decision.transition_to_human).toBe(false);
    expect(chatwootAdapter.sentMessages.length).toBe(1);
    expect(chatwootAdapter.sentMessages[0]?.content).toContain('MultiFarma');
  });

  it('deve reconhecer receita médica, enviar confirmação cordial sem diagnóstico e fazer handoff imediato', async () => {
    const message: ChatwootMessage = {
      id: 2,
      inbox_id: 1,
      conversation_id: 101,
      content: 'Segue a foto da minha receita médica',
      message_type: 'incoming',
      content_type: 'text',
      created_at: Date.now(),
      private: false,
      sender_type: 'Contact',
      attachments: [{
        id: 99,
        file_type: 'image',
        data_url: 'https://exemplo.com/receita-sintetica.jpg'
      }]
    };

    const decision = await agentBotService.handleIncomingMessage(mockConversation, message);

    expect(decision.should_respond).toBe(true);
    expect(decision.intent_detected).toBe('SEND_PRESCRIPTION');
    expect(decision.transition_to_human).toBe(true);
    // Verifica confirmação cordial sem interpretar
    expect(decision.bot_message).toContain('Recebemos sua receita médica');
    expect(decision.bot_message).toContain('equipe farmacêutica já está verificando');
    // Verifica desligamento atômico do bot
    expect(agentBotService.getConversationState(101)).toBe('HUMAN_ACTIVE');
  });

  it('deve priorizar pedido explícito de humano e desligar o bot', async () => {
    const message: ChatwootMessage = {
      id: 3,
      inbox_id: 1,
      conversation_id: 101,
      content: 'Quero falar com um atendente humano agora',
      message_type: 'incoming',
      content_type: 'text',
      created_at: Date.now(),
      private: false,
      sender_type: 'Contact',
    };

    const decision = await agentBotService.handleIncomingMessage(mockConversation, message);

    expect(decision.should_respond).toBe(true);
    expect(decision.intent_detected).toBe('TALK_TO_HUMAN');
    expect(decision.transition_to_human).toBe(true);
    expect(agentBotService.getConversationState(101)).toBe('HUMAN_ACTIVE');
  });

  it('REGRA CRÍTICA: bot NUNCA responde após conversa passar para HUMAN_ACTIVE', async () => {
    // 1. Força a conversa para estado HUMAN_ACTIVE (atendente assumiu)
    agentBotService.deactivateBotForConversation(101, 'ATENDENTE_ASSUMIU');

    const customerMessage: ChatwootMessage = {
      id: 4,
      inbox_id: 1,
      conversation_id: 101,
      content: 'Qual o valor da dipirona?',
      message_type: 'incoming',
      content_type: 'text',
      created_at: Date.now(),
      private: false,
      sender_type: 'Contact',
    };

    const decision = await agentBotService.handleIncomingMessage(mockConversation, customerMessage);

    expect(decision.should_respond).toBe(false);
    expect(decision.reason).toBe('HUMAN_ALREADY_ACTIVE');
    expect(chatwootAdapter.sentMessages.length).toBe(0); // Nenhuma mensagem enviada pelo bot!
  });

  it('REGRA CRÍTICA: bot NUNCA responde para mensagens enviadas por atendente humano (User)', async () => {
    const agentMessage: ChatwootMessage = {
      id: 5,
      inbox_id: 1,
      conversation_id: 101,
      content: 'Olá! Meu nome é Ana, sou a farmacêutica. Como posso ajudar?',
      message_type: 'outgoing',
      content_type: 'text',
      created_at: Date.now(),
      private: false,
      sender_type: 'User',
    };

    const decision = await agentBotService.handleIncomingMessage(mockConversation, agentMessage);

    expect(decision.should_respond).toBe(false);
    expect(decision.reason).toBe('AGENT_SENT_MESSAGE');
    expect(agentBotService.getConversationState(101)).toBe('HUMAN_ACTIVE');
  });

  it('deve garantir IDEMPOTÊNCIA: processar a mesma mensagem apenas uma vez', () => {
    const key = 'agentbot_msg_999';

    expect(idempotencyService.shouldProcess(key)).toBe(true);
    idempotencyService.markCompleted(key, { ok: true });

    // Segunda tentativa imediata com a mesma chave deve ser bloqueada
    expect(idempotencyService.shouldProcess(key)).toBe(false);
  });
});
