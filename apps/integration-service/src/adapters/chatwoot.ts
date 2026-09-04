import { CONFIG } from '../config.js';

export interface ChatwootSendMessagePayload {
  content: string;
  message_type?: 'incoming' | 'outgoing';
  private?: boolean;
}

export class ChatwootAdapter {
  // Histórico em memória para validação em testes e simulações
  public sentMessages: Array<{ conversationId: number; content: string; isPrivate: boolean; timestamp: string }> = [];
  public conversationStatuses: Map<number, string> = new Map();
  public conversationAssignees: Map<number, number> = new Map();

  public async sendMessage(conversationId: number, content: string, isPrivate = false): Promise<{ id: number; success: boolean }> {
    this.sentMessages.push({
      conversationId,
      content,
      isPrivate,
      timestamp: new Date().toISOString(),
    });

    if (CONFIG.MOCK_MODE) {
      return { id: Math.floor(Math.random() * 10000), success: true };
    }

    try {
      const res = await fetch(`${CONFIG.CHATWOOT_BASE_URL}/api/v1/accounts/${CONFIG.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': CONFIG.CHATWOOT_API_TOKEN,
        },
        body: JSON.stringify({
          content,
          message_type: 'outgoing',
          private: isPrivate,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chatwoot API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as { id: number };
      return { id: data.id, success: true };
    } catch (err) {
      console.error(`[ChatwootAdapter] Erro ao enviar mensagem para conv #${conversationId}:`, err);
      // Retorna sucesso degradado em ambiente de desenvolvimento
      return { id: -1, success: false };
    }
  }

  public async updateStatus(conversationId: number, status: 'open' | 'resolved' | 'pending' | 'snoozed'): Promise<boolean> {
    this.conversationStatuses.set(conversationId, status);

    if (CONFIG.MOCK_MODE) {
      return true;
    }

    try {
      const res = await fetch(`${CONFIG.CHATWOOT_BASE_URL}/api/v1/accounts/${CONFIG.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/toggle_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': CONFIG.CHATWOOT_API_TOKEN,
        },
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch (err) {
      console.error(`[ChatwootAdapter] Erro ao atualizar status conv #${conversationId}:`, err);
      return false;
    }
  }

  public async assignAgent(conversationId: number, assigneeId: number): Promise<boolean> {
    this.conversationAssignees.set(conversationId, assigneeId);

    if (CONFIG.MOCK_MODE) {
      return true;
    }

    try {
      const res = await fetch(`${CONFIG.CHATWOOT_BASE_URL}/api/v1/accounts/${CONFIG.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': CONFIG.CHATWOOT_API_TOKEN,
        },
        body: JSON.stringify({ assignee_id: assigneeId }),
      });
      return res.ok;
    } catch (err) {
      console.error(`[ChatwootAdapter] Erro ao atribuir agente conv #${conversationId}:`, err);
      return false;
    }
  }

  public clearMockHistory(): void {
    this.sentMessages = [];
    this.conversationStatuses.clear();
    this.conversationAssignees.clear();
  }
}

export const chatwootAdapter = new ChatwootAdapter();
