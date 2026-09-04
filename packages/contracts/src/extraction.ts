import { z } from 'zod';
import { FulfillmentMethodSchema } from './sales';

export const ExtractionSuggestionStatusSchema = z.enum(['pending', 'accepted', 'rejected']);
export type ExtractionSuggestionStatus = z.infer<typeof ExtractionSuggestionStatusSchema>;

export const ExtractionSuggestionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  chatwoot_conversation_id: z.number(),
  source_message_id: z.number(),
  source_text: z.string(),
  suggested_product_name: z.string().nullable().optional(),
  suggested_quantity: z.number().positive().nullable().optional(),
  suggested_unit_price: z.number().nonnegative().nullable().optional(),
  suggested_fulfillment: FulfillmentMethodSchema.nullable().optional(),
  suggested_address: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  status: ExtractionSuggestionStatusSchema.default('pending'),
  created_at: z.string().datetime(),
});
export type ExtractionSuggestion = z.infer<typeof ExtractionSuggestionSchema>;
