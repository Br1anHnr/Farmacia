import { z } from 'zod';

export const ChannelTypeSchema = z.enum(['whatsapp', 'instagram', 'facebook', 'web_widget', 'api']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ConversationStatusSchema = z.enum(['pending', 'open', 'snoozed', 'resolved']);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const MessageSenderTypeSchema = z.enum(['Contact', 'User', 'AgentBot']);
export type MessageSenderType = z.infer<typeof MessageSenderTypeSchema>;

export const MessageTypeSchema = z.enum(['incoming', 'outgoing', 'template', 'activity']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const ChatwootContactSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  identifier: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
});
export type ChatwootContact = z.infer<typeof ChatwootContactSchema>;

export const ChatwootUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.string().optional(),
});
export type ChatwootUser = z.infer<typeof ChatwootUserSchema>;

export const ChatwootAttachmentSchema = z.object({
  id: z.number(),
  message_id: z.number().optional(),
  file_type: z.enum(['image', 'audio', 'video', 'file', 'share']),
  account_id: z.number().optional(),
  data_url: z.string().url(),
  thumb_url: z.string().url().optional(),
});
export type ChatwootAttachment = z.infer<typeof ChatwootAttachmentSchema>;

export const ChatwootMessageSchema = z.object({
  id: z.number(),
  content: z.string().nullable().optional(),
  inbox_id: z.number(),
  conversation_id: z.number(),
  message_type: MessageTypeSchema,
  content_type: z.string().default('text'),
  content_attributes: z.record(z.unknown()).optional(),
  created_at: z.union([z.number(), z.string()]),
  private: z.boolean().default(false),
  sender_type: MessageSenderTypeSchema.optional(),
  sender: z.union([ChatwootContactSchema, ChatwootUserSchema]).optional(),
  attachments: z.array(ChatwootAttachmentSchema).optional(),
});
export type ChatwootMessage = z.infer<typeof ChatwootMessageSchema>;

export const ChatwootConversationSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  inbox_id: z.number(),
  status: ConversationStatusSchema,
  assignee_id: z.number().nullable().optional(),
  meta: z.object({
    sender: ChatwootContactSchema.optional(),
    assignee: ChatwootUserSchema.nullable().optional(),
    team: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
    channel: z.string().optional(),
  }).optional(),
  custom_attributes: z.record(z.unknown()).optional(),
  additional_attributes: z.record(z.unknown()).optional(),
});
export type ChatwootConversation = z.infer<typeof ChatwootConversationSchema>;

export const ChatwootWebhookEventSchema = z.object({
  event: z.enum([
    'conversation_created',
    'conversation_status_changed',
    'conversation_updated',
    'message_created',
    'message_updated',
    'webwidget_triggered'
  ]),
  id: z.union([z.string(), z.number()]).optional(),
  account: z.object({ id: z.number(), name: z.string().optional() }).optional(),
  conversation: ChatwootConversationSchema.optional(),
  messages: z.array(ChatwootMessageSchema).optional(),
  sender: ChatwootContactSchema.optional(),
  content: z.string().nullable().optional(),
  message_type: MessageTypeSchema.optional(),
  private: z.boolean().optional(),
  attachments: z.array(ChatwootAttachmentSchema).optional(),
  inbox: z.object({ id: z.number(), name: z.string().optional() }).optional(),
  changed_attributes: z.array(z.record(z.unknown())).optional(),
});
export type ChatwootWebhookEvent = z.infer<typeof ChatwootWebhookEventSchema>;
