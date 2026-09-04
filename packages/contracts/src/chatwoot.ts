import { z } from 'zod';

export const ChannelTypeSchema = z.enum(['whatsapp', 'instagram', 'facebook', 'web_widget', 'api']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ConversationStatusSchema = z.enum(['pending', 'open', 'snoozed', 'resolved']);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MessageSenderTypeSchema = z.enum(['Contact', 'User', 'AgentBot']);
export type MessageSenderType = z.infer<typeof MessageSenderTypeSchema>;

export const MessageTypeSchema = z.union([
  z.enum(['incoming', 'outgoing', 'template', 'activity']),
  z.number().transform((val) => {
    if (val === 0) return 'incoming' as const;
    if (val === 1) return 'outgoing' as const;
    if (val === 2) return 'activity' as const;
    if (val === 3) return 'template' as const;
    return 'incoming' as const;
  }),
  z.string(),
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const ChatwootContactSchema = z.object({
  id: z.number().optional(),
  name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  identifier: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
}).passthrough();
export type ChatwootContact = z.infer<typeof ChatwootContactSchema>;

export const ChatwootUserSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
}).passthrough();
export type ChatwootUser = z.infer<typeof ChatwootUserSchema>;

export const ChatwootAttachmentSchema = z.object({
  id: z.number().optional(),
  message_id: z.number().optional(),
  file_type: z.string().optional(),
  account_id: z.number().optional(),
  data_url: z.string().optional(),
  thumb_url: z.string().optional(),
}).passthrough();
export type ChatwootAttachment = z.infer<typeof ChatwootAttachmentSchema>;

export const ChatwootMessageSchema = z.object({
  id: z.union([z.number(), z.string()]),
  content: z.string().nullable().optional(),
  inbox_id: z.number().optional(),
  conversation_id: z.number().optional(),
  message_type: MessageTypeSchema.optional(),
  content_type: z.string().optional(),
  content_attributes: z.record(z.unknown()).optional(),
  created_at: z.union([z.number(), z.string()]).optional(),
  private: z.boolean().optional(),
  sender_type: z.union([MessageSenderTypeSchema, z.string()]).optional(),
  sender: z.unknown().optional(),
  attachments: z.array(z.unknown()).optional(),
}).passthrough();
export type ChatwootMessage = z.infer<typeof ChatwootMessageSchema>;

export const ChatwootConversationSchema = z.object({
  id: z.number(),
  account_id: z.number().optional(),
  inbox_id: z.number().optional(),
  status: z.union([ConversationStatusSchema, z.string(), z.number()]).optional(),
  assignee_id: z.number().nullable().optional(),
  meta: z.record(z.unknown()).optional(),
  custom_attributes: z.record(z.unknown()).optional(),
  additional_attributes: z.record(z.unknown()).optional(),
}).passthrough();
export type ChatwootConversation = z.infer<typeof ChatwootConversationSchema>;

export const ChatwootWebhookEventSchema = z.object({
  event: z.string(),
  id: z.union([z.string(), z.number()]).optional(),
  account: z.object({ id: z.number().optional(), name: z.string().optional() }).passthrough().optional(),
  conversation: ChatwootConversationSchema.optional(),
  messages: z.array(z.unknown()).optional(),
  sender: z.unknown().optional(),
  content: z.string().nullable().optional(),
  message_type: MessageTypeSchema.optional(),
  private: z.boolean().optional(),
  attachments: z.array(z.unknown()).optional(),
  inbox: z.unknown().optional(),
  changed_attributes: z.unknown().optional(),
}).passthrough();
export type ChatwootWebhookEvent = z.infer<typeof ChatwootWebhookEventSchema>;
