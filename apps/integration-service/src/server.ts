import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { idempotencyService } from './services/idempotency.js';
import { agentBotService } from './services/agentbot.js';
import { silentExtractionService } from './services/extraction.js';
import { evolutionAdapter } from './adapters/evolution.js';
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

    // Se um atendente humano mandou mensagem, garante desligamento atômico do bot
    if (event.event === 'message_created') {
      if (convId && (event.message_type === 'outgoing' || event.private)) {
        agentBotService.deactivateBotForConversation(convId, 'AGENT_SENT_MESSAGE_WEBHOOK');
      }

      // Extração silenciosa de dados comerciais caso a mensagem seja do cliente ou atendente
      if (convId && event.content) {
        silentExtractionService.extractFromText(
          '11111111-1111-1111-1111-111111111111', // Organização padrão homologação
          convId,
          typeof event.id === 'number' ? event.id : 1,
          event.content
        );
      }
    }

    // Se o status da conversa mudou para open ou atendente foi atribuído
    if (event.event === 'conversation_updated' || event.event === 'conversation_status_changed') {
      if (convId && event.conversation?.status === 'open') {
        agentBotService.deactivateBotForConversation(convId, 'CONVERSATION_OPENED');
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
app.get('/api/conversations/:id/suggestions', (req: Request, res: Response) => {
  const convId = parseInt(req.params.id || '0', 10);
  const suggestions = silentExtractionService.getSuggestionsForConversation(convId);
  res.status(200).json({ suggestions });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(CONFIG.PORT, () => {
    console.log(`[Integration Service] Executando na porta ${CONFIG.PORT} (modo mock: ${CONFIG.MOCK_MODE})`);
  });
}
