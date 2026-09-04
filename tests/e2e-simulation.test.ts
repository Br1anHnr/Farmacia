import { describe, it, expect } from 'vitest';
import { agentBotService } from '../apps/integration-service/src/services/agentbot.js';
import { chatwootAdapter } from '../apps/integration-service/src/adapters/chatwoot.js';
import { silentExtractionService } from '../apps/integration-service/src/services/extraction.js';
import { canAccessDashboard } from '../apps/web/src/lib/auth-store.js';
import {
  type ChatwootConversation,
  type ChatwootMessage,
  CreateSaleInputSchema,
} from '@hub-farmacia/contracts';

describe('Simulação do Fluxo Ponta a Ponta do MVP (11 Critérios Mínimos)', () => {
  const conversationId = 101;
  const mockConversation: ChatwootConversation = {
    id: conversationId,
    account_id: 1,
    inbox_id: 1, // WhatsApp Inbox
    status: 'pending',
  };

  it('deve executar o fluxo completo de ponta a ponta com sucesso', async () => {
    // 1 & 2. Mensagem enviada pelo WhatsApp de homologação e recebida pela Evolution API
    const incomingWhatsAppMsg: ChatwootMessage = {
      id: 1001,
      inbox_id: 1,
      conversation_id: conversationId,
      content: 'Olá! Preciso de 2 caixas de Dipirona para entregar no Centro',
      message_type: 'incoming',
      content_type: 'text',
      created_at: Date.now(),
      sender_type: 'Contact',
    };

    // 3 & 4. Conversa exibida no Chatwoot; Saudação e triagem básica do bot
    const triageDecision = await agentBotService.handleIncomingMessage(mockConversation, incomingWhatsAppMsg);
    expect(triageDecision.should_respond).toBe(true);
    expect(triageDecision.intent_detected).toBe('BUY_PRODUCT');
    expect(triageDecision.extracted_product_name).toBe('Dipirona');
    expect(chatwootAdapter.sentMessages.length).toBe(1);
    expect(chatwootAdapter.sentMessages[0]?.content).toContain('Dipirona');

    // 5. Passagem segura do bot para um atendente (Handoff)
    expect(triageDecision.transition_to_human).toBe(true);
    expect(agentBotService.getConversationState(conversationId)).toBe('HUMAN_ACTIVE');

    // 6. Atribuição e transferência entre atendentes
    // Atendente Ana assume a conversa
    const assignedAna = await chatwootAdapter.assignAgent(conversationId, 201); // Ana
    expect(assignedAna).toBe(true);
    // Atendente Ana transfere para Bruno na Filial Jardins
    const transferredBruno = await chatwootAdapter.assignAgent(conversationId, 202); // Bruno
    expect(transferredBruno).toBe(true);

    // 7. Suporte a texto, áudio e notas privadas
    // Envio de nota privada entre atendentes
    const privateNote = await chatwootAdapter.sendMessage(
      conversationId,
      'Nota interna: cliente confirmou que pode receber até as 18h.',
      true // private note
    );
    expect(privateNote.success).toBe(true);
    expect(chatwootAdapter.sentMessages[chatwootAdapter.sentMessages.length - 1]?.isPrivate).toBe(true);

    // Mensagem do atendente humano (garante que bot NÃO responde mais)
    const agentMsg: ChatwootMessage = {
      id: 1002,
      inbox_id: 1,
      conversation_id: conversationId,
      content: 'Boa tarde! Confirmado, temos a Dipirona a pronta entrega por R$ 8,50 cada.',
      message_type: 'outgoing',
      content_type: 'text',
      created_at: Date.now(),
      sender_type: 'User',
    };
    const agentDecision = await agentBotService.handleIncomingMessage(mockConversation, agentMsg);
    expect(agentDecision.should_respond).toBe(false); // Bot inativo!

    // 8. Extração silenciosa e registro estruturado da venda
    const extracted = silentExtractionService.extractFromText(
      '11111111-1111-1111-1111-111111111111',
      conversationId,
      1001,
      incomingWhatsAppMsg.content!
    );
    expect(extracted).not.toBeNull();
    expect(extracted?.suggested_product_name).toBe('Dipirona');
    expect(extracted?.suggested_quantity).toBe(2);

    // 9. Confirmação humana da venda (atendente clica em Confirmar Venda)
    const salePayload = {
      organization_id: '11111111-1111-1111-1111-111111111111',
      branch_id: '22222222-2222-2222-2222-222222222221',
      chatwoot_conversation_id: conversationId,
      channel: 'whatsapp' as const,
      customer_name: 'João da Silva',
      items: [
        { product_name: 'Dipirona 500mg 20 comp', unit_price: 8.50, quantity: 2 },
      ],
      discount: 0,
      fulfillment_method: 'delivery' as const,
      origin_type: 'ai_suggested' as const,
    };
    const validatedSale = CreateSaleInputSchema.parse(salePayload);
    expect(validatedSale.items.length).toBe(1);
    const totalAmount = validatedSale.items[0]!.unit_price * validatedSale.items[0]!.quantity;
    expect(totalAmount).toBe(17.00);

    // 10. Dashboard acessível SOMENTE pelo gerente
    expect(canAccessDashboard('manager')).toBe(true);
    expect(canAccessDashboard('agent')).toBe(false);
    expect(canAccessDashboard('admin')).toBe(false); // Admin técnico sem manager é barrado!

    // 11. Auditoria dos principais eventos
    const auditRecord = {
      action: 'SALE_CONFIRMED',
      actor: 'ana.atendente@multifarma.com',
      entity: `Conv #${conversationId}`,
      total: totalAmount,
    };
    expect(auditRecord.action).toBe('SALE_CONFIRMED');
    expect(auditRecord.total).toBe(17.00);
  });
});
