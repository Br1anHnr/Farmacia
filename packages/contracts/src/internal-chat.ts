import { z } from 'zod';

export const InternalRoomSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  is_general: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type InternalRoom = z.infer<typeof InternalRoomSchema>;

export const InternalMessageSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  sender_name: z.string().optional(),
  content: z.string().min(1).max(2000),
  created_at: z.string().datetime(),
});
export type InternalMessage = z.infer<typeof InternalMessageSchema>;

export const SendInternalMessageInputSchema = z.object({
  room_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
});
export type SendInternalMessageInput = z.infer<typeof SendInternalMessageInputSchema>;
