import { z } from 'zod';
import { ChannelTypeSchema } from './chatwoot.js';

export const SaleStatusSchema = z.enum(['draft', 'confirmed', 'cancelled']);
export type SaleStatus = z.infer<typeof SaleStatusSchema>;

export const FulfillmentMethodSchema = z.enum(['delivery', 'pickup']);
export type FulfillmentMethod = z.infer<typeof FulfillmentMethodSchema>;

export const SaleOriginTypeSchema = z.enum(['manual', 'ai_suggested']);
export type SaleOriginType = z.infer<typeof SaleOriginTypeSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  external_product_id: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  erp_source: z.string().nullable().optional(),
  name: z.string().min(1),
  normalized_name: z.string().min(1),
  default_price: z.number().positive(),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

export const SaleItemSchema = z.object({
  id: z.string().uuid().optional(),
  sale_id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  product_name_snapshot: z.string().min(1),
  unit_price_snapshot: z.number().nonnegative(),
  quantity: z.number().positive(),
  total_item_price: z.number().nonnegative(),
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

export const CreateSaleItemInputSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1),
  unit_price: z.number().nonnegative(),
  quantity: z.number().positive(),
});
export type CreateSaleItemInput = z.infer<typeof CreateSaleItemInputSchema>;

export const CreateSaleInputSchema = z.object({
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  chatwoot_conversation_id: z.number(),
  channel: ChannelTypeSchema,
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  items: z.array(CreateSaleItemInputSchema).min(1),
  discount: z.number().nonnegative().default(0),
  fulfillment_method: FulfillmentMethodSchema.default('delivery'),
  origin_type: SaleOriginTypeSchema.default('manual'),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;

export const ConfirmSaleInputSchema = z.object({
  sale_id: z.string().uuid(),
  chatwoot_conversation_id: z.number(),
});
export type ConfirmSaleInput = z.infer<typeof ConfirmSaleInputSchema>;

export const CancelSaleInputSchema = z.object({
  sale_id: z.string().uuid(),
  reason: z.string().min(3),
});
export type CancelSaleInput = z.infer<typeof CancelSaleInputSchema>;

export const SaleSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  chatwoot_conversation_id: z.number(),
  channel: ChannelTypeSchema,
  customer_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  fulfillment_method: FulfillmentMethodSchema,
  status: SaleStatusSchema,
  origin_type: SaleOriginTypeSchema,
  cancellation_reason: z.string().nullable().optional(),
  delivery_address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  confirmed_at: z.string().datetime().nullable().optional(),
  cancelled_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  items: z.array(SaleItemSchema).optional(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const DashboardKPIsSchema = z.object({
  total_revenue: z.number().nonnegative(),
  confirmed_sales_count: z.number().int().nonnegative(),
  average_ticket: z.number().nonnegative(),
  conversion_rate: z.number().min(0).max(100),
  total_conversations: z.number().int().nonnegative(),
  sales_by_channel: z.record(z.number()),
  sales_by_branch: z.array(z.object({
    branch_id: z.string(),
    branch_name: z.string(),
    total_revenue: z.number(),
    sales_count: z.number(),
  })),
  sales_by_agent: z.array(z.object({
    agent_id: z.string(),
    agent_name: z.string(),
    total_revenue: z.number(),
    sales_count: z.number(),
  })),
  top_products: z.array(z.object({
    product_name: z.string(),
    quantity: z.number(),
    total_revenue: z.number(),
  })),
  delivery_vs_pickup: z.object({
    delivery_count: z.number(),
    pickup_count: z.number(),
  }),
});
export type DashboardKPIs = z.infer<typeof DashboardKPIsSchema>;
