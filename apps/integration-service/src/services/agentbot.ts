import {
  type PharmacyIntent,
  type ConversationState,
  type BotHandoffDecision,
  type ChatwootMessage,
  type ChatwootConversation,
} from '@hub-farmacia/contracts';
import { chatwootAdapter } from '../adapters/chatwoot.js';

export class AgentBotService {
  // Controle de estado em memória por ID de conversa do Chatwoot
  private conversationStates = new Map<number, ConversationState>();

  public getConversationState(conversationId: number): ConversationState {
    return this.conversationStates.get(conversationId) || 'BOT_ACTIVE';
  }

  public setConversationState(conversationId: number, state: ConversationState): void {
    this.conversationStates.set(conversationId, state);
  }

  /**
   * Desligamento atômico do bot:
   * Chamado quando um atendente humano envia mensagem ou assume a conversa.
   */
  public deactivateBotForConversation(conversationId: number, reason: string): void {
    this.conversationStates.set(conversationId, 'HUMAN_ACTIVE');
    console.log(`[AgentBot] Bot desativado atomicamente para conversa #${conversationId}. Motivo: ${reason}`);
  }

  /**
   * Processa a mensagem recebida e decide a resposta ou handoff.
   */
  public async handleIncomingMessage(
    conversation: ChatwootConversation,
    message: ChatwootMessage
  ): Promise<BotHandoffDecision> {
    const conversationId = conversation.id;
    const currentState = this.getConversationState(conversationId);

    // 1. REGRA CRÍTICA: Se a conversa já está com humano, bot NUNCA responde
    if (currentState === 'HUMAN_ACTIVE') {
      return {
        should_respond: false,
        intent_detected: 'UNKNOWN',
        confidence: 1.0,
        transition_to_human: false,
        reason: 'HUMAN_ALREADY_ACTIVE',
      };
    }

    // 2. REGRA CRÍTICA: Se quem enviou foi um agente (User) ou nota privada, desliga o bot atomicamente
    if (message.sender_type === 'User' || message.private) {
      this.deactivateBotForConversation(conversationId, 'AGENT_INTERVENTION');
      return {
        should_respond: false,
        intent_detected: 'UNKNOWN',
        confidence: 1.0,
        transition_to_human: false,
        reason: 'AGENT_SENT_MESSAGE',
      };
    }

    const content = (message.content || '').trim().toLowerCase();
    const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);

    // 3. REGRA CRÍTICA: Detecção de Receita Médica (texto ou anexo de imagem/arquivo)
    const isPrescriptionMention = content.includes('receita') || content.includes('médico') || content.includes('prescrição') || content.includes('receituário');
    if (hasAttachments || isPrescriptionMention) {
      // Confirmação cordial sem diagnóstico clínico e handoff imediato
      const botMessage = '👋 Olá! Recebemos sua receita médica com sucesso.\nNossa equipe farmacêutica já está verificando os medicamentos para te passar os valores e a disponibilidade! 🛵💨';
      
      await chatwootAdapter.sendMessage(conversationId, botMessage);
      await chatwootAdapter.updateStatus(conversationId, 'open');
      await chatwootAdapter.addLabels(conversationId, ['receita-medica', 'farmaceutico']);
      this.deactivateBotForConversation(conversationId, 'PRESCRIPTION_RECEIVED');

      return {
        should_respond: true,
        bot_message: botMessage,
        intent_detected: 'SEND_PRESCRIPTION',
        confidence: 0.95,
        transition_to_human: true,
        reason: 'PRESCRIPTION_HANDOFF',
      };
    }

    // 4. REGRA CRÍTICA: Pedido explícito de falar com atendente / humano
    if (
      content.includes('humano') ||
      content.includes('atendente') ||
      content.includes('pessoa') ||
      content.includes('falar com alguém') ||
      content.includes('falar com atendente')
    ) {
      const botMessage = 'Entendido! Estou transferindo agora mesmo para um de nossos atendentes humanos. Um momento, por favor!';
      await chatwootAdapter.sendMessage(conversationId, botMessage);
      await chatwootAdapter.updateStatus(conversationId, 'open');
      await chatwootAdapter.addLabels(conversationId, ['atendimento-humano']);
      this.deactivateBotForConversation(conversationId, 'USER_REQUESTED_HUMAN');

      return {
        should_respond: true,
        bot_message: botMessage,
        intent_detected: 'TALK_TO_HUMAN',
        confidence: 1.0,
        transition_to_human: true,
        reason: 'EXPLICIT_HUMAN_REQUEST',
      };
    }

    // 5. Intenção: Compra de Produto / Medicamento (prioridade se mencionar remédio ou intenção de compra)
    const intent = this.classifyIntent(content);
    if (intent === 'BUY_PRODUCT') {
      const extractedProduct = this.extractProductName(content);
      const botMessage = `👋 Olá! Que ótimo que você entrou em contato.\nJá localizei seu interesse em *${extractedProduct}*. Estamos direcionando sua conversa para a equipe confirmar disponibilidade e valores para entrega ou retirada! 🛵`;

      await chatwootAdapter.sendMessage(conversationId, botMessage);
      await chatwootAdapter.updateStatus(conversationId, 'open');
      await chatwootAdapter.addLabels(conversationId, ['venda-medicamento', 'comercial']);
      this.deactivateBotForConversation(conversationId, 'BUY_PRODUCT_HANDOFF');

      return {
        should_respond: true,
        bot_message: botMessage,
        intent_detected: 'BUY_PRODUCT',
        confidence: 0.9,
        transition_to_human: true,
        reason: 'PRODUCT_PURCHASE_INTENT',
        extracted_product_name: extractedProduct,
      };
    }

    // 6. Intenção: Consultar Pedido
    if (
      content.includes('meu pedido') ||
      content.includes('onde está') ||
      content.includes('rastreio') ||
      content.includes('status do pedido') ||
      content.includes('cadê') ||
      (content.includes('entrega') && (content.includes('quando') || content.includes('saiu') || content.includes('atrasad') || content.includes('status')))
    ) {
      const botMessage = 'Você gostaria de consultar o status da sua entrega? Já chamei um atendente para localizar seu pedido!';
      await chatwootAdapter.sendMessage(conversationId, botMessage);
      await chatwootAdapter.updateStatus(conversationId, 'open');
      await chatwootAdapter.addLabels(conversationId, ['status-pedido', 'logistica']);
      this.deactivateBotForConversation(conversationId, 'CHECK_ORDER');

      return {
        should_respond: true,
        bot_message: botMessage,
        intent_detected: 'CHECK_ORDER',
        confidence: 0.85,
        transition_to_human: true,
        reason: 'ORDER_INQUIRY',
      };
    }

    // 7. Saudação Inicial / Triagem Genérica
    const greetingMessage = '👋 Olá! Seja bem-vindo(a) à MultiFarma.\nComo podemos te ajudar hoje?\n1️⃣ Comprar medicamentos ou perfumaria\n2️⃣ Enviar uma receita médica\n3️⃣ Consultar um pedido em andamento\n4️⃣ Falar com um atendente\n\nVocê já pode adiantar o que precisa por aqui!';
    await chatwootAdapter.sendMessage(conversationId, greetingMessage);
    await chatwootAdapter.addLabels(conversationId, ['triagem-bot']);
    this.setConversationState(conversationId, 'TRIAGING');

    return {
      should_respond: true,
      bot_message: greetingMessage,
      intent_detected: 'GENERAL_QUESTION',
      confidence: 0.7,
      transition_to_human: false,
      reason: 'INITIAL_TRIAGE_GREETING',
    };
  }

  private classifyIntent(text: string): PharmacyIntent {
    const buyKeywords = ['comprar', 'preço', 'valor', 'tem', 'remedio', 'remédio', 'dipirona', 'paracetamol', 'dorflex', 'amoxicilina', 'vitamina', 'pomada', 'protetor'];
    for (const kw of buyKeywords) {
      if (text.includes(kw)) {
        return 'BUY_PRODUCT';
      }
    }
    return 'UNKNOWN';
  }

  private extractProductName(text: string): string {
    const knownProducts = [
      'dipirona',
      'paracetamol',
      'amoxicilina',
      'dorflex',
      'omeprazol',
      'vitamina c',
      'protetor solar',
    ];
    for (const prod of knownProducts) {
      if (text.includes(prod)) {
        return prod.charAt(0).toUpperCase() + prod.slice(1);
      }
    }
    return 'medicamento desejado';
  }

  public resetAllStates(): void {
    this.conversationStates.clear();
  }
}

export const agentBotService = new AgentBotService();
