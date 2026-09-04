import { CONFIG } from '../config.js';

export interface EvolutionConnectionState {
  instanceName: string;
  state: 'open' | 'close' | 'connecting';
  status: string;
}

export class EvolutionAdapter {
  public async getConnectionState(): Promise<EvolutionConnectionState> {
    if (CONFIG.MOCK_MODE) {
      return {
        instanceName: CONFIG.EVOLUTION_INSTANCE_NAME,
        state: 'open',
        status: 'CONNECTED_MOCK',
      };
    }

    try {
      const res = await fetch(`${CONFIG.EVOLUTION_API_URL}/instance/connectionState/${CONFIG.EVOLUTION_INSTANCE_NAME}`, {
        headers: {
          apikey: CONFIG.EVOLUTION_API_KEY,
        },
      });

      if (!res.ok) {
        return {
          instanceName: CONFIG.EVOLUTION_INSTANCE_NAME,
          state: 'close',
          status: `HTTP_${res.status}`,
        };
      }

      const data = await res.json() as { instance?: { state?: 'open' | 'close' | 'connecting' } };
      return {
        instanceName: CONFIG.EVOLUTION_INSTANCE_NAME,
        state: data.instance?.state || 'close',
        status: 'OK',
      };
    } catch (err) {
      return {
        instanceName: CONFIG.EVOLUTION_INSTANCE_NAME,
        state: 'close',
        status: (err as Error).message,
      };
    }
  }

  public async sendTextMessage(phone: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    if (CONFIG.MOCK_MODE) {
      return { success: true, messageId: `mock_msg_${Date.now()}` };
    }

    try {
      const res = await fetch(`${CONFIG.EVOLUTION_API_URL}/message/sendText/${CONFIG.EVOLUTION_INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phone,
          options: { delay: 1200, presence: 'composing', linkPreview: false },
          textMessage: { text },
        }),
      });

      if (!res.ok) {
        throw new Error(`Evolution API error: ${res.status}`);
      }

      const data = await res.json() as { key?: { id?: string } };
      return { success: true, messageId: data.key?.id };
    } catch (err) {
      console.error('[EvolutionAdapter] Erro ao enviar mensagem via Evolution:', err);
      return { success: false };
    }
  }
}

export const evolutionAdapter = new EvolutionAdapter();
