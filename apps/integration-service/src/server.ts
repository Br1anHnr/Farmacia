import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { idempotencyService } from './services/idempotency.js';
import { agentBotService } from './services/agentbot.js';
import { silentExtractionService } from './services/extraction.js';
import { evolutionAdapter } from './adapters/evolution.js';
import { chatwootAdapter } from './adapters/chatwoot.js';
import {
  AgentBotPayloadSchema,
  ChatwootWebhookEventSchema,
} from '@hub-farmacia/contracts';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 1. Health Check Endpoint
app.get('/internal/health', async (_req: Request, res: Response) => {
  const evolutionState = await evolutionAdapter.getConnectionState();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    mock_mode: CONFIG.MOCK_MODE,
    evolution: {
      instance: evolutionState.instanceName,
      state: evolutionState.state,
      status: evolutionState.status,
    },
    chatwoot: {
      base_url: CONFIG.CHATWOOT_BASE_URL,
      status: 'connected',
    },
    service: 'MultiFarma Integration Hub',
  });
});

// 2. Chatwoot AgentBot Endpoint
app.post('/internal/chatwoot/agent-bot', async (req: Request, res: Response) => {
  try {
    const parseResult = AgentBotPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        details: parseResult.error.errors,
      });
    }

    const { conversation, message } = parseResult.data;
    if (!message) {
      return res.status(200).json({ status: 'NO_MESSAGE' });
    }

    // Chave de idempotência única por mensagem
    const idempotencyKey = `agentbot_msg_${message.id}`;
    if (!idempotencyService.shouldProcess(idempotencyKey)) {
      return res.status(200).json({ status: 'DUPLICATE_IGNORED' });
    }

    const decision = await agentBotService.handleIncomingMessage(conversation, message);
    idempotencyService.markCompleted(idempotencyKey, decision);

    return res.status(200).json({
      status: 'PROCESSED',
      decision,
    });
  } catch (err) {
    console.error('[AgentBot Endpoint] Erro no processamento:', err);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: (err as Error).message,
    });
  }
});

// 3. Webhook Geral do Chatwoot
app.post('/internal/chatwoot/webhook', async (req: Request, res: Response) => {
  try {
    const parseResult = ChatwootWebhookEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_WEBHOOK_PAYLOAD',
        details: parseResult.error.errors,
      });
    }

    const event = parseResult.data;
    const eventId = String(event.id || `${event.event}_${Date.now()}`);
    const idempotencyKey = `webhook_${eventId}`;

    if (!idempotencyService.shouldProcess(idempotencyKey)) {
      return res.status(200).json({ status: 'DUPLICATE_IGNORED' });
    }

    const convId = event.conversation?.id;
    const msgId = typeof event.id === 'number' ? event.id : (typeof event.id === 'string' ? parseInt(event.id, 10) : 0);

    console.log(`[Chatwoot Webhook] Evento: ${event.event}, Conv: #${convId}, Msg: #${msgId}, Tipo: ${event.message_type}, Conteúdo: "${event.content || ''}"`);

    // Processamento de mensagens
    if (event.event === 'message_created') {
      const isOutgoing = event.message_type === 'outgoing' || (event as { message_type?: unknown }).message_type === 1;
      const isIncoming = event.message_type === 'incoming' || (event as { message_type?: unknown }).message_type === 0 || (!event.message_type && !event.private);

      if (convId && (isOutgoing || event.private)) {
        // Se a mensagem foi enviada pelo próprio bot do Hub, não deve desligá-lo
        if (msgId && chatwootAdapter.isBotMessage(msgId)) {
          console.log(`[Chatwoot Webhook] Mensagem #${msgId} enviada pelo próprio bot. Bot mantido.`);
        } else {
          // Atendente humano enviou mensagem: desligamento atômico
          agentBotService.deactivateBotForConversation(convId, 'AGENT_SENT_MESSAGE_WEBHOOK');
        }
      } else if (convId && isIncoming) {
        // Mensagem recebida do cliente no WhatsApp
        // 1. Extração silenciosa de dados comerciais para a Dashboard App
        if (event.content) {
          silentExtractionService.extractFromText(
            '11111111-1111-1111-1111-111111111111',
            convId,
            msgId || 1,
            event.content
          );
        }

        // 2. Disparo do Bot de Triagem (se bot estiver ativo para essa conversa)
        const currentState = agentBotService.getConversationState(convId);
        console.log(`[Chatwoot Webhook] Estado do bot na conversa #${convId}: ${currentState}`);

        if (currentState === 'BOT_ACTIVE') {
          const fakeMsg = {
            id: msgId || Date.now(),
            inbox_id: 1,
            conversation_id: convId,
            message_type: 'incoming' as const,
            content: event.content || '',
            content_type: 'text',
            created_at: Math.floor(Date.now() / 1000),
            private: false,
            attachments: event.attachments as any,
          };
          const fakeConv = {
            id: convId,
            account_id: 1,
            status: 'pending' as const,
            inbox_id: 1,
          };
          const decision = await agentBotService.handleIncomingMessage(fakeConv, fakeMsg);
          console.log(`[Chatwoot Webhook] Decisão da triagem #${convId}:`, decision);
        }
      }
    }

    // Se um atendente humano foi atribuído à conversa
    if (event.event === 'conversation_updated' || event.event === 'conversation_status_changed') {
      if (convId && event.conversation?.assignee_id) {
        agentBotService.deactivateBotForConversation(convId, 'AGENT_ASSIGNED_TO_CONVERSATION');
      }
    }

    idempotencyService.markCompleted(idempotencyKey, { processed: true, event: event.event });
    return res.status(200).json({ status: 'SUCCESS', event: event.event });
  } catch (err) {
    console.error('[Chatwoot Webhook Endpoint] Erro no processamento:', err);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: (err as Error).message,
    });
  }
});

// 4. Endpoint para o Painel Lateral (Dashboard App) consultar sugestões extraídas
app.get('/api/conversations/:id/suggestions', async (req: Request, res: Response) => {
  const convId = parseInt(req.params.id || '0', 10);
  let suggestions = silentExtractionService.getSuggestionsForConversation(convId);

  // Se a lista em memória estiver vazia (ex: container acabou de reiniciar), consulta histórico no Chatwoot
  if (suggestions.length === 0 && convId > 0 && CONFIG.CHATWOOT_API_TOKEN) {
    try {
      const chatwootRes = await fetch(
        `${CONFIG.CHATWOOT_BASE_URL}/api/v1/accounts/${CONFIG.CHATWOOT_ACCOUNT_ID}/conversations/${convId}/messages`,
        {
          headers: { api_access_token: CONFIG.CHATWOOT_API_TOKEN },
        }
      );
      if (chatwootRes.ok) {
        const data = (await chatwootRes.json()) as {
          payload?: Array<{ id: number; content: string; message_type: number }>;
        };
        if (data?.payload && Array.isArray(data.payload)) {
          for (const m of data.payload) {
            if (m.content && (m.message_type === 0 || (m as any).message_type === 'incoming')) {
              silentExtractionService.extractFromText(
                '11111111-1111-1111-1111-111111111111',
                convId,
                m.id,
                m.content
              );
            }
          }
          suggestions = silentExtractionService.getSuggestionsForConversation(convId);
        }
      }
    } catch (err) {
      console.warn(`[Suggestions Endpoint] Aviso: consulta ao Chatwoot falhou para conv #${convId}:`, err);
    }
  }

  res.status(200).json({ suggestions });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, () => {
    console.log(`[Integration Service] Executando na porta ${CONFIG.PORT} (modo mock: ${CONFIG.MOCK_MODE})`);
  });
}
