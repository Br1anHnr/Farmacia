import { z } from 'zod';
import { ChatwootMessageSchema, ChatwootConversationSchema } from './chatwoot.js';

export const PharmacyIntentSchema = z.enum([
  'BUY_PRODUCT',
  'SEND_PRESCRIPTION',
  'CHECK_ORDER',
  'GENERAL_QUESTION',
  'TALK_TO_HUMAN',
  'UNKNOWN'
]);
export type PharmacyIntent = z.infer<typeof PharmacyIntentSchema>;

export const ConversationStateSchema = z.enum([
  'BOT_ACTIVE',
  'TRIAGING',
  'HANDOFF_REQUESTED',
  'HUMAN_ACTIVE'
]);
export type ConversationState = z.infer<typeof ConversationStateSchema>;

export const AgentBotPayloadSchema = z.object({
  event: z.string(),
  id: z.union([z.number(), z.string()]).optional(),
  conversation: ChatwootConversationSchema,
  message: ChatwootMessageSchema.optional(),
});
export type AgentBotPayload = z.infer<typeof AgentBotPayloadSchema>;

export const BotHandoffDecisionSchema = z.object({
  should_respond: z.boolean(),
  bot_message: z.string().optional(),
  intent_detected: PharmacyIntentSchema,
  confidence: z.number().min(0).max(1),
  transition_to_human: z.boolean(),
  reason: z.string(),
  extracted_product_name: z.string().optional(),
  extracted_city_or_branch: z.string().optional(),
});
export type BotHandoffDecision = z.infer<typeof BotHandoffDecisionSchema>;
