import { z } from 'zod';

export const AuditActionSchema = z.enum([
  'AUTH_LOGIN',
  'AUTH_FAILED',
  'SALE_CREATED',
  'SALE_CONFIRMED',
  'SALE_CANCELLED',
  'SALE_UPDATED',
  'BOT_HANDOFF_TO_HUMAN',
  'CONVERSATION_TRANSFERRED',
  'BRANCH_CHANGED',
  'USER_ROLE_CHANGED',
  'INTEGRATION_ERROR',
  'AI_FALLBACK_TRIGGERED',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  actor_id: z.string().uuid().nullable().optional(),
  actor_email: z.string().nullable().optional(),
  action: AuditActionSchema,
  entity_type: z.string().min(1),
  entity_id: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  ip_address: z.string().nullable().optional(),
  created_at: z.string().datetime(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const CreateAuditEventInputSchema = z.object({
  organization_id: z.string().uuid(),
  actor_id: z.string().uuid().nullable().optional(),
  actor_email: z.string().nullable().optional(),
  action: AuditActionSchema,
  entity_type: z.string().min(1),
  entity_id: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  ip_address: z.string().nullable().optional(),
});
export type CreateAuditEventInput = z.infer<typeof CreateAuditEventInputSchema>;
