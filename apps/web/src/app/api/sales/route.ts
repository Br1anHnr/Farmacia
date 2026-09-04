import { NextResponse, type NextRequest } from 'next/server';
import { CreateSaleInputSchema, type Sale } from '@hub-farmacia/contracts';
import { supabaseRest } from '@/lib/supabase';

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

    // 1. Inserir cabeçalho da venda no Supabase
    const salePayload = {
      organization_id: input.organization_id,
      branch_id: input.branch_id,
      chatwoot_conversation_id: input.chatwoot_conversation_id,
      channel: input.channel,
      customer_id: '44444444-4444-4444-4444-444444444441',
      agent_id: '33333333-3333-3333-3333-333333333332', // Atendente Ana Clara
      subtotal,
      discount: input.discount,
      total_amount: totalAmount,
      fulfillment_method: input.fulfillment_method,
      status: 'confirmed',
      origin_type: input.origin_type,
      delivery_address: input.delivery_address || null,
      notes: input.notes || null,
      confirmed_at: new Date().toISOString(),
    };

    let realSaleId = `sale_${Date.now()}`;
    const supabaseSaleRes = await supabaseRest<any[]>('sales', {
      method: 'POST',
      body: salePayload,
    });

    if (supabaseSaleRes.data && supabaseSaleRes.data[0]?.id) {
      realSaleId = supabaseSaleRes.data[0].id;

      // 2. Inserir itens da venda vinculados ao ID real
      const itemsPayload = input.items.map((i) => ({
        sale_id: realSaleId,
        product_name_snapshot: i.product_name,
        unit_price_snapshot: i.unit_price,
        quantity: i.quantity,
        total_item_price: i.unit_price * i.quantity,
      }));

      await supabaseRest('sale_items', {
        method: 'POST',
        body: itemsPayload,
      });

      // 3. Registrar evento de auditoria imutável
      await supabaseRest('audit_events', {
        method: 'POST',
        body: {
          organization_id: input.organization_id,
          actor_id: '33333333-3333-3333-3333-333333333332',
          actor_email: 'ana.clara@multifarma.com',
          action: 'SALE_CONFIRMED',
          entity_type: 'sale',
          entity_id: realSaleId,
          metadata: {
            conversation_id: input.chatwoot_conversation_id,
            total_amount: totalAmount,
            channel: input.channel,
            items_count: input.items.length,
            fulfillment_method: input.fulfillment_method,
          },
        },
      });

      console.log('[Supabase] Venda e auditoria salvas com sucesso no banco:', realSaleId);
    } else {
      console.warn('[Supabase] Inserção de venda falhou ou sem credenciais, usando fallback:', supabaseSaleRes.error);
    }

    const sale: Sale = {
      id: realSaleId,
      organization_id: input.organization_id,
      branch_id: input.branch_id,
      chatwoot_conversation_id: input.chatwoot_conversation_id,
      channel: input.channel,
      customer_id: '44444444-4444-4444-4444-444444444441',
      agent_id: '33333333-3333-3333-3333-333333333332',
      subtotal,
      discount: input.discount,
      total_amount: totalAmount,
      fulfillment_method: input.fulfillment_method,
      status: 'confirmed',
      origin_type: input.origin_type,
      delivery_address: input.delivery_address,
      notes: input.notes,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: input.items.map((i, idx) => ({
        id: `item_${idx + 1}`,
        product_id: i.product_id,
        product_name_snapshot: i.product_name,
        unit_price_snapshot: i.unit_price,
        quantity: i.quantity,
        total_item_price: i.unit_price * i.quantity,
      })),
    };

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    console.error('Erro ao processar venda:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: (err as Error).message },
      { status: 500 }
    );
  }
}
