import { NextResponse, type NextRequest } from 'next/server';
import { CreateSaleInputSchema, type Sale } from '@hub-farmacia/contracts';

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parseResult = CreateSaleInputSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_SALE_INPUT', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const subtotal = input.items.reduce(
      (acc: number, item: { unit_price: number; quantity: number }) =>
        acc + item.unit_price * item.quantity,
      0
    );
    const totalAmount = Math.max(0, subtotal - input.discount);

    const sale: Sale = {
      id: `sale_${Date.now()}`,
      organization_id: input.organization_id,
      branch_id: input.branch_id,
      chatwoot_conversation_id: input.chatwoot_conversation_id,
      channel: input.channel,
      customer_id: '44444444-4444-4444-4444-444444444441',
      agent_id: '33333333-3333-3333-3333-333333333332', // Atendente Ana
      subtotal,
      discount: input.discount,
      total_amount: totalAmount,
      fulfillment_method: input.fulfillment_method,
      status: 'confirmed', // Confirmação humana explícita
      origin_type: input.origin_type,
      delivery_address: input.delivery_address,
      notes: input.notes,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: input.items.map((i: { product_id?: string | null; product_name: string; unit_price: number; quantity: number }) => ({
        id: `item_${Math.random().toString(36).substring(2, 7)}`,
        product_id: i.product_id,
        product_name_snapshot: i.product_name,
        unit_price_snapshot: i.unit_price,
        quantity: i.quantity,
        total_item_price: i.unit_price * i.quantity,
      })),
    };

    console.log('[API /api/sales] Venda confirmada e auditada:', sale.id);

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    console.error('Erro ao processar venda:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: (err as Error).message },
      { status: 500 }
    );
  }
}
